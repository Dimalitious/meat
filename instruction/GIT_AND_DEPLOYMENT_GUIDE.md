# Git and Deployment Guide

> [!WARNING]
> **Important: Database Limitation**
> This project uses `localStorage` (browser memory) instead of a real database.
> This means that when deployed to the internet, **data will NOT sync between users**.
> If you open the site on a phone and add an order, you will NOT see it on your computer. Each user will see their own empty version.
> To allow full multi-user collaboration, you would need to rewrite `storage.js` and add a Backend.

## Part 1: Working with Git

To deploy the project, it must first be uploaded to **GitHub**.

### 1. Preparation

Ensure Git is installed.
Check via terminal: `git --version`

### 2. Initialize Repository

Open the terminal in the project folder and run these commands sequentially:

```bash
# 1. Initialize git in the current folder
git init

# 2. Create .gitignore to avoid uploading unnecessary files (if not present)
# On Windows you can create the file manually or run:
echo node_modules/ > .gitignore
echo .DS_Store >> .gitignore
echo .vscode/ >> .gitignore

# 3. Add all files to staging
git add .

# 4. Create the first commit
git commit -m "Initial commit of ERP system"

# 5. Rename main branch to 'main' (standard practice)
git branch -M main
```

### 3. Upload to GitHub

1. Go to [github.com](https://github.com) and create a **New Repository**.
2. Name it, e.g., `my-erp-project`.
3. Do NOT check "Add README" or "gitignore" (we strongly skipped this).
4. Copy the repository URL (e.g., `https://github.com/Startsev/my-erp-project.git`).
5. In your terminal, run:

```bash
# Link your local project to GitHub
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push the files
git push -u origin main
```

---

## Part 2: Deployment

Since your project consists only of static files (HTML/CSS/JS), **Cloudflare Pages** or **Vercel** are the best options.

### Option 1: Cloudflare Pages (Recommended)

Cloudflare is free, fast, and reliable.

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Navigate to **Workers & Pages** -> **Overview**.
3. Click **Create Application** -> **Pages** tab -> **Connect to Git**.
4. Select your GitHub account and the `my-erp-project` repository.
5. **Build Settings:**
    * **Framework preset:** None (leave empty, as this is pure HTML).
    * **Build command:** Leave empty.
    * **Build output directory:** Leave empty (or set to `.` if prompted, but usually not needed for root).
6. Click **Save and Deploy**.

Your site will be available at a URL like `https://my-erp-project.pages.dev`.

---

### Option 2: Vercel

Also a great option for static sites.

1. Go to [vercel.com](https://vercel.com) and log in via GitHub.
2. Click **Add New...** -> **Project**.
3. Find your `my-erp-project` repository and click **Import**.
4. In "Framework Preset", select **Other** (since there are no frameworks).
5. **Root Directory**: `./` (default).
6. Click **Deploy**.

---

### Option 3: Railway

Railway is more focused on servers (Node.js, Python) but can host static sites.

1. Go to [railway.app](https://railway.app/).
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Select the repository.
4. Railway might try to detect the project type. If it doesn't understand it's static, you might need a `Dockerfile`.
    * *Tip:* For pure HTML/JS, Cloudflare and Vercel are much simpler.
    * If you must use Railway, try to select a **Deploy Static Site** template if available.

**Recommendation:** Use **Cloudflare Pages** for this specific project.
