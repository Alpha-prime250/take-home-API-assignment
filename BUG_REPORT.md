# Bug Report — Task API

How these were found: I read `src/` first and formed suspicions, then wrote tests that assert the *documented* behaviour
and ran them against the **original** code. 37 of those tests failed on the original source and all pass after the fixes
below. Line numbers refer to the original files.

Status: **all bugs below are fixed** in this submission (the brief only required one), each with a regression test.

---

## 1. Pagination skips the first page (off-by-one) — HIGH
- **Where:** `src/services/taskService.js:12` — `const offset = page * limit;`
- **Expected:** `?page=1&limit=10` returns tasks 1–10.
- **Actual:** page 1 returns tasks 11–20 (the first page is unreachable; `page=0` is the only way to see it).
- **Why:** pages are 1-based (the route defaults to `1`) but the offset formula treats them as 0-based.
- **Found by:** creating 5 tasks and asking for `page=1&limit=2` — got tasks 3–4 instead of 1–2.
- **Fix:** `offset = (page - 1) * limit`.

## 2. Status filter does substring matching — HIGH
- **Where:** `src/services/taskService.js:9` — `t.status.includes(status)`.
- **Expected:** `?status=todo` returns only `todo` tasks; an unknown status returns nothing / 400.
- **Actual:** `?status=o` returns every `todo` and `done` task; `?status=progress` matches `in_progress`.
- **Why:** `String.prototype.includes` is a substring test, not equality.
- **Found by:** unit test calling `getByStatus('o')`.
- **Fix:** strict equality (`===`). The route now also returns 400 for a status that isn't one of the valid values.

## 3. Completing a task silently resets its priority — HIGH
- **Where:** `src/services/taskService.js:69` — `priority: 'medium'` inside `completeTask`.
- **Expected:** `PATCH /:id/complete` changes `status` and `completedAt` only.
- **Actual:** a `high`/`low` priority task becomes `medium` after completion (data loss).
- **Why:** a hard-coded value in the object literal that builds the updated task.
- **Found by:** creating a `high` task, completing it, asserting priority is unchanged.
- **Fix:** removed the line. Also: completing an already-done task no longer overwrites the original `completedAt`.

## 4. PUT lets clients overwrite any field (mass assignment) — HIGH
- **Where:** `src/services/taskService.js:50` — `{ ...tasks[index], ...fields }`.
- **Expected:** only user-editable fields change.
- **Actual:** `PUT /tasks/:id {"id":"x","createdAt":"2000-01-01","completedAt":"...","anything":true}` rewrites `id`,
  `createdAt`, `completedAt` and adds arbitrary properties. Changing `id` breaks every later lookup of that task.
- **Why:** the raw request body is spread over the stored object and the validator only checks four fields.
- **Found by:** PUT with `{ id: 'hacked' }` and reading the response.
- **Fix:** whitelist `title, description, status, priority, dueDate`. `assignee` is deliberately *not* editable via PUT so it
  can only be set through the validated assign endpoint.

## 5. `completedAt` is inconsistent with `status` via PUT — MEDIUM
- **Where:** `src/services/taskService.js` `update` (same function as #4).
- **Expected:** a task that is `done` has `completedAt`; a task that isn't doesn't.
- **Actual:** `PUT {status:"done"}` leaves `completedAt: null`; moving a done task back to `todo` keeps the old timestamp.
  That also corrupts any reporting built on `completedAt`.
- **Fix:** `update` sets `completedAt` on the transition into `done` and clears it on the transition out of it.

## 6. Validation skips falsy-but-invalid values and wrong types — MEDIUM
- **Where:** `src/utils/validators.js:8, 11, 14, 24, 27, 30` — `if (body.status && ...)`.
- **Expected:** `status: ""`, `priority: ""`, `dueDate: ""`, `dueDate: 123`, `description: 5` → 400.
- **Actual:** empty strings pass validation and are stored (`status: ""` then breaks stats and filters); `description` is never checked.
- **Why:** truthiness used as a "was it provided" check.
- **Fix:** check `!== undefined` instead, require `dueDate` to be a string or `null`, require `description` to be a string.

## 7. Pagination query params are not validated; status silently beats paging — MEDIUM
- **Where:** `src/routes/tasks.js:14, 20-21`.
- **Expected:** bad input → 400; `?status=done&page=2` filters *and* pages.
- **Actual:** `page=-1`/`limit=-5` are accepted (`parseInt("-1")` is truthy) and feed a negative slice; `page=0` is silently
  turned into `1`; `limit` has no cap (`limit=1000000`); and when `status` is present `page`/`limit` are ignored entirely.
- **Fix:** new `validatePagination` (positive integers only, `limit` ≤ 100) and the service accepts an optional status so
  filtering and paging compose.

## 8. Malformed JSON returns 500 — LOW
- **Where:** `src/app.js:11` — the catch-all handler turns every error into a 500.
- **Expected:** 400 for a client error.
- **Actual:** `POST /tasks` with body `{"title":` → `500 Internal server error` and a stack trace in the server log.
- **Fix:** handle `entity.parse.failed` and return `400 {"error":"Invalid JSON body"}`. Also added a JSON 404 for unknown routes.

## 9. Docs disagree with the code — LOW
- `README.md` documents statuses `pending | in-progress | completed`; code, validators and `ASSIGNMENT.md` use
  `todo | in_progress | done`. I kept the code's values (changing them would break clients) and corrected the README.

---

## Things I noticed but did not change
- Storage is in-memory and process-local: data is lost on restart and can't be shared across multiple instances.
- No authentication, so `assignee` is just a free-text name, not a verified user.
- `GET /tasks` returns a bare array with no `total`/`totalPages`, so clients can't tell how many pages exist.
- No `GET /tasks/:id` endpoint.
