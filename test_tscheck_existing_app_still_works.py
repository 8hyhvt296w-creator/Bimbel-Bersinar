"""Covers: existing app still works after adding the download-link feature.

Happy path: admin login returns 200 with role "admin", and the admin dashboard endpoint
is reachable with the resulting session cookie.
Failure case: login with a wrong password is rejected.
"""


def test_admin_login_and_dashboard_access(client):
    login_resp = client.post(
        "/auth/login",
        json={"email": "admin@bimbel.id", "password": "admin123"},
    )
    assert login_resp.status_code == 200
    body = login_resp.json()
    assert body["role"] == "admin"
    assert body["email"] == "admin@bimbel.id"

    # The session cookie is set with the Secure attribute (served over https in
    # production/preview). httpx's cookie jar strictly refuses to replay a Secure
    # cookie over a plain-http base_url, so the session cookie is forwarded manually
    # here instead of relying on the client's cookie jar.
    session_cookie = login_resp.cookies.get("bimbel_session")
    assert session_cookie
    dash_resp = client.get(
        "/dashboard/admin", headers={"Cookie": f"bimbel_session={session_cookie}"}
    )
    assert dash_resp.status_code == 200
    dash_body = dash_resp.json()
    assert "total_siswa" in dash_body


def test_admin_login_wrong_password_rejected(client):
    resp = client.post(
        "/auth/login",
        json={"email": "admin@bimbel.id", "password": "wrong-password-tscheck"},
    )
    assert resp.status_code in (401, 400)
