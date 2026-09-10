# StudyPulse — Student Study Tracker with Account Access

A polished, offline-first study tracker with a real multi-user account system.
No backend, no build step, no dependencies to install. Open `index.html` and go.

---

## ✨ Features

### Accounts & Security
- **Real signup / sign-in flow** — name, email, password, confirm password
- **PBKDF2-SHA256 password hashing** (150,000 iterations, per-user random salt)
  via the Web Crypto API — passwords are never stored in plain text
- **Automatic fallback KDF** (in-page SHA-256) so the app still works when
  opened directly from `file://` where `crypto.subtle` is unavailable
- **Remember me** — persistent session (localStorage) or session-only (sessionStorage)
- **Session expiry** — 30 days for remembered sessions, 12 hours otherwise
- **Route guards** — `app.html` bounces to login if not authenticated;
  `index.html` bounces to the app if already signed in
- **Profile management** — change display name, avatar colour, password
- **Delete account** — removes the account and all its data, password-confirmed

### Per-User Data Isolation
Every account gets its own completely private dataset:
subjects, syllabus topics, tasks, deadlines, study sessions and streak.
Data is namespaced under `sp:data:<userId>` in localStorage.

### Study Features
| Area | What it does |
|---|---|
| **Dashboard** | KPI cards (syllabus %, weekly hours, deadlines, streak), subject mastery grid, priority deadline list, recent session log |
| **Subjects & Syllabus** | Create subjects with colour + weekly target, break them into checkable topics, per-subject progress bars, filter chips |
| **Focus Pomodoro** | 25 / 5 / 15 minute modes, animated SVG progress ring, session attribution to a subject, auto-logging, Web Audio chime |
| **Tasks & Exams** | Exams / assignments / quizzes / projects, priority levels, due dates, search + status + type filters |
| **Analytics** | Weekly bar chart, subject time-share doughnut, full session table, JSON export/import |

### Experience
- Light **and** dark theme, remembered per browser, respects OS preference
- Fully responsive — mobile, tablet, desktop
- Toast notifications, animated modals, keyboard-accessible forms
- Zero runtime dependencies (Chart.js is loaded from CDN and degrades gracefully)

---

## 🚀 Quick start

### Option A — just open it
```

Double-click index.html

```
Works from `file://`. The fallback KDF is used because `crypto.subtle` is
unavailable in non-secure contexts.

### Option B — local server (recommended, uses real PBKDF2)
```bash
# Python
python3 -m http.server 8080

# or Node
npx serve .
```

Then visit [http://localhost:8080](http://localhost:8080)

### Option C — deploy

Upload the whole folder to **GitHub Pages**, **Netlify**, **Vercel** or
**Cloudflare Pages**. It is 100% static — no environment variables, no server.

---

## 📁 Project structure

```
studypulse/
├── index.html          Landing page + sign in / sign up
├── app.html            Authenticated dashboard (all 5 tabs)
├── css/
│   ├── base.css        Design tokens, reset, buttons, forms, utilities
│   ├── landing.css     Marketing page + auth modal
│   └── app.css         Dashboard, cards, timer, tables, modals
├── js/
│   ├── crypto.js       SHA-256 + PBKDF2 wrapper with fallback
│   ├── auth.js         Account store, sessions, route guards
│   ├── store.js        Per-user study data layer
│   ├── landing.js      Landing page + auth form logic
│   └── app.js          Full dashboard application
└── README.md
```

---

## 🔐 How the account system works

1. **Signup** — a random 16-byte salt is generated with `crypto.getRandomValues`.
The password is run through PBKDF2-SHA256 (150k iterations) to produce a
256-bit hash. Only `{ salt, hash, iterations, algo }` is persisted.
2. **Sign in** — the same derivation runs against the entered password and is
compared to the stored hash using a constant-time comparison.
3. **Session** — a random 32-byte token is issued with an expiry timestamp.
Stored in `localStorage` (remember me) or `sessionStorage` (this tab only).
4. **Logout** — token cleared from both stores.

### Honest limitations

This is a **client-side** account system. It is genuinely useful for:

- personal multi-profile use on one device
- classroom / lab machines
- demos and portfolios
- static hosting with no backend

It is **not** a substitute for server-side auth if you need:

- accounts that work across different devices
- protection from a user with full DevTools access
- email verification, password reset emails, or OAuth

Swap in Firebase Auth or Supabase Auth (both free) for that — the `Auth`
object in `js/auth.js` is the single seam you'd need to replace.

---

## 💾 Data portability

**Analytics → Export JSON** downloads the signed-in user's complete dataset.
**Analytics → Import JSON** restores it. Backups are per account.

---

## ⌨️ Keyboard

| Key ↕▾ | Action ↕▾ |
|---|---|
| −`Esc` | Close the open modal |
| −`Space` | Start / pause the Pomodoro timer (when on that tab) |
| −`Enter` | Submit the focused form |
⚙

---

## License

MIT — do whatever you want with it.

