# M2D Renovation Progress Tracker

Designers update stages on their login, and the homeowner's login shows the same project, read-only, refreshing every 20 seconds.

## How the accounts link
- Each project stores **one designer email** and **one homeowner email**.
- A **designer** sees and edits only projects with their email on them.
- A **homeowner** sees only projects with their email on them, and can't edit anything.
- An **admin** (you) sees and edits every project and can assign any designer.
- When a designer creates a project, the homeowner is emailed an invite to set their password.

## One-time setup on Netlify (about 15 minutes)
1. **Deploy.** Put this folder in a GitHub repo and use "Import from Git" in Netlify, or run `npx netlify-cli deploy --prod` from this folder. Dragging the folder onto Netlify Drop is **not** enough, because it doesn't set up the server functions.
2. **Turn on logins.** Site configuration → Identity → Enable Identity.
3. **Invite-only.** Identity → Registration → set to *Invite only*, so strangers can't sign up.
4. **Add your team.** Identity → Invite users → enter each designer's email (and yours).
5. **Give roles.** Once they've accepted, open each user → Edit → Roles. Type `designer` for designers and `admin` for yourself. Homeowners need no role.
6. **Optional: branded emails.** Identity → Emails lets you reword the invite email ("Your M2D renovation tracker is ready").
7. **Optional: own address.** Domain management → add `progress.m2decor.com` (or similar), then link it from the main website's "Client login" button.

## Day to day
- **Designer:** log in → New project → enter the homeowner's name and email → untick any stages the project doesn't need → update stages as work happens. Changes save automatically.
- **Not applicable:** any stage (or an M&E part like Aircon) can be marked not applicable later. It's hidden from the homeowner and left out of progress counts, and can be brought back any time.
- **Stages:** the four portions (Preliminaries, Foundation stage, Fittings, Finishing) are set in `PHASES` at the top of the script in `index.html` and in `netlify/lib/shared.mjs`. Edit both together.
- **Homeowner:** clicks the invite email → sets a password → sees their renovation. Later visits just need a login.

## Files
- `index.html` is the whole app (designer and homeowner screens). Opened anywhere other than the Netlify site, it runs as a demo.
- `netlify/functions/projects.mjs` saves and reads projects and enforces who can see or edit what.
- `netlify/functions/photos.mjs` handles site photos (resized on the phone before upload).
- `netlify/functions/invite.js` sends the homeowner invite email.
- Data lives in Netlify Blobs (built in, no separate database to set up).
