# 📅 Daily Events App

A personal app to track your daily activities and view stats over time.

---

## 🔥 Part 1 — Firebase Setup (5 min)

Firebase is a free database from Google that stores your events.

### 1. Create a Firebase project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → enter any name → click through until **Create project**

### 2. Create a database
1. In the left sidebar click **Firestore Database** → **Create database**
2. Choose **Production mode** → pick any region → **Enable**
3. Click the **Rules** tab → replace everything with this → **Publish**:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 3. Enable login (no password needed)
1. In the left sidebar click **Authentication** → **Get started**
2. Click **Anonymous** → toggle it **on** → **Save**

### 4. Get your config keys
1. Click the ⚙️ gear icon (top left) → **Project settings**
2. Scroll down to **Your apps** → click the **</>** icon → enter any nickname → **Register app**
3. You'll see a block of code with 6 values — **keep this tab open**, you'll need it soon

---

## 💻 Part 2 — Run on Your Computer (2 min)

### 1. Download and install
```bash
# In your terminal, go to the project folder then run:
npm install
```

### 2. Add your Firebase keys
Create a file called `.env.local` in the project folder and paste this, filling in your values from the Firebase tab you kept open:
```
VITE_FIREBASE_API_KEY=paste_your_apiKey_here
VITE_FIREBASE_AUTH_DOMAIN=paste_your_authDomain_here
VITE_FIREBASE_PROJECT_ID=paste_your_projectId_here
VITE_FIREBASE_STORAGE_BUCKET=paste_your_storageBucket_here
VITE_FIREBASE_MESSAGING_SENDER_ID=paste_your_messagingSenderId_here
VITE_FIREBASE_APP_ID=paste_your_appId_here
```

### 3. Start the app
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) — your app is running! ✅

---

## 🌐 Part 3 — Put it on the Internet with GitHub (5 min)

### 1. Upload code to GitHub
1. Go to [github.com](https://github.com) → sign in → click **New** (green button)
2. Give the repo a name → **Create repository**
3. Run these commands in your terminal (replace the URL with yours):
```bash
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

### 2. Add your Firebase keys to GitHub
1. On GitHub, go to your repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add these one by one (same values as your `.env.local`):

| Name | Value |
|------|-------|
| `VITE_FIREBASE_API_KEY` | your apiKey |
| `VITE_FIREBASE_AUTH_DOMAIN` | your authDomain |
| `VITE_FIREBASE_PROJECT_ID` | your projectId |
| `VITE_FIREBASE_STORAGE_BUCKET` | your storageBucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | your messagingSenderId |
| `VITE_FIREBASE_APP_ID` | your appId |

### 3. Turn on GitHub Pages
1. In your repo go to **Settings** → **Pages**
2. Under **Source** select **GitHub Actions** → **Save**

### 4. Done! 🎉
Wait ~1 minute, then your app is live at:
**`https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`**

Every time you push new code, it auto-deploys!

---

## ❓ Common Questions

**My app shows a blank screen** — double-check your `.env.local` values match Firebase exactly.

**Changes aren't showing online** — run `git add . && git commit -m "update" && git push` and wait 1 minute.

**I want it on my phone** — just open the GitHub Pages URL in your phone's browser and tap "Add to Home Screen".
