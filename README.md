# Dataset Request Desk

An internal platform for robotics dataset requests and episode fulfilment. The backend is a Python/FastAPI API backed by PostgreSQL; the frontend is a Next.js application. PostgreSQL is used by Compose and local backend configuration. Unit tests use an isolated in-memory SQLite database for speed; SQLite is not the application runtime database. Use PostgreSQL for concurrent writes, reliable row locking/constraints, and operational tooling.

## Run the full application

With Docker Compose installed, start the database, apply migrations, seed development users, and run the API and frontend from the repository root:

```powershell
docker compose up --build
```

Open <http://localhost:3000>. The API is at <http://localhost:8000>, with interactive documentation at <http://localhost:8000/docs> and health status at <http://localhost:8000/health>. To stop, press Ctrl+C; use `docker compose down` to stop and remove the containers. The named PostgreSQL volume remains unless explicitly removed.

After signing in, each role uses its own route prefix: `/client`, `/operator`, or `/admin`. The frontend redirects a signed-in user away from another role's workspace, while the API independently enforces authorization on every protected endpoint.

For local frontend development against the Compose API:

```powershell
Set-Location frontend
npm ci
npm run dev
```

For local backend development, install Python 3.12+ and the project dependencies with `python -m pip install -e ".[dev]"`, then run `python -m pytest -q` from the repository root. The backend configuration is in `.env.example`; never commit real secrets.

## Local development users

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `admin123` |
| Operator | `ops1@example.com` | `ops123` |
| Operator | `ops2@example.com` | `ops123` |
| Client | `client-a@example.com` | `client123` |
| Client | `client-b@example.com` | `client123` |

These accounts and Compose database credentials are only for local development. Do not use them outside a local environment.

## Roles and workflow

Every API operation except login and `/health` requires a bearer token. The API enforces role and ownership checks independently of the UI:

- Clients can create requests and access only their own requests. They can edit or delete requests only while `submitted`, accept their own `delivered` requests, or reject them with written feedback. Delivered episode details and review feedback remain visible from the request details view.
- Operators can view the shared request queue, move requests through operator-owned steps, assign eligible episodes, import episode CSVs, and view analytics.
- Admins can do operator work and manage user roles, activation, and account creation.

The workflow permits only `submitted → in_progress → delivered → accepted/rejected`; rejected work can return to `in_progress`. Each transition records its actor, time, and optional note; a note is required when a client requests changes. Operators can select and assign multiple eligible episodes in one action. Assignment is database-constrained to one request per episode, only good/usable episodes are eligible, and delivery is blocked until the requested count has been assigned.

Episode imports are available to operators and admins from **Episode inventory**. CSV headers are normalized, invalid/duplicate rows are skipped with line-specific reasons, and `episode_id` uniqueness makes repeated imports idempotent. The UI shows the imported inventory in a server-paginated table with task and quality filters, and lists every skipped CSV line with its reason. The API accepts raw `text/csv` at `POST /api/episodes/import`; filtered pages are available from `GET /api/episodes/page`.

## Authentication and security

Passwords are stored as bcrypt hashes. Signed access tokens expire after 15 minutes; a random refresh token is stored only as a hash in PostgreSQL and rotates on each refresh, with a 14-day inactivity lifetime. The frontend transparently refreshes expired access tokens and retries the original request; refresh failures caused by an unavailable API preserve the local session, while expired, revoked, or invalid refresh tokens require a new sign-in. Existing browser sessions created before refresh-token support have no refresh token and require one sign-in after upgrading. Configure a non-placeholder `JWT_SECRET_KEY` of at least 32 characters outside development and use HTTPS in production. Login rate limiting should be configured at the deployment edge before public exposure.

## Analytics and scale

Analytics are grouped and filtered in SQL: episodes per recording day and robot, request counts by status, median submitted-to-delivered time, and the five most common good-episode task names. At five million episodes, indexed date/quality/task queries and database aggregation avoid loading the full dataset into the API process. Production should verify plans with `EXPLAIN ANALYZE`, maintain indexes for time-range and grouping workloads, and consider date partitioning or pre-aggregated daily metrics if query latency requires it.

## Tests

Run the automated backend suite from the repository root:

```powershell
python -m pytest -q
```

Tests cover login/token failures, role authorization, client ownership, admin user management, legal transitions and history, assignment eligibility/uniqueness, CSV import validation/idempotency, analytics date ranges, and health behavior.

## Implementation notes

See [NOTES.md](NOTES.md) for the data model, tradeoffs, known simplifications, security considerations, scale limits, and AI tooling disclosure. No optional stretch item was selected; core workflows and correctness were prioritized.
