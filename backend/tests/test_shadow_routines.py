"""
Tests for Shadow Training Routines cloud sync endpoints:
- POST   /api/shadow-routines       create a routine
- GET    /api/shadow-routines       list routines (newest first, no _id leak)
- DELETE /api/shadow-routines/{id}  delete a routine (404 if not owner)
- DELETE /api/user-data             must also delete shadow_routines

Also includes regression checks for register/login/tournaments/players.
"""
import os
import uuid
import pytest
import requests

BASE_URL = (
    os.environ.get('REACT_APP_BACKEND_URL')
    or os.environ.get('EXPO_PUBLIC_BACKEND_URL')
    or 'https://ios-picker-update.preview.emergentagent.com'
).rstrip('/')

API = f"{BASE_URL}/api"


# -----------------------------------------------------------------------------
# Fixtures: per-test users so they're fully isolated
# -----------------------------------------------------------------------------
def _register(prefix: str):
    email = f"TEST_{prefix}_{uuid.uuid4().hex[:8]}@example.com"
    password = "test123456"
    resp = requests.post(f"{API}/auth/register", json={
        "email": email,
        "password": password,
        "name": f"Shadow Tester {prefix}",
    }, timeout=20)
    assert resp.status_code == 200, f"register failed: {resp.status_code} {resp.text}"
    token = resp.json()["session_token"]
    return {
        "email": email,
        "password": password,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
        "user_id": resp.json().get("user", {}).get("user_id"),
    }


@pytest.fixture
def user_a():
    u = _register("ua")
    yield u
    # cleanup
    try:
        requests.delete(f"{API}/user-data", headers=u["headers"], timeout=10)
        requests.delete(f"{API}/auth/account", headers=u["headers"], timeout=10)
    except Exception:
        pass


@pytest.fixture
def user_b():
    u = _register("ub")
    yield u
    try:
        requests.delete(f"{API}/user-data", headers=u["headers"], timeout=10)
        requests.delete(f"{API}/auth/account", headers=u["headers"], timeout=10)
    except Exception:
        pass


def _sample_payload(name="Rutina 1", date="2026-01-15T10:00:00Z"):
    return {
        "local_id": 1,
        "name": name,
        "date": date,
        "zone_mode": 6,
        "interval_time": 2.5,
        "set_duration": 60,
        "rest_duration": 30,
        "number_of_sets": 4,
        "completed_sets": 4,
        "total_zones_visited": 24,
    }


# -----------------------------------------------------------------------------
# Auth: unauthenticated / invalid token
# -----------------------------------------------------------------------------
class TestShadowRoutinesAuth:
    def test_create_requires_auth(self):
        r = requests.post(f"{API}/shadow-routines", json=_sample_payload(), timeout=10)
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code} {r.text}"

    def test_list_requires_auth(self):
        r = requests.get(f"{API}/shadow-routines", timeout=10)
        assert r.status_code in (401, 403)

    def test_delete_requires_auth(self):
        r = requests.delete(f"{API}/shadow-routines/shadow_doesnotexist", timeout=10)
        assert r.status_code in (401, 403)

    def test_invalid_token_rejected(self):
        bad = {"Authorization": "Bearer not-a-real-token-xyz"}
        for method, url in [
            ("post", f"{API}/shadow-routines"),
            ("get", f"{API}/shadow-routines"),
            ("delete", f"{API}/shadow-routines/shadow_x"),
        ]:
            fn = getattr(requests, method)
            kwargs = {"headers": bad, "timeout": 10}
            if method == "post":
                kwargs["json"] = _sample_payload()
            r = fn(url, **kwargs)
            assert r.status_code in (401, 403), f"{method} {url} returned {r.status_code}"


# -----------------------------------------------------------------------------
# CRUD: create / list / delete
# -----------------------------------------------------------------------------
class TestShadowRoutinesCRUD:
    def test_create_returns_expected_shape(self, user_a):
        payload = _sample_payload()
        r = requests.post(f"{API}/shadow-routines", json=payload, headers=user_a["headers"], timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert set(["routine_id", "user_id", "created_at"]).issubset(body.keys()), body
        assert body["routine_id"].startswith("shadow_")
        assert isinstance(body["created_at"], str)
        # ISO 8601 string (basic sanity)
        assert "T" in body["created_at"]
        # user_id matches the authenticated user
        if user_a.get("user_id"):
            assert body["user_id"] == user_a["user_id"]

    def test_create_then_get_persists_all_fields(self, user_a):
        payload = _sample_payload(name="Mi Rutina", date="2026-02-20T08:30:00Z")
        c = requests.post(f"{API}/shadow-routines", json=payload, headers=user_a["headers"], timeout=15)
        assert c.status_code == 200
        routine_id = c.json()["routine_id"]

        g = requests.get(f"{API}/shadow-routines", headers=user_a["headers"], timeout=15)
        assert g.status_code == 200
        routines = g.json()
        assert isinstance(routines, list)
        match = next((x for x in routines if x.get("routine_id") == routine_id), None)
        assert match is not None, f"created routine not in list: {routines}"

        # No mongo _id leakage on any item
        for item in routines:
            assert "_id" not in item, f"_id leaked: {item}"

        # All payload fields persisted
        for k, v in payload.items():
            assert match.get(k) == v, f"field {k}: expected {v} got {match.get(k)}"

        # created_at is an ISO string
        assert isinstance(match.get("created_at"), str)
        assert "T" in match["created_at"]

    def test_list_sorted_newest_first(self, user_a):
        # Create 3 routines with different dates
        dates = [
            "2026-01-01T10:00:00Z",
            "2026-03-15T10:00:00Z",
            "2026-02-10T10:00:00Z",
        ]
        ids = []
        for i, d in enumerate(dates):
            p = _sample_payload(name=f"R{i}", date=d)
            r = requests.post(f"{API}/shadow-routines", json=p, headers=user_a["headers"], timeout=15)
            assert r.status_code == 200
            ids.append(r.json()["routine_id"])

        g = requests.get(f"{API}/shadow-routines", headers=user_a["headers"], timeout=15)
        assert g.status_code == 200
        listed = g.json()
        assert len(listed) >= 3
        # The first three (newest) should be sorted descending by date
        # Filter to only the ones we created (other tests don't run for this user)
        ours = [x for x in listed if x["routine_id"] in ids]
        assert len(ours) == 3
        date_order = [x["date"] for x in ours]
        assert date_order == sorted(date_order, reverse=True), \
            f"not sorted desc by date: {date_order}"

    def test_delete_owned_routine(self, user_a):
        r = requests.post(f"{API}/shadow-routines", json=_sample_payload(), headers=user_a["headers"], timeout=15)
        rid = r.json()["routine_id"]

        d = requests.delete(f"{API}/shadow-routines/{rid}", headers=user_a["headers"], timeout=15)
        assert d.status_code == 200, d.text
        body = d.json()
        assert body.get("deleted") is True
        assert body.get("routine_id") == rid

        # Verify gone from list
        g = requests.get(f"{API}/shadow-routines", headers=user_a["headers"], timeout=15)
        assert g.status_code == 200
        assert all(x.get("routine_id") != rid for x in g.json())

    def test_delete_nonexistent_returns_404(self, user_a):
        d = requests.delete(f"{API}/shadow-routines/shadow_doesnotexist123", headers=user_a["headers"], timeout=15)
        assert d.status_code == 404, d.text


# -----------------------------------------------------------------------------
# User isolation
# -----------------------------------------------------------------------------
class TestShadowRoutinesIsolation:
    def test_user_b_cannot_see_user_a_routines(self, user_a, user_b):
        # A creates routine
        r = requests.post(f"{API}/shadow-routines", json=_sample_payload(name="A-secret"),
                          headers=user_a["headers"], timeout=15)
        assert r.status_code == 200
        a_rid = r.json()["routine_id"]

        # B lists - must not include A's routine
        g = requests.get(f"{API}/shadow-routines", headers=user_b["headers"], timeout=15)
        assert g.status_code == 200
        assert all(x.get("routine_id") != a_rid for x in g.json())

    def test_user_b_cannot_delete_user_a_routine(self, user_a, user_b):
        r = requests.post(f"{API}/shadow-routines", json=_sample_payload(),
                          headers=user_a["headers"], timeout=15)
        a_rid = r.json()["routine_id"]

        # B attempts delete -> 404 (not exposed as 403 to avoid leaking existence)
        d = requests.delete(f"{API}/shadow-routines/{a_rid}", headers=user_b["headers"], timeout=15)
        assert d.status_code == 404, f"expected 404 got {d.status_code} {d.text}"

        # A can still see their routine
        g = requests.get(f"{API}/shadow-routines", headers=user_a["headers"], timeout=15)
        assert any(x.get("routine_id") == a_rid for x in g.json())


# -----------------------------------------------------------------------------
# DELETE /api/user-data must also clear shadow_routines
# -----------------------------------------------------------------------------
class TestUserDataDeletion:
    def test_clear_user_data_removes_shadow_routines(self, user_a):
        # Create 2 routines
        for i in range(2):
            r = requests.post(f"{API}/shadow-routines",
                              json=_sample_payload(name=f"Del{i}", date=f"2026-01-0{i+1}T10:00:00Z"),
                              headers=user_a["headers"], timeout=15)
            assert r.status_code == 200

        d = requests.delete(f"{API}/user-data", headers=user_a["headers"], timeout=20)
        assert d.status_code == 200, d.text
        body = d.json()
        assert "deleted" in body, body
        deleted = body["deleted"]
        assert "shadow_routines" in deleted, f"shadow_routines key missing: {deleted}"
        assert deleted["shadow_routines"] >= 2, f"expected >=2 deleted got {deleted}"

        # List now empty
        g = requests.get(f"{API}/shadow-routines", headers=user_a["headers"], timeout=15)
        assert g.status_code == 200
        assert g.json() == []


# -----------------------------------------------------------------------------
# Regression: register / login / tournaments / players still work
# -----------------------------------------------------------------------------
class TestRegression:
    def test_register_and_login(self):
        email = f"TEST_reg_{uuid.uuid4().hex[:8]}@example.com"
        pw = "regression123"
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": pw, "name": "Reg User"},
                          timeout=15)
        assert r.status_code == 200, r.text
        assert "session_token" in r.json()

        l = requests.post(f"{API}/auth/login",
                          json={"email": email, "password": pw},
                          timeout=15)
        assert l.status_code == 200, l.text
        assert "session_token" in l.json()

    def test_players_create_and_list(self, user_a):
        r = requests.post(f"{API}/players",
                          json={"nickname": "RegPlayer"},
                          headers=user_a["headers"], timeout=15)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["nickname"] == "RegPlayer"
        assert "player_id" in p

        g = requests.get(f"{API}/players", headers=user_a["headers"], timeout=15)
        assert g.status_code == 200
        assert any(x.get("player_id") == p["player_id"] for x in g.json())

    def test_tournaments_endpoint_reachable(self, user_a):
        # Endpoint must respond (200 list) under auth
        g = requests.get(f"{API}/tournaments", headers=user_a["headers"], timeout=15)
        assert g.status_code == 200, g.text
        assert isinstance(g.json(), list)
