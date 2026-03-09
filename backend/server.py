from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import JSONResponse, FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import hashlib
import secrets
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'squash_coach')]

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
    reason: str
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
        raise HTTPException(status_code=401, detail="Sesión inválida")
    
    # Check expiry
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Sesión expirada")
    
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
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
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
        max_age=7 * 24 * 60 * 60  # 7 days
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
    
    # Create session
    session_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
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
        max_age=7 * 24 * 60 * 60
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
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
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
        max_age=7 * 24 * 60 * 60
    )
    
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user["name"],
        "phone": user.get("phone"),
        "picture": user.get("picture"),
        "session_token": session_token
    }

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
        nickname=player_data.nickname
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
                nickname=player_data.nickname
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
                date=datetime.fromisoformat(match_data.date.replace('Z', '+00:00')),
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
    
    return {
        "players_in_cloud": players_count,
        "matches_in_cloud": matches_count
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
        query["date"] = {"$gte": datetime.fromisoformat(date_from)}
    if date_to:
        if "date" in query:
            query["date"]["$lte"] = datetime.fromisoformat(date_to)
        else:
            query["date"] = {"$lte": datetime.fromisoformat(date_to)}
    
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
# BASIC ENDPOINTS
# =============================================================================

@api_router.get("/")
async def root():
    return {"message": "Squash Coach API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "ok"}

# Include the router in the main app
app.include_router(api_router)

# CORS - Permitir dominios específicos y cualquier origen
ALLOWED_ORIGINS = [
    "https://player-sync-test.preview.emergentagent.com",
    "https://player-sync-test.preview.emergentagent.com",
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
