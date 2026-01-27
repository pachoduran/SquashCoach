from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import JSONResponse
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
from datetime import datetime, timezone

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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# =============================================================================
# MODELS
# =============================================================================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
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
    expires_at = datetime.now(timezone.utc).replace(day=datetime.now().day + 7)
    
    session = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    }
    
    # Remove old sessions for this user
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one(session)
    
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

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
