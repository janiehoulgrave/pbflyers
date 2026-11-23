# Flyer Studio (pbflyers.janienation.com)

Flyer builder for Pegah Bozorgnia (OriginPoint). Pick a flyer, pull a Compass agent and listing by link, enter rates, download a print-ready PDF.

## Deploy (one time)

1. **GitHub:** create a new repo named `pbflyers` and drag everything in this folder into it (keep the folders as they are).
2. **Vercel:** Add New Project → import `pbflyers`. Vercel detects Vite on its own. Click Deploy.
3. **Domain:** in the Vercel project, Settings → Domains → add `pbflyers.janienation.com`. Vercel shows a CNAME record. In GoDaddy DNS for janienation.com, add:
   - Type `CNAME`, Name `pbflyers`, Value `cname.vercel-dns.com`

## Turn on sign-in (uses the PB dashboard Firebase project)

1. Open `src/lib/firebase.js` and paste the values from the PB dashboard's `firebaseConfig` into the empty block.
2. In the Firebase console for that project: Authentication → Settings → Authorized domains → add `pbflyers.janienation.com`.
3. Who can sign in is the `ALLOWED_EMAILS` list in the same file.

Until step 1 is done, the app works without a sign-in screen.

## Turn on the shared library (one time)

Saved flyers live in Firestore in the pegah-briefing project so Pegah and Janie see the same library.
In the Firebase console: Firestore Database, Rules tab. Paste these two blocks inside the existing
`match /databases/{database}/documents { ... }` block (leave the dashboard rules as they are), then Publish.

```
    match /pbflyers_projects/{id} {
      allow read, write: if request.auth != null && request.auth.token.email in
        ['pegah@originpoint.com', 'janie.houlgrave@compass.com', 'janiehoulgrave@gmail.com'];
    }
    match /pbflyers_images/{id} {
      allow read, write: if request.auth != null && request.auth.token.email in
        ['pegah@originpoint.com', 'janie.houlgrave@compass.com', 'janiehoulgrave@gmail.com'];
    }
```

## What's where

- `src/pdf/templates/` one file per flyer family. Disclosure text lives here and is locked in the app.
- `src/lib/calc.js` all mortgage math (matches Pegah's buydown spreadsheet to the cent).
- `api/compass.js` pulls agent and listing details from compass.com links.
- `api/img.js` fetches Compass photos and converts them to print JPEGs.
- `public/fonts`, `public/assets` brand fonts, logos, headshot, stock photos.
- `public/thumbs` gallery previews.

## Adding a new flyer

Send Claude the approved PDF. It becomes a new file in `src/pdf/templates/` plus a thumbnail.
