# M2D Client Portal — API reference

One Netlify Function answers everything under `/api/*` (`netlify/functions/api.mjs`). All bodies and responses are JSON unless noted. Errors look like `{ "error": "message" }` with a 4xx/5xx status.

Three kinds of caller:

| Caller | How they sign in | Cookie |
|---|---|---|
| Designer / admin | `POST /api/login` with email + password, or the legacy team passcode | `m2d_s` (30 days) |
| Customer | `POST /api/portal/request-code` then `POST /api/portal/verify` (6-digit emailed code) | `m2d_c` (14 days) |
| Homeowner with a private link | none, the link token is the key | – |
| Prospect (website questionnaire) | none | – |

Roles: `admin` can do everything; `designer` can do everything except manage designer accounts. The legacy passcode gives an `admin` session named "Team passcode".

---

## Designer sign-in

### `POST /api/login`
Body: `{ "email": "leon@m2d.sg", "password": "…" }` **or** `{ "passcode": "…" }` (legacy, only while `TEAM_PASSCODE` is set).
200 → `{ ok: true, user: { id, role, name } }` and sets `m2d_s`. 401 on a wrong password (after a short delay). Rate limit: 30 per hour per IP.

### `POST /api/logout` → `{ ok: true }`, clears `m2d_s`.

### `GET /api/me` → `{ ok: true, user: { id, role, name }, needsSetup: boolean }`
`needsSetup` is true while no designer accounts exist yet (show the "create the first admin" screen).

## Designer accounts (admin only)

| Route | Body | Returns |
|---|---|---|
| `GET /api/designers` | – | `[ { id, name, email, role, active, createdAt, createdBy } ]` |
| `POST /api/designers` | `{ name, email, password (≥8), role: "admin"|"designer" }` | 201 + the account (never the password hash); 409 if the email exists |
| `GET /api/designers/:id` | – | the account |
| `PATCH /api/designers/:id` | any of `{ name, role, active, password }` | the account. You can't deactivate yourself or drop your own admin role |
| `DELETE /api/designers/:id` | – | 204. Soft: sets `active: false`, the person is signed out on their next request |

## Company settings

`GET /api/settings` → `{ warranty, phone, email, website }` · `PUT /api/settings` same body → saved values. Shown on every customer pack.

## Handovers (one record per customer)

A record:

```json
{
  "id": "h…", "token": "…", "createdAt": 0, "updatedAt": 0, "createdBy": "Leon Yap", "updatedBy": "Leon Yap",
  "customer": { "name": "", "address": "", "phone": "", "email": "" },
  "handoverDate": "2026-12-20", "designer": "Leon Yap", "notes": "internal only", "status": "progress" | "done",
  "checks": { "<checklist key>": true }, "defects": [ { "text": "", "done": false } ],
  "contacts": {}, "places": {}, "finishAreas": [], "signoff": {},
  "schedule": { "stages": [ { "id": "s1", "name": "Foundation works", "start": "2026-11-10", "end": "2026-11-28", "status": "planned"|"progress"|"done", "notes": "internal" } ], "updatedAt": 0 },
  "questionnaire": { "answers": { "Property": "HDB BTO", "...": "..." }, "submittedAt": 0, "source": "prospect"|"customer" },
  "appliances": { "items": {}, "custom": {}, "baths": [], "updatedAt": 0 },
  "files": [ { "id": "f…", "name": "Floor plan.pdf", "size": 12345, "type": "application/pdf", "uploadedBy": "Leon Yap", "createdAt": 0 } ]
}
```

| Route | Body | Returns |
|---|---|---|
| `GET /api/handovers` | – | all records, newest first |
| `POST /api/handovers` | any record fields; `customer.name` required | 201 + record (with a fresh private `token`) |
| `GET /api/handovers/:id` | – | record |
| `PATCH /api/handovers/:id` | any of: customer, handoverDate, designer, notes, status, checks, defects, contacts, places, finishAreas, signoff, schedule, questionnaire, appliances | record. Objects are deep-merged (so the desk's click-to-type autosave keeps working). `schedule` and `appliances` are **replaced whole**, so removing a stage removes it. `files`, `token`, `id` can't be set here |
| `DELETE /api/handovers/:id` | – | 204, also deletes its files and private link |
| `POST /api/handovers/:id/reset-link` | – | record with a new `token`; the old homeowner link stops working |

The customer's email on the record is what lets them sign in to the portal. Keep it accurate.

### Files on a handover

| Route | Body | Returns |
|---|---|---|
| `GET /api/handovers/:id/files` | – | `[ file meta ]` |
| `POST /api/handovers/:id/files` | multipart with a `file` field, **or** JSON `{ name, type, data: "<base64>" }` | 201 + file meta |
| `GET /api/handovers/:id/files/:fid` | – | the file (`Content-Disposition: attachment`) |
| `DELETE /api/handovers/:id/files/:fid` | – | 204 |

Limits: 10 MB per file. Allowed: pdf, jpg, jpeg, png, webp, dwg, xlsx, docx (415 otherwise). Files live in Netlify Blobs with the record; deleting the record deletes them.

## Prospects (website questionnaire)

### `POST /api/intake` — no login
Body: `{ "answers": { "Property": "HDB BTO", "Layout": "4-room", … }, "contact": { "name", "phone", "email", "address" } }`.
The `answers` keys are the questionnaire's `data-q` labels. At least one of name / phone / email is required. 201 → `{ ok: true, id }`. Rate limit: 20 per hour per IP. (A flat body of answers also works; `Name`, `Phone`, `Email`, `Address` inside it are picked up as contact details.)

Designer routes:

| Route | Body | Returns |
|---|---|---|
| `GET /api/prospects` | – | `[ { id, answers, contact, status, notes, createdAt, updatedAt, handoverId? } ]` newest first |
| `GET /api/prospects/:id` | – | prospect |
| `PATCH /api/prospects/:id` | `{ status: "new"|"contacted"|"converted"|"closed", notes }` | prospect |
| `POST /api/prospects/:id/convert` | – | 201 + a new handover (customer from the contact details, answers under `questionnaire`); 409 if already converted |
| `DELETE /api/prospects/:id` | – | 204 |

## Homeowner private link (no login)

`GET /api/public/:token` → `{ handover, settings }` where `handover` has only: customer `{ name, address }`, handoverDate, designer, checks, defects, contacts, places, finishAreas, signoff, and `schedule` with stage `notes` removed. 404 for an unknown or replaced link. `view.html` uses this; `/h/<token>` is routed to it by `netlify.toml`.

## Customer portal (signed-in customer)

| Route | Body | Returns |
|---|---|---|
| `POST /api/portal/request-code` | `{ email }` | always `{ ok: true }`. If the email is on a record, a 6-digit code is emailed (10-minute life). Rate limit 10/hour/IP |
| `POST /api/portal/verify` | `{ email, code }` | 200 + sets `m2d_c`; 401 if wrong (5 wrong tries burn the code) |
| `POST /api/portal/logout` | – | `{ ok: true }`, clears `m2d_c` |
| `GET /api/portal/me` | – | `{ email, handovers: [ portalView ], settings }` |
| `POST /api/portal/questionnaire` | `{ id?, answers }` | `{ ok, questionnaire }` saved onto their record (`id` only needed if they have more than one home with us) |
| `PUT /api/portal/appliances` | `{ id?, items, custom, baths }` (the appliance checklist's state) | `{ ok, appliances }` |
| `GET /api/portal/files/:fid` | – | the file, only if it belongs to one of their records |

`portalView` = the public view above **plus** `id`, `status`, `questionnaire`, `appliances` and `files` (`id, name, size, type, createdAt` only). It never includes phone, email, internal notes, the link token or who uploaded a file.

## Environment variables

| Key | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | yes | signs cookies and one-time codes; 32+ random characters |
| `TEAM_PASSCODE` | at first | legacy shared sign-in; also how the first admin account gets created. Unset it later to force email + password |
| `RESEND_API_KEY` | no | sends customer sign-in codes through Resend. Without it, codes are printed in the function log (fine for testing, not for real customers) |
| `MAIL_FROM` | no | sender shown on code emails, e.g. `M2D <no-reply@m2decor.com.sg>` (the domain must be verified in Resend) |

## Storage

Netlify Blobs stores: `handovers`, `tokens` (private link → id), `settings`, `designers`, `prospects`, `files` (bytes, key `handoverId/fileId`), `otp`, `ratelimit`. No database to set up; deleting the Netlify site deletes everything.

## Testing

`npm test` runs `test/api.test.mjs` with in-memory stores (the function checks `globalThis.__M2D_STORES__` first), so tests never touch Netlify.
