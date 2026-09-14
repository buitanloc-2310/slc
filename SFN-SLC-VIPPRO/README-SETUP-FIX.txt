SLC setup/bootstrap fix
- /api/setup/* and /api/health bypass old session-cookie preflight.
- Prevents a stale/broken session cookie from causing a generic 500 before bootstrap runs.
- Setup UI now reads diagnostic fields nested in API detail responses.
- Opening /api/setup/bootstrap directly in the address bar sends GET, so "API không tồn tại" is expected; bootstrap is POST-only.
