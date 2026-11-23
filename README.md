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

## Gift Center (pbflyers.janienation.com/#gifts)

A gallery of client thank-you gifts with prices that are checked every morning, for free.
Pegah sees the gallery. Janie's two accounts also see **Add gift**, **Edit**, **Check price** and **Hide**.

**One-time setup**

1. **Firestore rule.** In the Firebase console for pegah-briefing: Firestore Database, Rules tab. Add this block next to the
   pbflyers ones and Publish. Everyone signed in can read; only Janie's accounts can add, edit or delete.
   ```
       match /pbflyers_gifts/{id} {
         allow read: if request.auth != null && request.auth.token.email in
           ['pegah@originpoint.com', 'janie.houlgrave@compass.com', 'janiehoulgrave@gmail.com'];
         allow write: if request.auth != null && request.auth.token.email in
           ['janie.houlgrave@compass.com', 'janiehoulgrave@gmail.com'];
       }
   ```
2. **Daily price check.** Firebase console, Project settings, Service accounts, **Generate new private key**
   (the same key PB Studio uses as `FIREBASE_SERVICE_ACCOUNT` works). In GitHub: this repo, Settings, Secrets and variables,
   Actions, **New repository secret**, name `FIREBASE_SERVICE_ACCOUNT`, paste the whole JSON file as the value.
   The check runs at 6 AM Eastern once this branch is on `main`. To run it now: Actions tab, **Gift prices**, **Run workflow**.

**How prices work**

- The check opens each product page once a day and reads the price from the page's built-in product data
  (schema.org JSON-LD, then product meta tags). No paid services and no Google Shopping.
- If a site blocks the check, the last known price stays on the card with its date, and Janie's view flags it.
  Set the price by hand from **Edit**. A hand-set price is shown until it is cleared.
- New gifts are checked as soon as they are saved, then every morning. Hidden gifts are still checked.
- GitHub pauses scheduled jobs in repos with no activity for 60 days. If that happens, the Actions tab shows a button to turn it back on.

**Where things are:** `src/Gifts.jsx` (page and form), `src/lib/gifts.js` (Firestore), `src/lib/giftPrice.js` (shared price rules),
`api/_price.js` (reads a product page), `api/product.js` (fills the Add gift form), `scripts/check-prices.mjs` and
`.github/workflows/gift-prices.yml` (the daily check). `npm test` checks the price reader.

## What's where

- `src/pdf/templates/` one file per flyer family. Disclosure text lives here and is locked in the app.
- `src/lib/calc.js` all mortgage math (matches Pegah's buydown spreadsheet to the cent).
- `api/compass.js` pulls agent and listing details from compass.com links.
- `api/img.js` fetches Compass photos and converts them to print JPEGs.
- `public/fonts`, `public/assets` brand fonts, logos, headshot, stock photos.
- `public/thumbs` gallery previews.

## Adding a new flyer

Send Claude the approved PDF. It becomes a new file in `src/pdf/templates/` plus a thumbnail.
