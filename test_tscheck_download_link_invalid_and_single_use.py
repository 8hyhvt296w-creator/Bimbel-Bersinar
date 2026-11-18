"""Covers: invalid token rejected (404) and single-use enforcement (second GET to an
already-consumed token returns 404 with the Indonesian detail message).

NOTE: The one valid unused token provided for this test run
(IfG2djMdpR27oorcZQpKKLMmf6oV80NhK9RYenHdH5k) was already consumed once manually during
investigation (per briefing instructions: "consumed on first GET - download it once, save
the file, then inspect locally"). That first GET returned 200, application/zip,
Content-Disposition attachment filename matching bimbel-bersinar-kode-*.zip, and the saved
zip was inspected locally (105 entries under bimbel-bersinar/, includes backend/server.py,
backend/lib/__init__.py, frontend/src/App.tsx, .emergent/crons.yml; no .env, no
node_modules, no __pycache__, no memory/test_credentials.md, no other .emergent/ entries;
no leaked secret values for EMERGENT_EMAIL_KEY or WEBHOOK_CRON_SECRET). This test file
re-verifies that the now-consumed token is rejected (single-use) and that a random invalid
token is also rejected.
"""

EXPECTED_DETAIL = "Link unduhan tidak valid, sudah dipakai, atau kedaluwarsa"
CONSUMED_TOKEN = "IfG2djMdpR27oorcZQpKKLMmf6oV80NhK9RYenHdH5k"


def test_consumed_token_now_returns_404_single_use(client):
    resp = client.get(f"/download/{CONSUMED_TOKEN}")
    assert resp.status_code == 404
    assert resp.json()["detail"] == EXPECTED_DETAIL


def test_random_invalid_token_returns_404(client):
    resp = client.get("/download/tscheck-invalid-token-does-not-exist-abc123")
    assert resp.status_code == 404
    assert resp.json()["detail"] == EXPECTED_DETAIL
