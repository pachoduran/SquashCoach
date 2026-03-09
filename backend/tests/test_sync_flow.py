"""
End-to-end test for cloud sync flow:
1. Register user
2. Create players individually 
3. Sync match data (players + match + points + game_results)
4. Verify sync status
5. Simulate restore: get players, get matches, get match detail
6. Verify all data structure matches what frontend expects
"""
import requests
import json

API_URL = "http://localhost:8001"

def test_full_sync_and_restore_flow():
    # 1. Register
    resp = requests.post(f"{API_URL}/api/auth/register", json={
        "email": "pytest_sync@test.com",
        "password": "test123456",
        "name": "Pytest User"
    })
    assert resp.status_code == 200, f"Register failed: {resp.text}"
    token = resp.json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Create players individually (simulates new-match.tsx addPlayer)
    resp = requests.post(f"{API_URL}/api/players", json={"nickname": "Ana"}, headers=headers)
    assert resp.status_code == 200
    ana = resp.json()
    assert ana["nickname"] == "Ana"
    assert "player_id" in ana
    assert "created_at" in ana
    
    resp = requests.post(f"{API_URL}/api/players", json={"nickname": "Beto"}, headers=headers)
    assert resp.status_code == 200
    beto = resp.json()
    
    # 3. Sync match data (simulates syncPendingMatches)
    sync_data = {
        "players": [
            {"nickname": "Ana", "local_id": 1},
            {"nickname": "Beto", "local_id": 2}
        ],
        "matches": [{
            "local_id": 100,
            "player1_local_id": 1,
            "player2_local_id": 2,
            "my_player_local_id": 1,
            "best_of": 3,
            "winner_local_id": 1,
            "date": "2026-03-01T10:00:00Z",
            "status": "finished",
            "current_game": 2,
            "player1_games": 2,
            "player2_games": 0,
            "tournament_name": "Copa Test"
        }],
        "points": [
            {
                "local_id": 1, "match_local_id": 100,
                "position_x": 0.3, "position_y": 0.5,
                "winner_player_local_id": 1, "reason": "Drop",
                "game_number": 1, "point_number": 1,
                "player1_score": 1, "player2_score": 0
            },
            {
                "local_id": 2, "match_local_id": 100,
                "position_x": 0.7, "position_y": 0.2,
                "winner_player_local_id": 2, "reason": "Paralela",
                "game_number": 1, "point_number": 2,
                "player1_score": 1, "player2_score": 1
            }
        ],
        "game_results": [
            {"match_local_id": 100, "game_number": 1, "player1_score": 11, "player2_score": 5, "winner_local_id": 1},
            {"match_local_id": 100, "game_number": 2, "player1_score": 11, "player2_score": 7, "winner_local_id": 1}
        ]
    }
    resp = requests.post(f"{API_URL}/api/sync", json=sync_data, headers=headers)
    assert resp.status_code == 200
    sync_result = resp.json()
    assert sync_result["matches_synced"] == 1
    assert sync_result["points_synced"] == 2
    assert sync_result["game_results_synced"] == 2
    assert 1 in sync_result["player_mappings"] or "1" in sync_result["player_mappings"]
    
    # 4. Verify sync status
    resp = requests.get(f"{API_URL}/api/sync/status", headers=headers)
    assert resp.status_code == 200
    status = resp.json()
    assert status["players_in_cloud"] == 2
    assert status["matches_in_cloud"] == 1
    
    # 5. RESTORE SIMULATION - Get cloud players
    resp = requests.get(f"{API_URL}/api/players", headers=headers)
    assert resp.status_code == 200
    cloud_players = resp.json()
    assert len(cloud_players) == 2
    # Verify each player has required fields
    for p in cloud_players:
        assert "nickname" in p
        assert "player_id" in p
        assert "created_at" in p
    
    # 6. RESTORE SIMULATION - Get cloud matches
    resp = requests.get(f"{API_URL}/api/matches", headers=headers)
    assert resp.status_code == 200
    cloud_matches = resp.json()
    assert len(cloud_matches) == 1
    # CRITICAL: Verify match_id field exists (was the bug)
    assert "match_id" in cloud_matches[0], "match_id field missing from match list response"
    match_id = cloud_matches[0]["match_id"]
    
    # 7. RESTORE SIMULATION - Get match detail
    resp = requests.get(f"{API_URL}/api/matches/{match_id}", headers=headers)
    assert resp.status_code == 200
    detail = resp.json()
    
    # Verify the EXACT structure our fixed restoreFromCloud expects:
    assert "match" in detail, "Response must have 'match' key"
    assert "players" in detail, "Response must have 'players' key"
    assert "points" in detail, "Response must have 'points' key"
    assert "game_results" in detail, "Response must have 'game_results' key"
    
    match_data = detail["match"]
    assert match_data["player1_id"] in [ana["player_id"], beto["player_id"]]
    assert match_data["player2_id"] in [ana["player_id"], beto["player_id"]]
    assert match_data["winner_id"] is not None
    assert match_data["status"] == "finished"
    assert match_data["tournament_name"] == "Copa Test"
    
    # Verify players in detail have correct structure
    detail_players = detail["players"]
    assert len(detail_players) == 2
    for p in detail_players:
        assert "player_id" in p
        assert "nickname" in p
    
    # Verify we can map player1_id to a nickname
    p1_found = any(p["player_id"] == match_data["player1_id"] for p in detail_players)
    p2_found = any(p["player_id"] == match_data["player2_id"] for p in detail_players)
    assert p1_found, "player1_id must be findable in players array"
    assert p2_found, "player2_id must be findable in players array"
    
    # Verify points have correct structure
    points = detail["points"]
    assert len(points) == 2
    for pt in points:
        assert "winner_player_id" in pt, "Point must have winner_player_id"
        assert "position_x" in pt
        assert "reason" in pt
        assert "game_number" in pt
        # Verify winner_player_id maps to a real player
        assert any(p["player_id"] == pt["winner_player_id"] for p in detail_players), \
            f"Point winner {pt['winner_player_id']} must match a player"
    
    # Verify game results have correct structure
    game_results = detail["game_results"]
    assert len(game_results) == 2
    for gr in game_results:
        assert "winner_id" in gr, "Game result must have winner_id"
        assert "game_number" in gr
        assert "player1_score" in gr
        assert "player2_score" in gr
    
    print("\n✅ ALL SYNC AND RESTORE TESTS PASSED!")


def test_duplicate_sync_no_duplicates():
    """Syncing the same data twice should not create duplicates"""
    resp = requests.post(f"{API_URL}/api/auth/register", json={
        "email": "pytest_dup@test.com",
        "password": "test123456",
        "name": "Dup User"
    })
    token = resp.json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    sync_data = {
        "players": [{"nickname": "DupPlayer", "local_id": 1}],
        "matches": [],
        "points": [],
        "game_results": []
    }
    
    # Sync once
    resp = requests.post(f"{API_URL}/api/sync", json=sync_data, headers=headers)
    assert resp.json()["players_synced"] == 1
    
    # Sync again - should not create duplicate
    resp = requests.post(f"{API_URL}/api/sync", json=sync_data, headers=headers)
    assert resp.json()["players_synced"] == 0
    
    # Verify only 1 player
    resp = requests.get(f"{API_URL}/api/players", headers=headers)
    assert len(resp.json()) == 1
    
    print("\n✅ DUPLICATE SYNC TEST PASSED!")


if __name__ == "__main__":
    test_full_sync_and_restore_flow()
    test_duplicate_sync_no_duplicates()
