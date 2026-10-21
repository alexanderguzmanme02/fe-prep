# FE Prep Planner

A personal study planner for the NCEES FE Other Disciplines exam. Each person signs in with email and password, enters their exam date and the hours they can study, optionally connects Google Calendar, Outlook or an .ics file, and gets a day-by-day plan that works around their busy time. The plan can be added to their calendar and re-planned when they fall behind.

Plain HTML/JS. No build step. Hosted on GitHub Pages; accounts and saved plans use Firebase (free tier).

Live site: https://alexanderguzmanme02.github.io/fe-prep/

---

## Setup (one time, about 20 minutes)

Until step B is done the site runs in **demo mode**: no real accounts, plans stay in the visitor's browser.

### A. Publish on GitHub Pages
1. Go to https://github.com/new. Repository name: `fe-prep`. Visibility: **Public**. Click **Create repository**.
2. On the new repo page click **uploading an existing file**. Drag in every file from the `fe-prep-site` folder (the files, not the folder). Click **Commit changes**.
3. **Settings → Pages**. Source: **Deploy from a branch**. Branch: **main**, folder **/(root)**. **Save**.
4. After 1–2 minutes the site is live at `https://alexanderguzmanme02.github.io/fe-prep/`.

### B. Accounts and saved plans (Firebase)
1. https://console.firebase.google.com → **Create a project** → name `fe-prep` → turn off Google Analytics → **Create**.
2. **Build → Authentication → Get started → Email/Password → Enable → Save.**
   Then the **Settings** tab → **Authorized domains → Add domain** → `alexanderguzmanme02.github.io`.
3. **Build → Firestore Database → Create database** → Standard edition → location close to you → **Start in production mode** → **Create**.
   Open the **Rules** tab, replace everything with the contents of `firestore.rules`, click **Publish**.
4. **Project settings** (gear icon) → **General** → *Your apps* → the **</>** (Web) icon → nickname `fe-prep` → **Register app**.
   Copy the four values `apiKey`, `authDomain`, `projectId`, `appId` into `config.js`.

### C. "Connect Google Calendar" (same project)
1. https://console.cloud.google.com → top bar: choose project **fe-prep**.
2. **APIs & Services → Library** → search **Google Calendar API** → **Enable**.
3. **Google Auth Platform** (or *OAuth consent screen*) → **Get started**: App name `FE Prep Planner`, your email, Audience **External**, finish.
   - **Data access → Add or remove scopes** → add `.../auth/calendar.freebusy` and `.../auth/calendar.app.created` → Update → Save.
   - **Audience → Test users → Add users**: your email and each friend’s Google email (up to 100).
4. **Clients → Create client** → Application type **Web application** → *Authorized JavaScript origins*: `https://alexanderguzmanme02.github.io` → **Create**. Copy the **Client ID** into `config.js` → `googleClientId`.

While the app is in testing, Google shows a “Google hasn’t verified this app” screen. Test users click **Continue**. The site only asks to see busy times and to manage the one “FE Study Plan” calendar it creates. It never reads event details.

### D. "Connect Outlook" (optional)
1. https://portal.azure.com → **Microsoft Entra ID → App registrations → New registration**.
   - Name `FE Prep Planner`.
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**.
   - Redirect URI: platform **Single-page application (SPA)**, URL `https://alexanderguzmanme02.github.io/fe-prep/`.
   - **Register**.
2. **API permissions → Add a permission → Microsoft Graph → Delegated → Calendars.ReadWrite → Add.**
3. Copy the **Application (client) ID** into `config.js` → `microsoftClientId`.

Work or school Outlook accounts may need their IT admin to approve the app; personal Outlook.com accounts work directly.

### E. Turn it on
Edit `config.js` on GitHub (open the file → pencil icon → paste the values → **Commit changes**). The live site updates in a minute.

---

## Files
| File | What it does |
|---|---|
| `index.html`, `styles.css` | Page shell and look |
| `app.js` | Screens: sign-in, setup, today, plan, topic guides |
| `scheduler.js` | Builds the plan from exam date, availability and busy time |
| `calendars.js` | Google / Outlook connections, .ics import and export |
| `store.js` | Firebase sign-in and saved plans (demo mode without keys) |
| `data.js` | Study content: topics, sessions, videos, calculator moves |
| `config.js` | Service keys (public identifiers) |
| `firestore.rules` | Each person can read and write only their own plan |
