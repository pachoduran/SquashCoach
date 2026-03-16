"""
Squash Coach API Backend Tests
Tests all CRUD endpoints with authentication, player fields, sync flow, and auth endpoints

Endpoints tested:
- POST /api/auth/register - creates user and returns session token
- POST /api/auth/login - authenticates email user
- POST /api/auth/forgot-password - creates reset code
- POST /api/auth/reset-password - resets password with code
- POST /api/players - creates player with new fields (category, gender, country, city, club, is_mine)
- GET /api/players - returns all players for user with new fields
- POST /api/sync - syncs data with new player fields
- GET /api/sync/status - returns sync status
- GET /api/matches/{match_id} - returns match with points and game results
- DELETE /api/auth/account - deletes user account and all data
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://match-analysis-test.preview.emergentagent.com').rstrip('/')


class TestHealthCheck:
    """Health check endpoint test"""
    
    def test_health_endpoint(self):
        """Test /api/health returns OK"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print("✅ Health check passed")


class TestAuthRegister:
    """POST /api/auth/register - creates user and returns session token"""
    
    def test_register_success(self):
        """Register a new user with valid email and password"""
        unique_email = f"TEST_register_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123456",
            "name": "Test Register User"
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "session_token" in data, "Response must contain session_token"
        assert "user_id" in data, "Response must contain user_id"
        assert "email" in data, "Response must contain email"
        assert "name" in data, "Response must contain name"
        assert data["email"] == unique_email.lower()
        assert data["name"] == "Test Register User"
        assert len(data["session_token"]) > 0
        print(f"✅ User registered: {unique_email}")
    
    def test_register_invalid_email(self):
        """Registration with invalid email should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "invalid-email",
            "password": "Test123456",
            "name": "Invalid Email User"
        })
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print("✅ Invalid email rejected correctly")
    
    def test_register_short_password(self):
        """Registration with password < 6 chars should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"TEST_short_{uuid.uuid4().hex[:8]}@example.com",
            "password": "12345",
            "name": "Short Password User"
        })
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print("✅ Short password rejected correctly")
    
    def test_register_duplicate_email(self):
        """Registration with existing email should fail"""
        unique_email = f"TEST_dup_{uuid.uuid4().hex[:8]}@example.com"
        
        # First registration
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123456",
            "name": "First User"
        })
        assert response.status_code == 200
        
        # Second registration with same email
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123456",
            "name": "Second User"
        })
        assert response.status_code == 400
        print("✅ Duplicate email rejected correctly")


class TestAuthLogin:
    """POST /api/auth/login - authenticates email user"""
    
    @pytest.fixture(autouse=True)
    def setup_test_user(self):
        """Create a test user for login tests"""
        self.test_email = f"TEST_login_{uuid.uuid4().hex[:8]}@example.com"
        self.test_password = "TestLogin123456"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "password": self.test_password,
            "name": "Login Test User"
        })
        assert response.status_code == 200
        self.user_data = response.json()
    
    def test_login_success(self):
        """Login with valid credentials returns session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.test_email,
            "password": self.test_password
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "session_token" in data, "Response must contain session_token"
        assert "user_id" in data, "Response must contain user_id"
        assert "email" in data, "Response must contain email"
        assert "name" in data, "Response must contain name"
        assert data["email"] == self.test_email.lower()
        assert len(data["session_token"]) > 0
        print(f"✅ Login successful for {self.test_email}")
    
    def test_login_wrong_password(self):
        """Login with wrong password should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.test_email,
            "password": "WrongPassword123"
        })
        assert response.status_code == 401
        print("✅ Wrong password rejected correctly")
    
    def test_login_nonexistent_email(self):
        """Login with non-existent email should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "Test123456"
        })
        assert response.status_code == 401
        print("✅ Non-existent email rejected correctly")


class TestAuthForgotPassword:
    """POST /api/auth/forgot-password - creates reset code"""
    
    def test_forgot_password_existing_user(self):
        """Forgot password for existing user returns success message"""
        # Create a test user first
        unique_email = f"TEST_forgot_{uuid.uuid4().hex[:8]}@example.com"
        requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123456",
            "name": "Forgot Password User"
        })
        
        # Request password reset
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": unique_email
        })
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("✅ Forgot password request successful")
    
    def test_forgot_password_nonexistent_user(self):
        """Forgot password for non-existent user still returns success (security)"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": "nonexistent@example.com"
        })
        # Should still return 200 to prevent email enumeration
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("✅ Forgot password for non-existent user handled securely")


class TestAuthResetPassword:
    """POST /api/auth/reset-password - resets password with code"""
    
    def test_reset_password_invalid_code(self):
        """Reset password with invalid code should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "email": "test@example.com",
            "code": "000000",
            "new_password": "NewPassword123456"
        })
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print("✅ Invalid reset code rejected correctly")
    
    def test_reset_password_short_password(self):
        """Reset password with short password should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "email": "test@example.com",
            "code": "123456",  # Invalid code anyway
            "new_password": "12345"
        })
        assert response.status_code == 400
        print("✅ Short new password rejected correctly")


class TestPlayersWithNewFields:
    """
    POST /api/players - creates player with new fields
    GET /api/players - returns all players for user with new fields
    New fields: category, gender, country, city, club, is_mine
    """
    
    @pytest.fixture(autouse=True)
    def setup_authenticated_user(self):
        """Create and authenticate a test user"""
        unique_email = f"TEST_players_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123456",
            "name": "Players Test User"
        })
        assert response.status_code == 200
        self.token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_create_player_basic(self):
        """Create a player with only nickname"""
        response = requests.post(f"{BASE_URL}/api/players", 
            json={"nickname": "TEST_BasicPlayer"},
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "player_id" in data
        assert "nickname" in data
        assert data["nickname"] == "TEST_BasicPlayer"
        print("✅ Basic player created")
    
    def test_create_player_with_all_new_fields(self):
        """Create a player with all new expanded fields"""
        player_data = {
            "nickname": "TEST_FullPlayer",
            "category": "A",
            "gender": "male",
            "country": "Argentina",
            "city": "Buenos Aires",
            "club": "Squash Club BA",
            "is_mine": 1
        }
        response = requests.post(f"{BASE_URL}/api/players", 
            json=player_data,
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify all fields are present and correct
        assert data["nickname"] == "TEST_FullPlayer"
        assert data["category"] == "A"
        assert data["gender"] == "male"
        assert data["country"] == "Argentina"
        assert data["city"] == "Buenos Aires"
        assert data["club"] == "Squash Club BA"
        assert data["is_mine"] == 1
        assert "player_id" in data
        assert "created_at" in data
        print("✅ Player with all new fields created")
        return data
    
    def test_get_players_returns_new_fields(self):
        """GET /api/players returns players with all new fields"""
        # Create a player with new fields first
        player_data = {
            "nickname": "TEST_GetFieldsPlayer",
            "category": "B",
            "gender": "female",
            "country": "Mexico",
            "city": "CDMX",
            "club": "Club Mexico",
            "is_mine": 0
        }
        create_response = requests.post(f"{BASE_URL}/api/players", 
            json=player_data,
            headers=self.headers
        )
        assert create_response.status_code == 200
        created_player = create_response.json()
        
        # GET all players
        response = requests.get(f"{BASE_URL}/api/players", headers=self.headers)
        assert response.status_code == 200
        players = response.json()
        
        assert isinstance(players, list)
        assert len(players) >= 1
        
        # Find the created player
        found_player = None
        for p in players:
            if p["player_id"] == created_player["player_id"]:
                found_player = p
                break
        
        assert found_player is not None, "Created player should be in list"
        
        # Verify all new fields are returned
        assert found_player["nickname"] == "TEST_GetFieldsPlayer"
        assert found_player["category"] == "B"
        assert found_player["gender"] == "female"
        assert found_player["country"] == "Mexico"
        assert found_player["city"] == "CDMX"
        assert found_player["club"] == "Club Mexico"
        assert found_player["is_mine"] == 0
        print("✅ GET players returns all new fields")
    
    def test_create_player_without_auth(self):
        """Creating player without auth should fail"""
        response = requests.post(f"{BASE_URL}/api/players", 
            json={"nickname": "NoAuthPlayer"}
        )
        assert response.status_code == 401
        print("✅ Unauthenticated player creation rejected")


class TestSyncWithNewFields:
    """
    POST /api/sync - syncs data with new player fields
    GET /api/sync/status - returns sync status
    """
    
    @pytest.fixture(autouse=True)
    def setup_authenticated_user(self):
        """Create and authenticate a test user"""
        unique_email = f"TEST_sync_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123456",
            "name": "Sync Test User"
        })
        assert response.status_code == 200
        self.token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_sync_players_with_new_fields(self):
        """Sync players with all new fields"""
        sync_data = {
            "players": [
                {
                    "nickname": "TEST_SyncPlayer1",
                    "local_id": 1,
                    "category": "C",
                    "gender": "male",
                    "country": "Chile",
                    "city": "Santiago",
                    "club": "Club Chile",
                    "is_mine": 1
                },
                {
                    "nickname": "TEST_SyncPlayer2",
                    "local_id": 2,
                    "category": "D",
                    "gender": "female",
                    "country": "Peru",
                    "city": "Lima",
                    "club": "Club Peru",
                    "is_mine": 0
                }
            ],
            "matches": [],
            "points": [],
            "game_results": []
        }
        
        response = requests.post(f"{BASE_URL}/api/sync", 
            json=sync_data,
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["players_synced"] == 2
        assert "player_mappings" in data
        # Check mappings exist for local IDs
        assert 1 in data["player_mappings"] or "1" in str(data["player_mappings"])
        assert 2 in data["player_mappings"] or "2" in str(data["player_mappings"])
        
        # Verify players were created with new fields
        players_response = requests.get(f"{BASE_URL}/api/players", headers=self.headers)
        players = players_response.json()
        
        player1 = next((p for p in players if p["nickname"] == "TEST_SyncPlayer1"), None)
        assert player1 is not None
        assert player1["category"] == "C"
        assert player1["gender"] == "male"
        assert player1["country"] == "Chile"
        assert player1["city"] == "Santiago"
        assert player1["club"] == "Club Chile"
        assert player1["is_mine"] == 1
        print("✅ Sync with new player fields successful")
    
    def test_sync_full_match_data(self):
        """Sync complete match data including players, match, points, game results"""
        sync_data = {
            "players": [
                {"nickname": "TEST_MatchPlayer1", "local_id": 10, "is_mine": 1},
                {"nickname": "TEST_MatchPlayer2", "local_id": 20, "is_mine": 0}
            ],
            "matches": [{
                "local_id": 100,
                "player1_local_id": 10,
                "player2_local_id": 20,
                "my_player_local_id": 10,
                "best_of": 3,
                "winner_local_id": 10,
                "date": "2026-03-15T14:00:00Z",
                "status": "finished",
                "current_game": 2,
                "player1_games": 2,
                "player2_games": 0,
                "tournament_name": "Test Tournament"
            }],
            "points": [
                {
                    "local_id": 1,
                    "match_local_id": 100,
                    "position_x": 0.4,
                    "position_y": 0.6,
                    "winner_player_local_id": 10,
                    "reason": "Winner",
                    "game_number": 1,
                    "point_number": 1,
                    "player1_score": 1,
                    "player2_score": 0
                }
            ],
            "game_results": [
                {
                    "match_local_id": 100,
                    "game_number": 1,
                    "player1_score": 11,
                    "player2_score": 5,
                    "winner_local_id": 10
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/sync", 
            json=sync_data,
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["players_synced"] == 2
        assert data["matches_synced"] == 1
        assert data["points_synced"] == 1
        assert data["game_results_synced"] == 1
        assert "match_mappings" in data
        print("✅ Full match sync successful")
    
    def test_sync_status(self):
        """GET /api/sync/status returns correct counts"""
        # First create some data
        requests.post(f"{BASE_URL}/api/players", 
            json={"nickname": "TEST_StatusPlayer"},
            headers=self.headers
        )
        
        response = requests.get(f"{BASE_URL}/api/sync/status", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "players_in_cloud" in data
        assert "matches_in_cloud" in data
        assert "players" in data
        assert "matches_summary" in data
        assert isinstance(data["players_in_cloud"], int)
        assert isinstance(data["matches_in_cloud"], int)
        print("✅ Sync status returned correctly")
    
    def test_sync_status_without_auth(self):
        """Sync status without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/sync/status")
        assert response.status_code == 401
        print("✅ Unauthenticated sync status rejected")


class TestMatchDetail:
    """GET /api/matches/{match_id} - returns match with points and game results"""
    
    @pytest.fixture(autouse=True)
    def setup_authenticated_user_with_match(self):
        """Create user and sync a match for testing"""
        unique_email = f"TEST_match_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123456",
            "name": "Match Test User"
        })
        assert response.status_code == 200
        self.token = response.json()["session_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Create a full match via sync
        sync_data = {
            "players": [
                {"nickname": "TEST_DetailPlayer1", "local_id": 1, "is_mine": 1, "category": "A"},
                {"nickname": "TEST_DetailPlayer2", "local_id": 2, "is_mine": 0, "category": "B"}
            ],
            "matches": [{
                "local_id": 1000,
                "player1_local_id": 1,
                "player2_local_id": 2,
                "my_player_local_id": 1,
                "best_of": 3,
                "winner_local_id": 1,
                "date": "2026-03-15T10:00:00Z",
                "status": "finished",
                "current_game": 2,
                "player1_games": 2,
                "player2_games": 0,
                "tournament_name": "Detail Test Tournament"
            }],
            "points": [
                {
                    "local_id": 1,
                    "match_local_id": 1000,
                    "position_x": 0.3,
                    "position_y": 0.5,
                    "winner_player_local_id": 1,
                    "reason": "Drop",
                    "game_number": 1,
                    "point_number": 1,
                    "player1_score": 1,
                    "player2_score": 0
                },
                {
                    "local_id": 2,
                    "match_local_id": 1000,
                    "position_x": 0.7,
                    "position_y": 0.2,
                    "winner_player_local_id": 2,
                    "reason": "Error",
                    "game_number": 1,
                    "point_number": 2,
                    "player1_score": 1,
                    "player2_score": 1
                }
            ],
            "game_results": [
                {"match_local_id": 1000, "game_number": 1, "player1_score": 11, "player2_score": 5, "winner_local_id": 1},
                {"match_local_id": 1000, "game_number": 2, "player1_score": 11, "player2_score": 7, "winner_local_id": 1}
            ]
        }
        
        sync_response = requests.post(f"{BASE_URL}/api/sync", json=sync_data, headers=self.headers)
        assert sync_response.status_code == 200
        self.match_mappings = sync_response.json()["match_mappings"]
        self.match_id = self.match_mappings.get(1000) or self.match_mappings.get("1000")
    
    def test_get_match_detail(self):
        """Get match detail returns match, points, game_results, and players"""
        response = requests.get(f"{BASE_URL}/api/matches/{self.match_id}", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "match" in data, "Response must have 'match' key"
        assert "points" in data, "Response must have 'points' key"
        assert "game_results" in data, "Response must have 'game_results' key"
        assert "players" in data, "Response must have 'players' key"
        
        # Verify match data
        match = data["match"]
        assert match["status"] == "finished"
        assert match["tournament_name"] == "Detail Test Tournament"
        assert match["best_of"] == 3
        assert match["player1_games"] == 2
        assert match["player2_games"] == 0
        
        # Verify points
        points = data["points"]
        assert len(points) == 2
        for p in points:
            assert "winner_player_id" in p
            assert "reason" in p
            assert "game_number" in p
            assert "point_number" in p
        
        # Verify game results
        game_results = data["game_results"]
        assert len(game_results) == 2
        for gr in game_results:
            assert "game_number" in gr
            assert "player1_score" in gr
            assert "player2_score" in gr
            assert "winner_id" in gr
        
        # Verify players
        players = data["players"]
        assert len(players) == 2
        for p in players:
            assert "player_id" in p
            assert "nickname" in p
        
        print("✅ Match detail returned correctly with all data")
    
    def test_get_match_not_found(self):
        """Get non-existent match returns 404"""
        response = requests.get(f"{BASE_URL}/api/matches/nonexistent_match_id", headers=self.headers)
        assert response.status_code == 404
        print("✅ Non-existent match returns 404")


class TestDeleteAccount:
    """DELETE /api/auth/account - deletes user account and all data"""
    
    def test_delete_account_success(self):
        """Delete account removes user and all associated data"""
        # Create a test user
        unique_email = f"TEST_delete_{uuid.uuid4().hex[:8]}@example.com"
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123456",
            "name": "Delete Test User"
        })
        assert register_response.status_code == 200
        token = register_response.json()["session_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create some data for this user
        requests.post(f"{BASE_URL}/api/players", 
            json={"nickname": "TEST_DeletePlayerData"},
            headers=headers
        )
        
        # Verify data exists
        players_response = requests.get(f"{BASE_URL}/api/players", headers=headers)
        assert players_response.status_code == 200
        assert len(players_response.json()) >= 1
        
        # Delete account
        delete_response = requests.delete(f"{BASE_URL}/api/auth/account", headers=headers)
        assert delete_response.status_code == 200
        data = delete_response.json()
        assert "message" in data
        
        # Verify user can no longer access API
        verify_response = requests.get(f"{BASE_URL}/api/players", headers=headers)
        assert verify_response.status_code == 401
        
        # Verify login fails
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": "Test123456"
        })
        assert login_response.status_code == 401
        
        print("✅ Account deleted successfully")
    
    def test_delete_account_without_auth(self):
        """Delete account without auth should fail"""
        response = requests.delete(f"{BASE_URL}/api/auth/account")
        assert response.status_code == 401
        print("✅ Unauthenticated account deletion rejected")


class TestAuthMe:
    """GET /api/auth/me - returns current user info"""
    
    def test_get_me_authenticated(self):
        """Get current user info with valid token"""
        # Create and authenticate user
        unique_email = f"TEST_me_{uuid.uuid4().hex[:8]}@example.com"
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123456",
            "name": "Me Test User"
        })
        assert register_response.status_code == 200
        token = register_response.json()["session_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get current user
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["email"] == unique_email.lower()
        assert data["name"] == "Me Test User"
        assert "user_id" in data
        print("✅ Get current user successful")
    
    def test_get_me_without_auth(self):
        """Get current user without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✅ Unauthenticated /auth/me rejected")


class TestLogout:
    """POST /api/auth/logout - logs out user"""
    
    def test_logout_success(self):
        """Logout invalidates session"""
        # Create and authenticate user
        unique_email = f"TEST_logout_{uuid.uuid4().hex[:8]}@example.com"
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123456",
            "name": "Logout Test User"
        })
        assert register_response.status_code == 200
        token = register_response.json()["session_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Logout
        logout_response = requests.post(f"{BASE_URL}/api/auth/logout", headers=headers)
        assert logout_response.status_code == 200
        
        # Verify session is invalidated (note: session should be deleted)
        # After logout, token should no longer work
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        # Session was deleted, so should be 401
        assert me_response.status_code == 401
        print("✅ Logout successful")


class TestWithProvidedCredentials:
    """Test with provided test credentials"""
    
    def test_login_with_review_account(self):
        """Test login with Review Account credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "googleplayreview@squashcoach.app",
            "password": "ReviewSquash2025!"
        })
        # This might fail if account doesn't exist or was registered with Google
        if response.status_code == 200:
            print("✅ Review account login successful")
        elif response.status_code == 400 and "Google" in response.json().get("detail", ""):
            print("⚠️ Review account was registered with Google OAuth")
        else:
            print(f"ℹ️ Review account login status: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
