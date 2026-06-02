from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import hashlib
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import random
import re

def parse_date_safe(date_str: str) -> datetime:
    """Parse date string safely from various formats"""
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        try:
            return datetime.strptime(date_str, '%Y-%m-%dT%H:%M:%S.%f')
        except (ValueError, AttributeError):
            try:
                return datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')
            except (ValueError, AttributeError):
                return datetime.now(timezone.utc)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
_primary_db = client[os.environ.get('DB_NAME', 'squash_coach')]

# Réplica opcional (doble-escritura a MongoDB Atlas durante la migración a Cloud Run).
# Lecturas y operaciones SIEMPRE se hacen sobre el primario.
# Las escrituras se replican async en background; si fallan, sólo se loguea.
import asyncio as _asyncio
REPLICA_MONGO_URL = os.environ.get('REPLICA_MONGO_URL')
REPLICA_DB_NAME = os.environ.get('REPLICA_DB_NAME', os.environ.get('DB_NAME', 'squash_coach'))
_replica_client = AsyncIOMotorClient(REPLICA_MONGO_URL) if REPLICA_MONGO_URL else None
_replica_db_raw = _replica_client[REPLICA_DB_NAME] if _replica_client else None

_WRITE_METHODS = {
    'insert_one', 'insert_many',
    'update_one', 'update_many',
    'replace_one',
    'delete_one', 'delete_many',
    'find_one_and_update', 'find_one_and_delete', 'find_one_and_replace',
    'bulk_write', 'create_index', 'drop',
}

class _ReplicatedCollection:
    """Wrapper de una colección Motor: lectura local; escrituras replican a Atlas async."""
    __slots__ = ('_primary', '_replica', '_name')
    def __init__(self, primary, replica, name):
        self._primary = primary
        self._replica = replica
        self._name = name

    def __getattr__(self, attr):
        primary_method = getattr(self._primary, attr)
        if attr not in _WRITE_METHODS or self._replica is None:
            return primary_method

        replica_method = getattr(self._replica, attr)
        async def _wrapped(*args, **kwargs):
            result = await primary_method(*args, **kwargs)
            try:
                # Python 3.6 compat: usar loop.create_task en vez de asyncio.create_task
                _loop = _asyncio.get_event_loop()
                _loop.create_task(_replicate(replica_method, attr, self._name, args, kwargs))
            except Exception as e:
                logging.warning(f"[REPLICA] no se pudo programar replicación {self._name}.{attr}: {e}")
            return result
        return _wrapped

async def _replicate(method, op, coll_name, args, kwargs):
    try:
        await method(*args, **kwargs)
    except Exception as e:
        logging.warning(f"[REPLICA-WARN] {coll_name}.{op} falló en réplica: {e}")

class _ReplicatedDB:
    __slots__ = ('_primary', '_replica')
    def __init__(self, primary, replica):
        self._primary = primary
        self._replica = replica
    def __getattr__(self, name):
        return _ReplicatedCollection(
            self._primary[name],
            self._replica[name] if self._replica is not None else None,
            name,
        )
    def __getitem__(self, name):
        return self.__getattr__(name)

db = _ReplicatedDB(_primary_db, _replica_db_raw)
if REPLICA_MONGO_URL:
    logging.info(f"[REPLICA] Doble-escritura activa hacia Atlas (db={REPLICA_DB_NAME})")

# Create the main app
app = FastAPI(title="Squash Coach API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Endpoint para descargar el código actualizado
@app.get("/download/SquashCoach-Updated.zip")
async def download_code():
    file_path = ROOT_DIR / "SquashCoach-Updated.zip"
    if file_path.exists():
        return FileResponse(file_path, filename="SquashCoach-Updated.zip", media_type="application/zip")
    raise HTTPException(status_code=404, detail="Archivo no encontrado")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Email Configuration
SMTP_EMAIL = os.environ.get('SMTP_EMAIL', 'squashcoach1830@gmail.com')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
SMTP_SERVER = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))

def send_email(to_email: str, subject: str, html_body: str):
    """Send email via SMTP"""
    if not SMTP_PASSWORD:
        logger.warning("SMTP_PASSWORD not configured, skipping email")
        return False
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"Squash Coach <{SMTP_EMAIL}>"
        msg['To'] = to_email
        msg.attach(MIMEText(html_body, 'html'))
        
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
        logger.info(f"Email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Error sending email to {to_email}: {e}")
        return False

def send_welcome_email(to_email: str, name: str):
    """Send welcome email on registration"""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2196F3;">Bienvenido a Squash Coach!</h2>
        <p>Hola <strong>{name}</strong>,</p>
        <p>Tu cuenta ha sido creada exitosamente. Ya puedes empezar a registrar tus partidos y analizar tu juego.</p>
        <p>Funciones principales:</p>
        <ul>
            <li>Registrar partidos en tiempo real</li>
            <li>Analizar estadisticas de juego</li>
            <li>Sincronizar datos en la nube</li>
            <li>Gestionar jugadores y torneos</li>
        </ul>
        <p>Buena suerte en la cancha!</p>
        <p style="color: #666; font-size: 12px;">- El equipo de Squash Coach</p>
    </div>
    """
    send_email(to_email, "Bienvenido a Squash Coach!", html)

def send_reset_code_email(to_email: str, code: str):
    """Send password reset code"""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2196F3;">Recuperar Contrasena</h2>
        <p>Recibimos una solicitud para restablecer tu contrasena en Squash Coach.</p>
        <p>Tu codigo de verificacion es:</p>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2196F3;">{code}</span>
        </div>
        <p>Este codigo expira en <strong>15 minutos</strong>.</p>
        <p>Si no solicitaste este cambio, ignora este correo.</p>
        <p style="color: #666; font-size: 12px;">- El equipo de Squash Coach</p>
    </div>
    """
    send_email(to_email, "Squash Coach - Codigo de Recuperacion", html)

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def hash_password(password: str) -> str:
    """Hash password with salt"""
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}:{hashed}"

def verify_password(password: str, stored_hash: str) -> bool:
    """Verify password against stored hash"""
    try:
        salt, hashed = stored_hash.split(':')
        return hashlib.sha256((password + salt).encode()).hexdigest() == hashed
    except:
        return False

def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_phone(phone: str) -> bool:
    """Validate phone format (basic)"""
    # Remove spaces and dashes
    cleaned = re.sub(r'[\s\-\(\)]', '', phone)
    # Should be 10-15 digits, optionally starting with +
    pattern = r'^\+?\d{10,15}$'
    return re.match(pattern, cleaned) is not None

# =============================================================================
# MODELS
# =============================================================================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    phone: Optional[str] = None
    picture: Optional[str] = None
    auth_type: str = "google"  # "google", "email"
    password_hash: Optional[str] = None
    created_at: datetime

class UserSession(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime

class SessionDataResponse(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    session_token: str

# Modelo para compartir partidos
class SharePermission(BaseModel):
    permission_id: str = Field(default_factory=lambda: f"perm_{uuid.uuid4().hex[:12]}")
    owner_user_id: str  # Usuario que comparte
    viewer_user_id: str  # Usuario que puede ver
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Request Models para autenticación con email
class EmailRegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    phone: Optional[str] = None

class EmailLoginRequest(BaseModel):
    email: str
    password: str

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None

class ShareRequest(BaseModel):
    identifier: str  # email o teléfono del usuario a compartir

class Player(BaseModel):
    player_id: str = Field(default_factory=lambda: f"player_{uuid.uuid4().hex[:12]}")
    user_id: str  # Owner
    nickname: str
    category: Optional[str] = None
    gender: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    club: Optional[str] = None
    is_mine: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    synced: bool = True

class Match(BaseModel):
    match_id: str = Field(default_factory=lambda: f"match_{uuid.uuid4().hex[:12]}")
    user_id: str
    local_id: Optional[int] = None  # ID local del dispositivo
    player1_id: str
    player2_id: str
    my_player_id: str
    best_of: int
    winner_id: Optional[str] = None
    date: datetime
    status: str
    current_game: int = 1
    player1_games: int = 0
    player2_games: int = 0
    tournament_name: Optional[str] = None
    match_date: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    synced: bool = True

class Point(BaseModel):
    point_id: str = Field(default_factory=lambda: f"point_{uuid.uuid4().hex[:12]}")
    match_id: str
    local_id: Optional[int] = None
    position_x: float
    position_y: float
    winner_player_id: str
    reason: str
    my_player_pos_x: Optional[float] = None
    my_player_pos_y: Optional[float] = None
    opponent_pos_x: Optional[float] = None
    opponent_pos_y: Optional[float] = None
    game_number: int
    point_number: int
    player1_score: int
    player2_score: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GameResult(BaseModel):
    result_id: str = Field(default_factory=lambda: f"result_{uuid.uuid4().hex[:12]}")
    match_id: str
    game_number: int
    player1_score: int
    player2_score: int
    winner_id: Optional[str] = None

# Request/Response Models
class PlayerCreate(BaseModel):
    nickname: str
    local_id: Optional[int] = None
    category: Optional[str] = None
    gender: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    club: Optional[str] = None
    is_mine: int = 0

class MatchCreate(BaseModel):
    local_id: Optional[int] = None
    player1_local_id: int
    player2_local_id: int
    my_player_local_id: int
    best_of: int
    winner_local_id: Optional[int] = None
    date: str
    status: str
    current_game: int = 1
    player1_games: int = 0
    player2_games: int = 0
    tournament_name: Optional[str] = None
    match_date: Optional[str] = None

class PointCreate(BaseModel):
    local_id: Optional[int] = None
    match_local_id: int
    position_x: float
    position_y: float
    winner_player_local_id: int
    reason: Optional[str] = ""
    my_player_pos_x: Optional[float] = None
    my_player_pos_y: Optional[float] = None
    opponent_pos_x: Optional[float] = None
    opponent_pos_y: Optional[float] = None
    game_number: int
    point_number: int
    player1_score: int
    player2_score: int

class GameResultCreate(BaseModel):
    match_local_id: int
    game_number: int
    player1_score: int
    player2_score: int
    winner_local_id: Optional[int] = None

class ShadowRoutine(BaseModel):
    routine_id: str = Field(default_factory=lambda: f"shadow_{uuid.uuid4().hex[:12]}")
    user_id: str
    local_id: Optional[int] = None
    name: Optional[str] = None
    date: str
    zone_mode: int
    interval_time: float
    set_duration: int
    rest_duration: int
    number_of_sets: int
    completed_sets: int
    total_zones_visited: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ShadowRoutineCreate(BaseModel):
    local_id: Optional[int] = None
    name: Optional[str] = None
    date: str
    zone_mode: int
    interval_time: float
    set_duration: int
    rest_duration: int
    number_of_sets: int
    completed_sets: int
    total_zones_visited: int

class RefereeMatch(BaseModel):
    referee_id: str = Field(default_factory=lambda: f"ref_{uuid.uuid4().hex[:12]}")
    user_id: str
    local_id: Optional[int] = None
    player1_name: str
    player2_name: str
    best_of: int  # 1, 3, 5
    player1_games: int = 0
    player2_games: int = 0
    games_detail: List[Dict[str, Any]] = []  # [{game_number, p1, p2, winner}]
    status: str = "in_progress"  # in_progress | finished
    winner_name: Optional[str] = None
    date: str
    duration_seconds: Optional[int] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RefereeMatchCreate(BaseModel):
    local_id: Optional[int] = None
    player1_name: str
    player2_name: str
    best_of: int
    player1_games: int = 0
    player2_games: int = 0
    games_detail: List[Dict[str, Any]] = []
    status: str = "in_progress"
    winner_name: Optional[str] = None
    date: str
    duration_seconds: Optional[int] = None

class SyncData(BaseModel):
    players: List[PlayerCreate] = []
    matches: List[MatchCreate] = []
    points: List[PointCreate] = []
    game_results: List[GameResultCreate] = []

# =============================================================================
# AUTHENTICATION
# =============================================================================

async def get_session_token(request: Request) -> Optional[str]:
    """Extract session token from cookie or Authorization header"""
    # Try cookie first
    session_token = request.cookies.get("session_token")
    if session_token:
        return session_token
    
    # Try Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]
    
    return None

async def get_current_user(request: Request) -> User:
    """Get current authenticated user"""
    session_token = await get_session_token(request)
    
    if not session_token:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    # Find session
    session = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=401, detail="Sesion invalida")
    
    # Check expiry
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Sesion expirada")
    
    # Auto-refresh: extend session if it expires within 30 days
    days_until_expiry = (expires_at - datetime.now(timezone.utc)).days
    if days_until_expiry < 30:
        new_expires = datetime.now(timezone.utc) + timedelta(days=90)
        await db.user_sessions.update_one(
            {"session_token": session_token},
            {"$set": {"expires_at": new_expires}}
        )
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    
    return User(**user_doc)

async def get_optional_user(request: Request) -> Optional[User]:
    """Get current user if authenticated, None otherwise"""
    try:
        return await get_current_user(request)
    except HTTPException:
        return None

# =============================================================================
# AUTH ENDPOINTS
# =============================================================================

@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    """Exchange session_id for session_token"""
    session_id = request.headers.get("X-Session-ID")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID requerido")
    
    # Exchange with Emergent Auth
    async with httpx.AsyncClient() as client:
        try:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Session ID inválido")
            
            user_data = auth_response.json()
            
        except httpx.RequestError as e:
            logger.error(f"Error contacting auth service: {e}")
            raise HTTPException(status_code=500, detail="Error de autenticación")
    
    # Check if user exists
    existing_user = await db.users.find_one(
        {"email": user_data["email"]},
        {"_id": 0}
    )
    
    if existing_user:
        user_id = existing_user["user_id"]
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = {
            "user_id": user_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture"),
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(new_user)
        logger.info(f"New user created: {user_id}")
    
    # Create session
    session_token = user_data["session_token"]
    from datetime import timedelta
    expires_at = datetime.now(timezone.utc) + timedelta(days=90)
    
    session = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    }
    
    # Remove old sessions for this user
    await db.user_sessions.delete_many({"user_id": user_id})
    result = await db.user_sessions.insert_one(session)
    logger.info(f"Session created for user {user_id}, inserted_id: {result.inserted_id}")
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=90 * 24 * 60 * 60  # 90 days
    )
    
    return {
        "user_id": user_id,
        "email": user_data["email"],
        "name": user_data["name"],
        "picture": user_data.get("picture"),
        "session_token": session_token
    }

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return current_user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = await get_session_token(request)
    
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Sesión cerrada"}

# =============================================================================
# EMAIL AUTHENTICATION
# =============================================================================

@api_router.post("/auth/register")
async def register_email(data: EmailRegisterRequest, response: Response):
    """Register with email and password"""
    # Validate email
    if not validate_email(data.email):
        raise HTTPException(status_code=400, detail="Email inválido")
    
    # Validate password
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")
    
    # Validate phone if provided
    if data.phone and not validate_phone(data.phone):
        raise HTTPException(status_code=400, detail="Número de teléfono inválido")
    
    # Check if email already exists
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Este email ya está registrado")
    
    # Check if phone already exists (if provided)
    if data.phone:
        phone_cleaned = re.sub(r'[\s\-\(\)]', '', data.phone)
        existing_phone = await db.users.find_one({"phone": phone_cleaned})
        if existing_phone:
            raise HTTPException(status_code=400, detail="Este teléfono ya está registrado")
    
    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    password_hash = hash_password(data.password)
    
    new_user = {
        "user_id": user_id,
        "email": data.email.lower(),
        "name": data.name,
        "phone": re.sub(r'[\s\-\(\)]', '', data.phone) if data.phone else None,
        "picture": None,
        "auth_type": "email",
        "password_hash": password_hash,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.users.insert_one(new_user)
    logger.info(f"New email user created: {user_id}")
    
    # Send welcome email (non-blocking, don't fail if email fails)
    try:
        send_welcome_email(data.email.lower(), data.name)
    except Exception as e:
        logger.error(f"Failed to send welcome email: {e}")
    
    # Create session
    session_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=90)
    
    session = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.user_sessions.insert_one(session)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=90 * 24 * 60 * 60
    )
    
    return {
        "user_id": user_id,
        "email": data.email.lower(),
        "name": data.name,
        "phone": new_user["phone"],
        "session_token": session_token
    }

@api_router.post("/auth/login")
async def login_email(data: EmailLoginRequest, response: Response):
    """Login with email and password"""
    # Find user
    user = await db.users.find_one({"email": data.email.lower()})
    
    if not user:
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    
    # Check if user registered with email
    if user.get("auth_type") != "email":
        raise HTTPException(status_code=400, detail="Esta cuenta fue creada con Google. Usa 'Continuar con Google'")
    
    # Verify password
    if not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    
    # Create session
    session_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=90)
    
    session = {
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    }
    
    # Remove old sessions
    await db.user_sessions.delete_many({"user_id": user["user_id"]})
    await db.user_sessions.insert_one(session)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=90 * 24 * 60 * 60
    )
    
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user["name"],
        "phone": user.get("phone"),
        "picture": user.get("picture"),
        "session_token": session_token
    }

class ForgotPasswordRequest(BaseModel):
    email: str

class GoogleSignInRequest(BaseModel):
    id_token: str

@api_router.post("/auth/google")
async def google_signin(data: GoogleSignInRequest, response: Response):
    """Inicio de sesión / registro con Google.
    Verifica el id_token contra Google y crea o reutiliza el usuario por email.
    """
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
    except ImportError:
        raise HTTPException(status_code=500, detail="google-auth no instalado")

    google_client_id = (os.environ.get("GOOGLE_CLIENT_ID") or "").strip()
    if not google_client_id:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID no configurado")

    # Verificar el token con Google
    try:
        idinfo = google_id_token.verify_oauth2_token(
            data.id_token,
            google_requests.Request(),
            google_client_id,
        )
    except Exception as e:
        logger.error(f"Google token verify failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=401, detail=f"Token de Google inválido: {type(e).__name__}: {e}")

    email = (idinfo.get("email") or "").lower().strip()
    if not email or not idinfo.get("email_verified"):
        raise HTTPException(status_code=401, detail="Email de Google no verificado")

    name = idinfo.get("name") or email.split("@")[0]
    picture = idinfo.get("picture")

    # Buscar usuario existente por email
    user = await db.users.find_one({"email": email})
    if user:
        # Si existía con email/password, marcar también como google (linked)
        if user.get("auth_type") != "google":
            await db.users.update_one(
                {"user_id": user["user_id"]},
                {"$set": {"google_linked": True, "picture": picture or user.get("picture")}}
            )
    else:
        # Crear usuario nuevo
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "auth_type": "google",
            "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(user)
        logger.info(f"New Google user created: {user_id}")

    # Crear sesión
    session_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=90)
    await db.user_sessions.delete_many({"user_id": user["user_id"]})
    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True, secure=True, samesite="none",
        path="/", max_age=90 * 24 * 60 * 60
    )

    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user["name"],
        "phone": user.get("phone"),
        "picture": user.get("picture") or picture,
        "session_token": session_token,
    }

class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str

@api_router.post("/auth/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    """Request password reset code"""
    user = await db.users.find_one({"email": data.email.lower()}, {"_id": 0})
    if not user:
        # Don't reveal if email exists
        return {"message": "Si el email existe, recibirás un código de recuperación"}
    
    # Generate 6-digit code
    code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    # Store reset code
    await db.password_resets.delete_many({"email": data.email.lower()})
    await db.password_resets.insert_one({
        "email": data.email.lower(),
        "code": code,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Send email
    send_reset_code_email(data.email.lower(), code)
    
    return {"message": "Si el email existe, recibirás un código de recuperación"}

@api_router.post("/auth/reset-password")
async def reset_password(data: ResetPasswordRequest):
    """Reset password with verification code"""
    reset = await db.password_resets.find_one({
        "email": data.email.lower(),
        "code": data.code
    }, {"_id": 0})
    
    if not reset:
        raise HTTPException(status_code=400, detail="Código inválido")
    
    if datetime.now(timezone.utc) > reset["expires_at"]:
        await db.password_resets.delete_many({"email": data.email.lower()})
        raise HTTPException(status_code=400, detail="Código expirado")
    
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")
    
    # Update password
    password_hash = hash_password(data.new_password)
    await db.users.update_one(
        {"email": data.email.lower()},
        {"$set": {"password_hash": password_hash}}
    )
    
    # Clean up
    await db.password_resets.delete_many({"email": data.email.lower()})
    
    return {"message": "Contraseña actualizada exitosamente"}

@api_router.put("/auth/profile")
async def update_profile(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user)
):
    """Update user profile"""
    update_data = {}
    
    if data.name:
        update_data["name"] = data.name
    
    if data.phone:
        if not validate_phone(data.phone):
            raise HTTPException(status_code=400, detail="Número de teléfono inválido")
        phone_cleaned = re.sub(r'[\s\-\(\)]', '', data.phone)
        # Check if phone is used by another user
        existing = await db.users.find_one({
            "phone": phone_cleaned,
            "user_id": {"$ne": current_user.user_id}
        })
        if existing:
            raise HTTPException(status_code=400, detail="Este teléfono ya está registrado")
        update_data["phone"] = phone_cleaned
    
    if update_data:
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$set": update_data}
        )
    
    # Return updated user
    updated_user = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, "password_hash": 0}
    )
    return updated_user

# =============================================================================
# DELETE ACCOUNT ENDPOINT
# =============================================================================

@api_router.delete("/auth/account")
async def delete_account(
    current_user: User = Depends(get_current_user)
):
    """Delete user account and all associated data"""
    user_id = current_user.user_id
    
    try:
        # Delete all user's matches
        await db.matches.delete_many({"user_id": user_id})
        
        # Delete all user's players
        await db.players.delete_many({"user_id": user_id})
        
        # Delete all user's points (through matches)
        # Points are associated with matches, so we need to clean them too
        
        # Delete share permissions (both as owner and viewer)
        await db.share_permissions.delete_many({"owner_user_id": user_id})
        await db.share_permissions.delete_many({"viewer_user_id": user_id})
        
        # Delete all sessions
        await db.sessions.delete_many({"user_id": user_id})
        
        # Finally, delete the user
        await db.users.delete_one({"user_id": user_id})
        
        logger.info(f"Account deleted: {user_id}")
        
        return {"message": "Cuenta eliminada exitosamente"}
    except Exception as e:
        logger.error(f"Error deleting account {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al eliminar la cuenta")

# =============================================================================
# SHARING ENDPOINTS
# =============================================================================

@api_router.post("/share")
async def share_with_user(
    data: ShareRequest,
    current_user: User = Depends(get_current_user)
):
    """Share all matches with another user"""
    identifier = data.identifier.lower().strip()
    
    # Find user by email or phone
    target_user = await db.users.find_one({
        "$or": [
            {"email": identifier},
            {"phone": re.sub(r'[\s\-\(\)]', '', identifier)}
        ]
    })
    
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if target_user["user_id"] == current_user.user_id:
        raise HTTPException(status_code=400, detail="No puedes compartir contigo mismo")
    
    # Check if already shared
    existing = await db.share_permissions.find_one({
        "owner_user_id": current_user.user_id,
        "viewer_user_id": target_user["user_id"]
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Ya compartes con este usuario")
    
    # Create share permission
    permission = {
        "permission_id": f"perm_{uuid.uuid4().hex[:12]}",
        "owner_user_id": current_user.user_id,
        "viewer_user_id": target_user["user_id"],
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.share_permissions.insert_one(permission)
    logger.info(f"Share created: {current_user.user_id} -> {target_user['user_id']}")
    
    return {
        "message": "Partidos compartidos exitosamente",
        "shared_with": {
            "user_id": target_user["user_id"],
            "name": target_user["name"],
            "email": target_user["email"]
        }
    }

@api_router.delete("/share/{user_id}")
async def unshare_with_user(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Stop sharing with a user"""
    result = await db.share_permissions.delete_one({
        "owner_user_id": current_user.user_id,
        "viewer_user_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Permiso no encontrado")
    
    return {"message": "Permiso eliminado"}

@api_router.get("/share/my-shares")
async def get_my_shares(current_user: User = Depends(get_current_user)):
    """Get list of users I share with"""
    permissions = await db.share_permissions.find(
        {"owner_user_id": current_user.user_id},
        {"_id": 0}
    ).to_list(100)
    
    # Get user details
    viewer_ids = [p["viewer_user_id"] for p in permissions]
    users = await db.users.find(
        {"user_id": {"$in": viewer_ids}},
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    
    users_dict = {u["user_id"]: u for u in users}
    
    result = []
    for p in permissions:
        user_data = users_dict.get(p["viewer_user_id"], {})
        result.append({
            "permission_id": p["permission_id"],
            "user_id": p["viewer_user_id"],
            "name": user_data.get("name", "Usuario"),
            "email": user_data.get("email", ""),
            "created_at": p["created_at"].isoformat() if isinstance(p["created_at"], datetime) else p["created_at"]
        })
    
    return result

@api_router.get("/share/shared-with-me")
async def get_shared_with_me(current_user: User = Depends(get_current_user)):
    """Get list of users who share with me"""
    permissions = await db.share_permissions.find(
        {"viewer_user_id": current_user.user_id},
        {"_id": 0}
    ).to_list(100)
    
    # Get user details
    owner_ids = [p["owner_user_id"] for p in permissions]
    users = await db.users.find(
        {"user_id": {"$in": owner_ids}},
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    
    users_dict = {u["user_id"]: u for u in users}
    
    result = []
    for p in permissions:
        user_data = users_dict.get(p["owner_user_id"], {})
        result.append({
            "permission_id": p["permission_id"],
            "user_id": p["owner_user_id"],
            "name": user_data.get("name", "Usuario"),
            "email": user_data.get("email", ""),
            "created_at": p["created_at"].isoformat() if isinstance(p["created_at"], datetime) else p["created_at"]
        })
    
    return result

@api_router.get("/share/user/{user_id}/matches")
async def get_shared_user_matches(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get matches from a user who shared with me"""
    # Check if user shared with me
    permission = await db.share_permissions.find_one({
        "owner_user_id": user_id,
        "viewer_user_id": current_user.user_id
    })
    
    if not permission:
        raise HTTPException(status_code=403, detail="Este usuario no ha compartido contigo")
    
    # Get matches
    matches = await db.matches.find(
        {"user_id": user_id, "status": "finished"},
        {"_id": 0}
    ).sort("date", -1).to_list(1000)
    
    return matches

@api_router.get("/share/user/{user_id}/matches/{match_id}")
async def get_shared_match_detail(
    user_id: str,
    match_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get detailed match data from a shared user"""
    # Check if user shared with me
    permission = await db.share_permissions.find_one({
        "owner_user_id": user_id,
        "viewer_user_id": current_user.user_id
    })
    
    if not permission:
        raise HTTPException(status_code=403, detail="Este usuario no ha compartido contigo")
    
    # Get match
    match = await db.matches.find_one(
        {"match_id": match_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")
    
    # Get points
    points = await db.points.find(
        {"match_id": match_id},
        {"_id": 0}
    ).sort("game_number", 1).sort("point_number", 1).to_list(1000)
    
    # Get game results
    game_results = await db.game_results.find(
        {"match_id": match_id},
        {"_id": 0}
    ).sort("game_number", 1).to_list(100)
    
    # Get players info
    player_ids = [match["player1_id"], match["player2_id"]]
    players = await db.players.find(
        {"player_id": {"$in": player_ids}},
        {"_id": 0}
    ).to_list(10)
    
    return {
        "match": match,
        "points": points,
        "game_results": game_results,
        "players": players
    }

@api_router.get("/users/search")
async def search_users(
    q: str,
    current_user: User = Depends(get_current_user)
):
    """Search users by email or phone"""
    if len(q) < 3:
        raise HTTPException(status_code=400, detail="Busca con al menos 3 caracteres")
    
    query = q.lower().strip()
    
    users = await db.users.find(
        {
            "$or": [
                {"email": {"$regex": query, "$options": "i"}},
                {"phone": {"$regex": re.sub(r'[\s\-\(\)]', '', query)}}
            ],
            "user_id": {"$ne": current_user.user_id}
        },
        {"_id": 0, "password_hash": 0}
    ).limit(10).to_list(10)
    
    return users

# =============================================================================
# PLAYERS ENDPOINTS
# =============================================================================

@api_router.get("/players")
async def get_players(current_user: User = Depends(get_current_user)):
    """Get all players for current user"""
    players = await db.players.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).to_list(1000)
    return players

@api_router.post("/players")
async def create_player(
    player_data: PlayerCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new player"""
    player = Player(
        user_id=current_user.user_id,
        nickname=player_data.nickname,
        category=player_data.category,
        gender=player_data.gender,
        country=player_data.country,
        city=player_data.city,
        club=player_data.club,
        is_mine=player_data.is_mine,
    )
    
    await db.players.insert_one(player.dict())
    return player

@api_router.get("/players/{player_id}")
async def get_player(
    player_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific player"""
    player = await db.players.find_one(
        {"player_id": player_id, "user_id": current_user.user_id},
        {"_id": 0}
    )
    
    if not player:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    
    return player

# =============================================================================
# MATCHES ENDPOINTS
# =============================================================================

@api_router.get("/matches")
async def get_matches(
    current_user: User = Depends(get_current_user),
    status: Optional[str] = None
):
    """Get all matches for current user"""
    query = {"user_id": current_user.user_id}
    if status:
        query["status"] = status
    
    matches = await db.matches.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return matches

@api_router.get("/matches/{match_id}")
async def get_match(
    match_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific match with all its data"""
    match = await db.matches.find_one(
        {"match_id": match_id, "user_id": current_user.user_id},
        {"_id": 0}
    )
    
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")
    
    # Get points
    points = await db.points.find(
        {"match_id": match_id},
        {"_id": 0}
    ).sort("game_number", 1).sort("point_number", 1).to_list(1000)
    
    # Get game results
    game_results = await db.game_results.find(
        {"match_id": match_id},
        {"_id": 0}
    ).sort("game_number", 1).to_list(100)
    
    # Get players info
    player_ids = [match["player1_id"], match["player2_id"]]
    players = await db.players.find(
        {"player_id": {"$in": player_ids}},
        {"_id": 0}
    ).to_list(10)
    
    return {
        "match": match,
        "points": points,
        "game_results": game_results,
        "players": players
    }

# =============================================================================
# TOURNAMENT ENDPOINTS
# =============================================================================

@api_router.post("/tournaments")
async def create_tournament(
    tournament_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Create a new tournament"""
    name = tournament_data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre del torneo es obligatorio")
    
    # Check if tournament already exists for this user
    existing = await db.tournaments.find_one(
        {"user_id": current_user.user_id, "name": name}
    )
    if existing:
        return {"tournament_id": existing["tournament_id"], "name": name, "already_exists": True}
    
    tournament_id = f"tournament_{uuid.uuid4().hex[:12]}"
    tournament = {
        "tournament_id": tournament_id,
        "user_id": current_user.user_id,
        "name": name,
        "created_at": datetime.now(timezone.utc),
    }
    await db.tournaments.insert_one(tournament)
    return {"tournament_id": tournament_id, "name": name, "user_id": current_user.user_id}

@api_router.get("/tournaments")
async def get_tournaments(current_user: User = Depends(get_current_user)):
    """Get all tournaments for the current user"""
    tournaments = await db.tournaments.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("name", 1).to_list(500)
    return tournaments

# =============================================================================
# SYNC ENDPOINTS
# =============================================================================

@api_router.post("/sync")
async def sync_data(
    sync_data: SyncData,
    current_user: User = Depends(get_current_user)
):
    """Sync local data to cloud"""
    result = {
        "players_synced": 0,
        "matches_synced": 0,
        "points_synced": 0,
        "game_results_synced": 0,
        "player_mappings": {},  # local_id -> server_id
        "match_mappings": {}    # local_id -> server_id
    }
    
    # Sync players first (needed for match references)
    for player_data in sync_data.players:
        # Check if player already exists by nickname for this user
        existing = await db.players.find_one({
            "user_id": current_user.user_id,
            "nickname": player_data.nickname
        }, {"_id": 0})
        
        if existing:
            result["player_mappings"][player_data.local_id] = existing["player_id"]
        else:
            player = Player(
                user_id=current_user.user_id,
                nickname=player_data.nickname,
                category=player_data.category,
                gender=player_data.gender,
                country=player_data.country,
                city=player_data.city,
                club=player_data.club,
                is_mine=player_data.is_mine,
            )
            await db.players.insert_one(player.dict())
            result["player_mappings"][player_data.local_id] = player.player_id
            result["players_synced"] += 1
    
    # Sync matches
    for match_data in sync_data.matches:
        # Map local player IDs to server IDs
        player1_id = result["player_mappings"].get(match_data.player1_local_id)
        player2_id = result["player_mappings"].get(match_data.player2_local_id)
        my_player_id = result["player_mappings"].get(match_data.my_player_local_id)
        winner_id = result["player_mappings"].get(match_data.winner_local_id) if match_data.winner_local_id else None
        
        if not player1_id or not player2_id or not my_player_id:
            logger.warning(f"Skipping match - missing player mappings")
            continue
        
        # Check if match already exists
        existing = await db.matches.find_one({
            "user_id": current_user.user_id,
            "local_id": match_data.local_id
        }, {"_id": 0})
        
        if existing:
            result["match_mappings"][match_data.local_id] = existing["match_id"]
            # Update existing match
            await db.matches.update_one(
                {"match_id": existing["match_id"]},
                {"$set": {
                    "status": match_data.status,
                    "winner_id": winner_id,
                    "player1_games": match_data.player1_games,
                    "player2_games": match_data.player2_games,
                    "current_game": match_data.current_game
                }}
            )
        else:
            match = Match(
                user_id=current_user.user_id,
                local_id=match_data.local_id,
                player1_id=player1_id,
                player2_id=player2_id,
                my_player_id=my_player_id,
                best_of=match_data.best_of,
                winner_id=winner_id,
                date=parse_date_safe(match_data.date),
                status=match_data.status,
                current_game=match_data.current_game,
                player1_games=match_data.player1_games,
                player2_games=match_data.player2_games,
                tournament_name=match_data.tournament_name,
                match_date=match_data.match_date
            )
            await db.matches.insert_one(match.dict())
            result["match_mappings"][match_data.local_id] = match.match_id
            result["matches_synced"] += 1
    
    # Sync points
    for point_data in sync_data.points:
        match_id = result["match_mappings"].get(point_data.match_local_id)
        winner_player_id = result["player_mappings"].get(point_data.winner_player_local_id)
        
        if not match_id or not winner_player_id:
            continue
        
        # Check if point exists
        existing = await db.points.find_one({
            "match_id": match_id,
            "game_number": point_data.game_number,
            "point_number": point_data.point_number
        })
        
        if not existing:
            point = Point(
                match_id=match_id,
                local_id=point_data.local_id,
                position_x=point_data.position_x,
                position_y=point_data.position_y,
                winner_player_id=winner_player_id,
                reason=point_data.reason,
                my_player_pos_x=point_data.my_player_pos_x,
                my_player_pos_y=point_data.my_player_pos_y,
                opponent_pos_x=point_data.opponent_pos_x,
                opponent_pos_y=point_data.opponent_pos_y,
                game_number=point_data.game_number,
                point_number=point_data.point_number,
                player1_score=point_data.player1_score,
                player2_score=point_data.player2_score
            )
            await db.points.insert_one(point.dict())
            result["points_synced"] += 1
    
    # Sync game results
    for gr_data in sync_data.game_results:
        match_id = result["match_mappings"].get(gr_data.match_local_id)
        winner_id = result["player_mappings"].get(gr_data.winner_local_id) if gr_data.winner_local_id else None
        
        if not match_id:
            continue
        
        existing = await db.game_results.find_one({
            "match_id": match_id,
            "game_number": gr_data.game_number
        })
        
        if not existing:
            game_result = GameResult(
                match_id=match_id,
                game_number=gr_data.game_number,
                player1_score=gr_data.player1_score,
                player2_score=gr_data.player2_score,
                winner_id=winner_id
            )
            await db.game_results.insert_one(game_result.dict())
            result["game_results_synced"] += 1
    
    return result

@api_router.get("/sync/status")
async def get_sync_status(current_user: User = Depends(get_current_user)):
    """Get sync status for user"""
    players_count = await db.players.count_documents({"user_id": current_user.user_id})
    matches_count = await db.matches.count_documents({"user_id": current_user.user_id})
    
    # Get player names for verification
    players = await db.players.find(
        {"user_id": current_user.user_id},
        {"_id": 0, "nickname": 1, "player_id": 1}
    ).to_list(100)
    
    # Get match summaries for verification
    matches = await db.matches.find(
        {"user_id": current_user.user_id},
        {"_id": 0, "match_id": 1, "status": 1, "player1_id": 1, "player2_id": 1, "date": 1}
    ).to_list(100)
    
    return {
        "players_in_cloud": players_count,
        "matches_in_cloud": matches_count,
        "players": players,
        "matches_summary": matches
    }

# =============================================================================
# ANALYSIS ENDPOINTS
# =============================================================================

@api_router.get("/analysis/head-to-head")
async def get_head_to_head(
    player1_id: str,
    player2_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get head-to-head analysis between two players"""
    query = {
        "user_id": current_user.user_id,
        "status": "finished",
        "$or": [
            {"player1_id": player1_id, "player2_id": player2_id},
            {"player1_id": player2_id, "player2_id": player1_id}
        ]
    }
    
    if date_from:
        query["date"] = {"$gte": parse_date_safe(date_from)}
    if date_to:
        if "date" in query:
            query["date"]["$lte"] = parse_date_safe(date_to)
        else:
            query["date"] = {"$lte": parse_date_safe(date_to)}
    
    matches = await db.matches.find(query, {"_id": 0}).to_list(1000)
    
    # Get all points from these matches
    match_ids = [m["match_id"] for m in matches]
    points = await db.points.find(
        {"match_id": {"$in": match_ids}},
        {"_id": 0}
    ).to_list(10000)
    
    return {
        "matches_count": len(matches),
        "points_count": len(points),
        "matches": matches,
        "points": points
    }

# =============================================================================
# SHADOW TRAINING ROUTINES
# =============================================================================

@api_router.post("/shadow-routines")
async def create_shadow_routine(
    data: ShadowRoutineCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new shadow routine for the current user"""
    routine = ShadowRoutine(
        user_id=current_user.user_id,
        local_id=data.local_id,
        name=data.name,
        date=data.date,
        zone_mode=data.zone_mode,
        interval_time=data.interval_time,
        set_duration=data.set_duration,
        rest_duration=data.rest_duration,
        number_of_sets=data.number_of_sets,
        completed_sets=data.completed_sets,
        total_zones_visited=data.total_zones_visited,
    )
    doc = routine.dict()
    await db.shadow_routines.insert_one(doc)
    return {
        "routine_id": routine.routine_id,
        "user_id": routine.user_id,
        "created_at": routine.created_at.isoformat(),
    }

@api_router.get("/shadow-routines")
async def get_shadow_routines(current_user: User = Depends(get_current_user)):
    """List all shadow routines for the current user, newest first"""
    routines = await db.shadow_routines.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("date", -1).to_list(1000)
    # Ensure datetimes are serializable
    for r in routines:
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = r["created_at"].isoformat()
    return routines

@api_router.delete("/shadow-routines/{routine_id}")
async def delete_shadow_routine(
    routine_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a shadow routine owned by the current user"""
    result = await db.shadow_routines.delete_one({
        "routine_id": routine_id,
        "user_id": current_user.user_id,
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")
    return {"deleted": True, "routine_id": routine_id}

# =============================================================================
# REFEREE MATCHES (Modo Árbitro)
# =============================================================================

@api_router.post("/referee-matches")
async def create_referee_match(
    data: RefereeMatchCreate,
    current_user: User = Depends(get_current_user)
):
    """Crear/actualizar un partido arbitrado del usuario"""
    match = RefereeMatch(
        user_id=current_user.user_id,
        local_id=data.local_id,
        player1_name=data.player1_name,
        player2_name=data.player2_name,
        best_of=data.best_of,
        player1_games=data.player1_games,
        player2_games=data.player2_games,
        games_detail=data.games_detail,
        status=data.status,
        winner_name=data.winner_name,
        date=data.date,
        duration_seconds=data.duration_seconds,
    )
    doc = match.dict()
    await db.referee_matches.insert_one(doc)
    return {
        "referee_id": match.referee_id,
        "user_id": match.user_id,
        "created_at": match.created_at.isoformat(),
    }

@api_router.get("/referee-matches")
async def get_referee_matches(current_user: User = Depends(get_current_user)):
    """Lista los partidos arbitrados del usuario, más recientes primero"""
    matches = await db.referee_matches.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("date", -1).to_list(1000)
    for m in matches:
        if isinstance(m.get("created_at"), datetime):
            m["created_at"] = m["created_at"].isoformat()
    return matches

@api_router.delete("/referee-matches/{referee_id}")
async def delete_referee_match(
    referee_id: str,
    current_user: User = Depends(get_current_user)
):
    """Borra un partido arbitrado del usuario"""
    result = await db.referee_matches.delete_one({
        "referee_id": referee_id,
        "user_id": current_user.user_id,
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Partido no encontrado")
    return {"deleted": True, "referee_id": referee_id}

# =============================================================================
# SHADOW PRESETS (user-saved zone combinations)
# =============================================================================

class ShadowPresetCreate(BaseModel):
    name: str
    zone_mode: int   # 6 o 12
    zone_ids: List[int]

@api_router.get("/shadow-presets")
async def list_shadow_presets(current_user: User = Depends(get_current_user)):
    """Lista los presets personalizados del usuario."""
    docs = await db.shadow_presets.find(
        {"user_id": current_user.user_id},
        {"_id": 0},
    ).sort("created_at", -1).to_list(200)
    for d in docs:
        if isinstance(d.get("created_at"), datetime):
            d["created_at"] = d["created_at"].isoformat()
    return docs

@api_router.post("/shadow-presets")
async def create_shadow_preset(
    data: ShadowPresetCreate,
    current_user: User = Depends(get_current_user),
):
    """Crea un preset personalizado para el usuario."""
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nombre requerido")
    if data.zone_mode not in (6, 12):
        raise HTTPException(status_code=400, detail="zone_mode debe ser 6 o 12")
    if not data.zone_ids:
        raise HTTPException(status_code=400, detail="Selecciona al menos una zona")

    preset = {
        "preset_id": f"sp_{uuid.uuid4().hex[:12]}",
        "user_id": current_user.user_id,
        "name": name[:60],
        "zone_mode": data.zone_mode,
        "zone_ids": sorted(set(int(z) for z in data.zone_ids)),
        "created_at": datetime.now(timezone.utc),
    }
    await db.shadow_presets.insert_one(preset)
    preset.pop("_id", None)
    preset["created_at"] = preset["created_at"].isoformat()
    return preset

@api_router.delete("/shadow-presets/{preset_id}")
async def delete_shadow_preset(
    preset_id: str,
    current_user: User = Depends(get_current_user),
):
    """Borra un preset personalizado del usuario."""
    result = await db.shadow_presets.delete_one({
        "preset_id": preset_id,
        "user_id": current_user.user_id,
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Preset no encontrado")
    return {"deleted": True, "preset_id": preset_id}

# =============================================================================
# BANNERS / ANNOUNCEMENTS (Admin-managed broadcasts shown on app open)
# =============================================================================

ADMIN_EMAILS = {"franciscoduransaa@gmail.com"}

def _require_admin(user: User) -> None:
    if (user.email or "").lower().strip() not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Acceso solo para admin")

class BannerCreate(BaseModel):
    title: Optional[str] = ""
    body: Optional[str] = ""
    media_url: Optional[str] = ""        # imagen o video o YouTube
    media_type: Optional[str] = "none"   # "image" | "video" | "youtube" | "none"
    action_url: Optional[str] = ""       # link externo opcional
    action_label: Optional[str] = ""     # texto del boton (ej "Ver mas")
    is_active: bool = True

class Banner(BannerCreate):
    banner_id: str = Field(default_factory=lambda: f"banner_{uuid.uuid4().hex[:12]}")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

@api_router.get("/banners/active")
async def get_active_banner():
    """PUBLIC. Devuelve el banner activo mas reciente (o null si no hay)."""
    doc = await db.banners.find_one(
        {"is_active": True},
        {"_id": 0},
        sort=[("updated_at", -1)],
    )
    if not doc:
        return None
    for k in ("created_at", "updated_at"):
        if isinstance(doc.get(k), datetime):
            doc[k] = doc[k].isoformat()
    return doc

@api_router.get("/banners")
async def list_banners(current_user: User = Depends(get_current_user)):
    """ADMIN. Lista todos los banners (activos e inactivos)."""
    _require_admin(current_user)
    docs = await db.banners.find({}, {"_id": 0}).sort("updated_at", -1).to_list(500)
    for d in docs:
        for k in ("created_at", "updated_at"):
            if isinstance(d.get(k), datetime):
                d[k] = d[k].isoformat()
    return docs

@api_router.post("/banners")
async def create_banner(
    data: BannerCreate,
    current_user: User = Depends(get_current_user),
):
    """ADMIN. Crea un nuevo banner."""
    _require_admin(current_user)
    banner = Banner(**data.dict())
    doc = banner.dict()
    await db.banners.insert_one(doc)
    doc.pop("_id", None)
    for k in ("created_at", "updated_at"):
        if isinstance(doc.get(k), datetime):
            doc[k] = doc[k].isoformat()
    return doc

@api_router.put("/banners/{banner_id}")
async def update_banner(
    banner_id: str,
    data: BannerCreate,
    current_user: User = Depends(get_current_user),
):
    """ADMIN. Actualiza un banner existente."""
    _require_admin(current_user)
    update_fields = data.dict()
    update_fields["updated_at"] = datetime.now(timezone.utc)
    result = await db.banners.update_one(
        {"banner_id": banner_id},
        {"$set": update_fields},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Banner no encontrado")
    doc = await db.banners.find_one({"banner_id": banner_id}, {"_id": 0})
    for k in ("created_at", "updated_at"):
        if isinstance(doc.get(k), datetime):
            doc[k] = doc[k].isoformat()
    return doc

@api_router.delete("/banners/{banner_id}")
async def delete_banner(
    banner_id: str,
    current_user: User = Depends(get_current_user),
):
    """ADMIN. Borra un banner."""
    _require_admin(current_user)
    result = await db.banners.delete_one({"banner_id": banner_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Banner no encontrado")
    return {"deleted": True, "banner_id": banner_id}

# =============================================================================
# FILE UPLOADS (GridFS) - usado por banners y otros features futuros
# =============================================================================

# Limite tamaño archivo en MB (Cloud Run request limit es 32 MB; M0 Atlas total 512 MB)
MAX_UPLOAD_MB = 10
ALLOWED_MIME_PREFIXES = ("image/", "video/")

@api_router.post("/banners/upload")
async def upload_banner_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """ADMIN. Sube una imagen o video y devuelve la URL publica para usarla en un banner."""
    _require_admin(current_user)

    content_type = (file.content_type or "").lower()
    if not any(content_type.startswith(p) for p in ALLOWED_MIME_PREFIXES):
        raise HTTPException(status_code=400, detail=f"Tipo de archivo no permitido: {content_type}")

    # Lectura del archivo con control de tamano
    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_UPLOAD_MB:
        raise HTTPException(
            status_code=413,
            detail=f"Archivo muy grande ({size_mb:.1f} MB). Limite: {MAX_UPLOAD_MB} MB",
        )

    # GridFS via motor - usar el primary db real (no el wrapper de replicacion)
    from motor.motor_asyncio import AsyncIOMotorGridFSBucket
    primary_db = getattr(db, '_primary', db)
    bucket = AsyncIOMotorGridFSBucket(primary_db, bucket_name="banner_files")
    file_id = await bucket.upload_from_stream(
        file.filename or "upload",
        contents,
        metadata={
            "content_type": content_type,
            "uploaded_by": current_user.user_id,
            "uploaded_at": datetime.now(timezone.utc),
        },
    )

    # Detectar media_type segun content-type
    if content_type.startswith("image/"):
        media_type = "image"
    elif content_type.startswith("video/"):
        media_type = "video"
    else:
        media_type = "none"

    file_id_str = str(file_id)
    return {
        "file_id": file_id_str,
        "url": f"/api/files/{file_id_str}",
        "content_type": content_type,
        "media_type": media_type,
        "size_bytes": len(contents),
    }

@api_router.get("/files/{file_id}")
async def serve_file(file_id: str):
    """PUBLIC. Sirve un archivo de GridFS por su id."""
    from motor.motor_asyncio import AsyncIOMotorGridFSBucket
    from bson import ObjectId
    from bson.errors import InvalidId

    try:
        oid = ObjectId(file_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="ID invalido")

    bucket = AsyncIOMotorGridFSBucket(getattr(db, '_primary', db), bucket_name="banner_files")
    try:
        stream = await bucket.open_download_stream(oid)
    except Exception:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    metadata = stream.metadata or {}
    content_type = metadata.get("content_type") or "application/octet-stream"

    async def iterfile():
        while True:
            chunk = await stream.readchunk()
            if not chunk:
                break
            yield chunk

    return StreamingResponse(
        iterfile(),
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Length": str(stream.length),
        },
    )

# =============================================================================
# BASIC ENDPOINTS
# =============================================================================

@api_router.get("/")
async def root():
    return {"message": "Squash Coach API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "ok"}

@api_router.delete("/user-data")
async def clear_user_data(current_user: User = Depends(get_current_user)):
    """Clear ALL data for the current user"""
    uid = current_user.user_id
    r_players = await db.players.delete_many({"user_id": uid})
    r_matches = await db.matches.delete_many({"user_id": uid})
    r_points = await db.points.delete_many({"user_id": uid})
    r_games = await db.game_results.delete_many({"user_id": uid})
    r_tournaments = await db.tournaments.delete_many({"user_id": uid})
    r_shadows = await db.shadow_routines.delete_many({"user_id": uid})
    return {
        "deleted": {
            "players": r_players.deleted_count,
            "matches": r_matches.deleted_count,
            "points": r_points.deleted_count,
            "game_results": r_games.deleted_count,
            "tournaments": r_tournaments.deleted_count,
            "shadow_routines": r_shadows.deleted_count
        }
    }

# Include the router in the main app
app.include_router(api_router)

# CORS - Permitir dominios específicos y cualquier origen
ALLOWED_ORIGINS = [
    "https://match-analysis-test.preview.emergentagent.com",
    "https://match-analysis-test.preview.emergentagent.com",
    "https://lev.jsb.mybluehost.me",
    "http://localhost:3000",
    "http://localhost:8081",
    "http://localhost:19006",
]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.preview\.emergentagent\.com",  # Permitir todos los subdominios de preview
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()





# Temporary endpoint to download server.py
@app.get("/api/download-server-py")
async def download_server_py():
    import os
    file_path = os.path.join(os.path.dirname(__file__), "server.py")
    return FileResponse(file_path, media_type="text/plain", filename="server.py")

@app.get("/api/download-dockerfile")
async def download_dockerfile():
    import os
    file_path = os.path.join(os.path.dirname(__file__), "Dockerfile")
    return FileResponse(file_path, media_type="text/plain", filename="Dockerfile")

@app.get("/api/download-requirements-cloudrun")
async def download_requirements_cloudrun():
    import os
    file_path = os.path.join(os.path.dirname(__file__), "requirements-cloudrun.txt")
    return FileResponse(file_path, media_type="text/plain", filename="requirements-cloudrun.txt")

@app.get("/api/download-infra-backup")
async def download_infra_backup():
    import os
    file_path = "/app/memory/INFRA_BACKUP.md"
    return FileResponse(file_path, media_type="text/markdown", filename="SquashCoach_INFRA_BACKUP.md")

@app.get("/api/download-banner-modal")
async def download_banner_modal():
    return FileResponse("/app/frontend/src/components/BannerModal.tsx", media_type="text/plain", filename="BannerModal.tsx")

@app.get("/api/download-admin-banners")
async def download_admin_banners():
    return FileResponse("/app/frontend/app/admin-banners.tsx", media_type="text/plain", filename="admin-banners.tsx")

@app.get("/api/download-layout")
async def download_layout():
    return FileResponse("/app/frontend/app/_layout.tsx", media_type="text/plain", filename="_layout.tsx")

@app.get("/api/download-login")
async def download_login():
    return FileResponse("/app/frontend/app/login.tsx", media_type="text/plain", filename="login.tsx")

@app.get("/api/download-settings")
async def download_settings():
    return FileResponse("/app/frontend/app/settings.tsx", media_type="text/plain", filename="settings.tsx")

@app.get("/api/download-app-json")
async def download_app_json():
    return FileResponse("/app/frontend/app.json", media_type="application/json", filename="app.json")

@app.get("/api/download-eas-json")
async def download_eas_json():
    return FileResponse("/app/frontend/eas.json", media_type="application/json", filename="eas.json")

@app.get("/api/download-timer")
async def download_timer():
    return FileResponse("/app/frontend/app/timer.tsx", media_type="text/plain", filename="timer.tsx")

@app.get("/api/download-index")
async def download_index():
    return FileResponse("/app/frontend/app/index.tsx", media_type="text/plain", filename="index.tsx")

@app.get("/api/download-package-json")
async def download_package_json():
    return FileResponse("/app/frontend/package.json", media_type="application/json", filename="package.json")

@app.get("/api/download-beep")
async def download_beep():
    return FileResponse("/app/frontend/assets/sounds/beep.wav", media_type="audio/wav", filename="beep.wav")

@app.get("/api/download-beep-long")
async def download_beep_long():
    return FileResponse("/app/frontend/assets/sounds/beep_long.wav", media_type="audio/wav", filename="beep_long.wav")

@app.get("/api/download-rhythm")
async def download_rhythm():
    return FileResponse("/app/frontend/app/rhythm.tsx", media_type="text/plain", filename="rhythm.tsx")

@app.get("/api/download-sound/{name}")
async def download_sound(name: str):
    allowed = {"tick", "accent", "kick", "snare", "hihat", "beep", "beep_long"}
    if name not in allowed:
        raise HTTPException(status_code=404, detail="Sound not found")
    return FileResponse(f"/app/frontend/assets/sounds/{name}.wav", media_type="audio/wav", filename=f"{name}.wav")

@app.get("/api/download-i18n/{lang}")
async def download_i18n(lang: str):
    if lang not in {"en", "es"}:
        raise HTTPException(status_code=404, detail="Language not found")
    return FileResponse(f"/app/frontend/src/i18n/{lang}.json", media_type="application/json", filename=f"{lang}.json")

@app.get("/api/download-shadow-training")
async def download_shadow_training():
    return FileResponse("/app/frontend/app/shadow-training.tsx", media_type="text/plain", filename="shadow-training.tsx")

@app.get("/api/download-eas-json")
async def download_eas_json():
    return FileResponse("/app/frontend/eas.json", media_type="application/json", filename="eas.json")

@app.get("/api/download-app-json")
async def download_app_json():
    return FileResponse("/app/frontend/app.json", media_type="application/json", filename="app.json")
