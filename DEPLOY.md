# Deployment Guide

## Architecture

| Service   | Platform   | URL                                          |
| --------- | ---------- | -------------------------------------------- |
| Frontend  | Vercel     | https://your-app.vercel.app                  |
| Backend   | Railway    | https://your-backend.up.railway.app          |
| Worker    | Railway    | (internal, same project as backend)          |
| MongoDB   | Railway    | Internal Railway network                     |
| Redis     | Railway    | Internal Railway network                     |

---

## Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/OmarTaima/LocalERP.git
git push -u origin main
```

---

## Step 2 — Deploy MongoDB + Redis on Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project** → **Empty Project**
3. Inside the project, click **+ New** → **Database** → **MongoDB**
4. Note the `MONGO_URI` from the MongoDB service variables
5. Click **+ New** → **Database** → **Redis**
6. Note the `REDIS_URL` from the Redis service variables

---

## Step 3 — Deploy Backend on Railway

1. In the same Railway project, click **+ New** → **GitHub Repo**
2. Select your `LocalERP` repo
3. Railway will detect the `backend/railway.json` — confirm the settings
4. Go to **Settings** → set **Root Directory** to `.` (repo root)
5. Set **Dockerfile Path** to `backend/Dockerfile`
6. Go to **Variables** and add:

```
NODE_ENV=production
PORT=4000
MONGO_URI=<your-mongo-uri-from-step-2>
REDIS_URL=<your-redis-url-from-step-2>
JWT_SECRET=<generate-a-long-random-string>
JWT_EXPIRES_IN=1h
REFRESH_EXPIRES_IN_DAYS=30
CORS_ORIGIN=https://your-app.vercel.app
```

7. Railway will auto-deploy. Note the generated URL (e.g. `https://backend-xxx.up.railway.app`)

---

## Step 4 — Deploy Worker on Railway

1. In the same Railway project, click **+ New** → **GitHub Repo**
2. Select the same `LocalERP` repo
3. Set **Root Directory** to `.` and **Dockerfile Path** to `worker/Dockerfile`
4. Set **Variables**:

```
NODE_ENV=production
REDIS_URL=<your-redis-url-from-step-2>
```

5. Deploy. The worker runs as a background job processor (no HTTP port needed).

---

## Step 5 — Deploy Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New** → **Project**
3. Import `OmarTaima/LocalERP`
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build --workspace=shared && npm run build --workspace=frontend`
   - **Output Directory**: `.next`
5. Add **Environment Variable**:

```
NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app/api/v1
```

6. Click **Deploy**

---

## Step 6 — Update CORS

After Vercel gives you the frontend URL, go back to the **Backend** Railway service and update:

```
CORS_ORIGIN=https://your-actual-vercel-url.vercel.app
```

---

## Cost Estimate

| Service   | Free Tier                                |
| --------- | ---------------------------------------- |
| Vercel    | 100 GB bandwidth, 1000 build min/month  |
| Railway   | $5 credit/month (covers hobby projects) |
| MongoDB   | Included in Railway's $5 credit          |
| Redis     | Included in Railway's $5 credit          |

---

## Useful Commands

```bash
# View Railway logs
railway logs

# Run seed script on production
railway run npm run seed --workspace=backend

# Check build locally before deploying
docker build -f backend/Dockerfile .
docker build -f worker/Dockerfile .
```

---

## Troubleshooting

- **Backend can't connect to MongoDB**: Ensure `MONGO_URI` uses the Railway internal hostname, not `localhost`
- **Worker can't connect to Redis**: Same — use Railway's internal Redis URL
- **CORS errors**: Make sure `CORS_ORIGIN` matches your exact Vercel URL (including `https://`)
- **Build fails on Railway**: Ensure the root directory is set to `.` (repo root), not `backend/` or `frontend/`
