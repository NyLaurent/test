# Software Engineer Role - Technical Test

**Project: Dataset Request Desk, an internal platform for a robotics data collection company**

Thank you for applying. This task is designed to look like the work you would actually do on the team: building and owning the internal platforms that run the company day to day.

- **Time budget:** aim for **6–8 hours** of focused work. Please do not spend more than ~10. We would rather see a smaller, solid, well-explained system than a large unfinished one.
- **Final Deadline:** **Sunday 04 October 2026, 23:59 (Kigali time, UTC+2)**. The brief is explicit about what matters most (section 8) and what is optional, so prioritise.
- **Submission:** a link to a Git repository. See "What to submit" at the end.

---

## 1. Context

We collect robot teleoperation data. Each recording session produces **episodes** (short video clips of a robot performing a task, plus metadata). Clients submit **dataset requests** describing what they need ("200 episodes of a robot arm picking cups, delivered by a date"). Our operations staff fulfil those requests by assigning episodes to them, and the client reviews and accepts or rejects the delivery.

Right now this is tracked in spreadsheets. Build us the first version of an internal web platform that replaces the spreadsheet.

## 2. Users and roles

| Role | Can do |
|---|---|
| **client** | Create requests; view *only their own* requests; accept or reject a delivered request. |
| **operator** | View all requests; move a request through its workflow; assign episodes to requests; import episode metadata. |
| **admin** | Everything an operator can do, plus create/deactivate users and change roles. |

Authentication is required for every action except login. Authorization must be enforced **on the server**, the UI hiding a button is not enough.

## 3. Core domain

**Episode**: `episode_id`, `robot_id`, `task_name`, `recorded_at`, `duration_seconds`, `operator_name`, `quality` (`good` / `usable` / `bad`), plus whatever you need. Episodes are imported from a CSV export of our recording system (see `seed/episodes.csv`; `seed/generate_episodes.py` can produce a much larger clean file if you want to test your queries at volume). **The export is messy**, duplicates, missing values, inconsistent formatting. Your import must be safe to run more than once against the same file without creating duplicate records, and must report clearly what was imported, what was skipped, and why.

**Request**: belongs to a client; has `task_name`, `episodes_requested` (count), `deadline`, `notes`, and a `status` that moves through:

```
submitted → in_progress → delivered → accepted
                                    ↘ rejected → in_progress (rework)
```

Only valid transitions are allowed, and only by the roles that own that step (clients accept/reject; operators do the rest). Every status change must be recorded with who did it and when.

**Assignment**: an episode assigned to a request. Rules: an episode can be assigned to at most one request at a time; only `good` or `usable` episodes can be assigned; a request cannot move to `delivered` until it has at least `episodes_requested` episodes assigned.

## 4. What to build

### 4.1 Backend (required, Python)
- A REST (or GraphQL, your choice) API implementing the above with a **relational database** (PostgreSQL preferred; SQLite is acceptable if you explain what would change in production).
- Schema managed by **migrations**.
- Auth + role-based authorization enforced server-side.
- The CSV import endpoint or CLI command described above.
- An **analytics endpoint** returning, for a given date range:
  - episodes recorded per day, per robot;
  - request fulfilment: count of requests by status, and median time from `submitted` to `delivered`;
  - top 5 task names by number of *good* episodes.

  We care that these queries are done in the database, not by loading everything into Python. Say something in your README about how they would behave with 5 million episodes.
- A `/health` endpoint and **structured logging** (one log line per request with method, path, status, duration, and the user id if authenticated).

### 4.2 Frontend (required, but keep it small)
A working UI in any modern framework (React, Vue, Svelte, HTMX + templates, your choice) that lets:
- a client log in, create a request, see their requests and current status, and accept/reject a delivered one;
- an operator see all requests, change status, and assign episodes to a request (a simple list with filters by `task_name` and `quality` is enough).

Functionality and correctness matter here.

### 4.3 Operations (required)
- `docker compose up` (or a single documented command) brings up the whole system; database, migrations, seed users, API, frontend, from a clean clone.
- Automated tests we can run with one command. We care most about tests for: authorization rules, status transitions, assignment rules, and import idempotency. Coverage percentage is irrelevant; the *choice* of what to test is not.
- *(Nice to have, not required given the deadline)* A CI configuration (GitHub Actions or similar) that runs the tests.

### 4.4 Choose ONE stretch item (optional)
Pick one, and tell us which you picked.
- **Real-time:** operators see request status changes and new requests appear live (WebSocket or SSE) without refreshing.
- **Background work:** on assignment, each episode goes through a simulated "export" job (sleep 2–5s, fails randomly 20% of the time). Make it retry safely, be idempotent, and show per-episode export status in the UI.
- **Deployment:** deploy it somewhere public (any free tier is fine) with HTTPS, and describe how secrets and the database are managed.

## 5. Written notes (required, this is a big part of the evaluation)

Add a `NOTES.md` (aim for 1–2 pages) covering:
1. **Design:** your data model (a diagram or a paragraph is fine), where state lives, and the 2–3 decisions you found hardest and why you chose what you chose.
2. **What you deliberately left out or simplified**, and what you would do next with two more days.
3. **Something that went wrong** while building this and how you diagnosed it.
4. **Security:** what you did about passwords/tokens, input validation, and the 2 vulnerabilities you would worry about most in this kind of system.
5. **Scale:** what breaks first at 10× users and 100× episodes, and what you would change.
6. **AI tooling:** which tools you used (if any) and for what. Using them is fine, see below.

## 6. Ground rules

- **Language/stack:** backend must be Python. Everything else is your choice; pick what you're fastest in.
- **AI assistants are allowed.** We use them too. However, you must understand and be able to defend every line you submit. The interview includes a live session where you will modify and extend your own code; this is where it becomes obvious whether the code is yours.
- **Do not over-build.** A clean, tested, honest 70% with clear notes beats a sprawling 100% with no tests and no explanation.
- **Commit as you go.** We read the Git history, it tells us how you work.
- If anything in this brief is ambiguous, make a reasonable decision and write it down in `NOTES.md`. Deciding well under ambiguity is part of the job.

## 7. What to submit

A repository containing:
- the code;
- `README.md` - how to run it, how to run the tests, seed user credentials;
- `NOTES.md` - as described in section 5;
- the CI config, if you added one;
- if you did the deployment stretch, the URL.

Reply to the email you received this from with the link or if otherwise stated. If you have questions during the task, email us. We'll answer any clarifying questions.

## 8. How we evaluate

Roughly equal weight on: **correctness of the domain rules** (auth, transitions, assignments, import), **data modelling & queries**, **engineering practice** (tests, migrations, Docker, CI, Git history, code clarity), **operability** (logging, health, error handling, one-command startup), and **your written reasoning**. The stretch item is a bonus, never a penalty.

Good luck, we're looking forward to reviewing your work.
