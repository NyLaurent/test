# Engineering notes

## Design and state

PostgreSQL is the source of truth. `users` own `dataset_requests`; `episodes` represent imported recordings and have a unique external `episode_id`; `assignments` join requests to episodes, with database constraints preventing assignment of an episode to multiple requests; `status_history` stores each workflow transition, actor, timestamp, and optional client feedback note. The current request status is also stored on the request row for efficient queue reads. JWTs carry the authenticated user identity, while role and ownership decisions are rechecked against the database on every protected request.

The workflow is deliberately narrow: operators/admins move `submitted → in_progress → delivered`; clients accept or reject delivered work, with written feedback required for rejection; operators/admins can return rejected work to `in_progress`. Delivery checks the assigned episode count, and assignments reject bad-quality episodes. Operators can assign a selected group of episodes in one transaction. Analytics filter and aggregate in SQL rather than materializing episode/request tables in Python. The Next.js workspace prefix mirrors the authenticated role (`/client`, `/operator`, `/admin`); the API remains the authorization boundary.

## Hard decisions

- **Date-range meaning:** episode metrics use `recorded_at`; request counts and delivery duration use the request submission time (`created_at`). This keeps the date range anchored to when the item entered the corresponding process and gives delivery duration one consistent start.
- **Episode import behavior:** malformed and duplicate rows do not fail the whole CSV. Each rejected row has a line number and reason so an operator can correct the source and retry safely. `episode_id` is canonicalized to uppercase as the stable idempotency key. The operator inventory previews and imports the bundled seed directly, and can invoke the supplied clean-data generator for small volume checks.
- **Database choice:** Compose and local backend defaults use PostgreSQL for its constraints and concurrent-write behavior. SQLite is used only by isolated in-memory test fixtures and a migration compatibility check; it is not the application runtime database. Production also needs backups, monitoring, migration rollout controls, and possibly row-level locking around high-contention assignment/admin operations.

## What is simplified / next

The request queue is intentionally basic and does not yet paginate. The inventory page is paginated, while the operator overview and assignment chooser still load the available episode list in one request; imports also read the CSV into memory and report skipped rows in one response. The browser generator is capped at 20,000 rows per action; larger load-test files remain a command-line use of the supplied script. There is no export-job pipeline, real-time update channel, client notification delivery, password reset, or public deployment. With two more days, I would add paginated/filterable queue queries, a paginated assignment chooser, a streaming or background CSV import for large files, rate limiting, and end-to-end browser tests. No optional stretch item was selected.

## Failure and diagnosis

SQLite does not preserve timezone metadata when it reloads a timezone-aware `DateTime`. An early import assertion therefore passed immediately after parsing but failed after reading the row back. I separated parsing correctness from backend persistence in the test: parsed ISO timestamps are normalized to UTC, while the SQLite round-trip is asserted as the equivalent naive UTC wall time. The assignment migration uses Alembic batch operations so SQLite can rebuild the table while PostgreSQL can apply the equivalent constraints.

During frontend session debugging, login and refresh succeeded while protected API calls returned 401. Inspecting the outgoing request revealed that the shared API helper was sending a placeholder instead of the bearer token. I corrected the header and confirmed the helper now builds `Authorization: Bearer <access token>`.

The test container's wall clock also jumped between requests during one suite run, making otherwise valid 15-minute tokens appear expired in multi-request authorization tests. I confirmed this from the signed `iat`/`exp` claims and stabilized only the authorization-test helper's time claims; the dedicated auth tests still exercise real login, expiration, and refresh behavior.

## Security

Passwords use bcrypt; tokens are signed, short-lived bearer JWTs; malformed, expired, missing, and inactive-user tokens return 401; role and ownership checks are enforced server-side. Request fields are validated, CSV values are normalized/validated, and episode assignment uniqueness and referential integrity are enforced by the database. The two risks I would prioritize are **bearer-token theft through XSS or a compromised device** (use HTTPS, restrictive CSP, short expiry, and consider HttpOnly secure cookies if the frontend deployment can support same-site sessions) and **broken object-level authorization/IDOR** (continue testing ownership and role checks for every new route). Login rate limiting and secret rotation/management remain deployment hardening items.

## Scale

At 10× users, login abuse, request queue contention, and operational visibility are likely to become concerns; add distributed rate limiting, metrics/tracing, and workload-specific indexes. At 100× episodes / around five million rows, broad inventory reads and large in-memory CSV uploads would break before the SQL aggregates. Add cursor pagination, streaming/background imports, query-plan-based indexes, and potentially time partitioning or precomputed daily aggregates. PostgreSQL keeps the aggregation in the database and avoids moving millions of episode rows into API memory.

## AI tooling

GitHub Copilot CLI was used to inspect the codebase, implement and revise code, and help generate test cases. Codex was also used to diagnose the bearer-header issue and implement the bulk assignment, rejection feedback, and delivered-episode detail flow. Changes should be reviewed and verified against the repository patterns and automated checks before submission.
