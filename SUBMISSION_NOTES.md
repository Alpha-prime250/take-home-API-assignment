# Submission Notes

## Part C — `PATCH /tasks/:id/assign` design decisions
- **Order of checks:** 404 (task doesn't exist) first, then 400 (invalid body). A missing task is always reported as missing,
  regardless of what the body contains.
- **Validation:** `assignee` must be a string, non-empty after trimming, and at most 100 characters. `""`, `"   "`, `null`,
  numbers, arrays and a missing field all return 400 and leave the task untouched.
- **Normalisation:** the name is trimmed before storing, so `"  Asha "` and `"Asha"` are the same value.
- **Already assigned:** reassigning is allowed and returns 200 with the new assignee. PATCH is a partial update and "hand this
  over to someone else" is a normal workflow; a 409 would just force clients to unassign first, and there is no unassign
  endpoint. Assigning the same name again is idempotent.
- **Shape change:** new tasks now include `assignee: null`, so the field is always present.
- **Not editable elsewhere:** `PUT /tasks/:id` ignores `assignee`, so all assignment goes through one validated path.

## What I'd test next
- Concurrency/large-volume behaviour (many tasks, pagination boundaries), and a real HTTP smoke test against `npm start`.
- Timezone edge cases for "overdue" (a due date earlier today, date-only strings like `2026-01-01`).
- A contract test that the README/API docs match actual responses (bug #9 would have been caught).

## What surprised me
- Three independent logic bugs (pagination offset, substring status match, priority reset) sit in tiny, readable functions —
  all are one-line mistakes that type checking wouldn't catch, which is why behavioural tests matter.
- `completeTask` and `update` are two separate code paths that both change `status`, and they disagreed about `completedAt`.

## Questions before shipping to production
- Is in-memory storage acceptable, or do we need a database (and migrations)?
- Who is allowed to assign/modify tasks — is authentication/authorisation needed, and should `assignee` be a user id?
- What should happen on `DELETE`/`complete` for tasks the caller doesn't own?
- Should list endpoints return pagination metadata (`total`, `totalPages`)?
- Do existing clients rely on any of the buggy behaviour (e.g. 0-based pages)? Fixing #1 is a breaking change for them.

## Test results
Tests are in `task-api/tests/` (service unit tests, validator tests, Supertest route tests — 107 cases).
Run `cd task-api && npm install && npm test` / `npm run coverage`.
Note: my build sandbox could not reach the npm registry, so I executed the suite with a minimal stand-in for Jest/Express/Supertest
against the real source (107/107 passing; 37 of them fail against the original code). Approximate line coverage measured with V8
coverage: ~97% overall (service 100%, routes 100%, validators ~98%; the uncovered lines are `app.listen` and the 500 handler).
Please run the real `npm run coverage` once to get the official Jest numbers.
