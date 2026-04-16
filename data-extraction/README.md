# 📇 IITJ Google Directory Contact Fetcher

Fetch **name, email, phone number, and profile photo** for every contact in your Google Directory — in one command.

---

## ⚡ Quick Start

### Step 1 — Install dependencies

```bash
cd "IITJ student Scouter"
pip install -r requirements.txt
```

---

### Step 2 — Get Google API Credentials (one-time setup)

You need an **OAuth 2.0 Client ID** from Google Cloud Console. This lets the script authenticate as *you*.

1. Go to → [https://console.cloud.google.com/](https://console.cloud.google.com/)
2. Create a **new project** (or select an existing one)
3. Go to **APIs & Services → Library**
   - Search for and **enable** `People API`
4. Go to **APIs & Services → OAuth consent screen**
   - Choose **Internal** (if you're on Google Workspace / IITJ account) or **External**
   - Fill in App name, your email, and save
   - Under **Scopes**, add:
     - `.../auth/directory.readonly`
     - `.../auth/contacts.readonly`
5. Go to **APIs & Services → Credentials**
   - Click **Create Credentials → OAuth client ID**
   - Application type: **Desktop app**
   - Click **Create**, then **Download JSON**
6. Rename the downloaded file to `credentials.json` and place it in this folder:

```
IITJ student Scouter/
├── credentials.json   ← here
├── fetch_contacts.py
└── requirements.txt
```

---

### Step 3 — Run the script

```bash
python fetch_contacts.py
```

A browser window will open asking you to log in with your Google account. After you authorize:

- ✅ `contacts.csv` — all contacts (name, email, phone, photo URL)
- 🖼️ `contact_photos/` — profile photo images (`.jpg` files)
- 🔑 `token.json` — cached auth token (next runs won't need the browser)

---

## 📁 Output Structure

```
IITJ student Scouter/
├── credentials.json
├── token.json          (auto-created after first login)
├── contacts.csv        ← your contacts data
├── contact_photos/     ← profile photos
│   ├── people_abc123.jpg
│   └── ...
├── fetch_contacts.py
└── requirements.txt
```

### Sample `contacts.csv`

| Name         | Email                  | Phone        | Photo URL | Photo Path                        |
|--------------|------------------------|--------------|-----------|-----------------------------------|
| Rahul Sharma | rahul@iitj.ac.in       | +91-9876543210 | https://… | contact_photos/people_abc.jpg   |
| Priya Singh  | priya@iitj.ac.in       |              | https://… | contact_photos/people_def.jpg   |

---

## ⚙️ Configuration

Edit these at the top of `fetch_contacts.py`:

| Variable         | Default             | Description                              |
|------------------|---------------------|------------------------------------------|
| `OUTPUT_CSV`     | `contacts.csv`      | Output file name                         |
| `PHOTOS_DIR`     | `contact_photos`    | Folder to save photos                    |
| `DOWNLOAD_PHOTOS`| `True`              | Set to `False` to skip photo downloads   |

---

## ❓ Troubleshooting

| Problem | Fix |
|---|---|
| `credentials.json not found` | Download the OAuth client JSON from Cloud Console (Step 2) |
| `No contacts found` | Your account may be personal (not Workspace); the script will auto-fall back to personal contacts |
| `403 / accessNotConfigured` | Make sure the **People API** is enabled in your project |
| `Invalid scope` | Re-run and re-authorize; delete `token.json` first to force re-login |

---

## 🔒 Privacy Note

- `credentials.json` and `token.json` contain sensitive auth data. **Do not commit them to Git.**
- Add these to `.gitignore`:

```
credentials.json
token.json
contact_photos/
contacts.csv
```
