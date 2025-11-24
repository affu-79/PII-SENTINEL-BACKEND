# PII Sentinel Backend - Render.com Deployment Guide

## 🚀 Quick Deploy to Render

### Prerequisites
- GitHub account with your code pushed
- MongoDB Atlas account (free tier available)
- Render.com account (free tier available)
- Domain name (optional, Render provides one)

---

## Step 1: Prepare Your Repository

### 1.1 Commit All Production Files
```bash
cd backend
git add .
git commit -m "Production ready: Add Render deployment config"
git push origin main
```

### 1.2 Verify Files Are Present
Ensure these files exist in your `backend/` directory:
- ✅ `render.yaml` - Render deployment configuration
- ✅ `gunicorn_config.py` - Gunicorn server config
- ✅ `requirements.txt` - Python dependencies (with gunicorn)
- ✅ `.env.production` - Environment template (NOT committed)
- ✅ `app.py` - Updated with Flask secret key

---

## Step 2: Setup MongoDB Atlas

### 2.1 Create a Free Cluster
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up or log in
3. Create a new cluster (M0 Free tier is fine for testing)
4. Wait for cluster to be created (~5 minutes)

### 2.2 Configure Database Access
1. Go to **Database Access** → **Add New Database User**
2. Choose **Password** authentication
3. Username: `pii_sentinel_admin`
4. Password: Generate a strong password (save it!)
5. User Privileges: **Atlas Admin** or **Read/Write to any database**
6. Click **Add User**

### 2.3 Configure Network Access
1. Go to **Network Access** → **Add IP Address**
2. Choose **Allow Access from Anywhere** (0.0.0.0/0)
   - *Note: For production, whitelist only Render's IPs*
3. Click **Confirm**

### 2.4 Get Connection String
1. Go to **Database** → **Connect** → **Connect your application**
2. Driver: **Python**, Version: **3.11 or later**
3. Copy the connection string:
   ```
   mongodb+srv://pii_sentinel_admin:<password>@cluster0.xxxxx.mongodb.net/
   ```
4. Replace `<password>` with your actual password

---

## Step 3: Deploy to Render

### 3.1 Create New Web Service
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New** → **Blueprint** (if using `render.yaml`)
   - OR click **New** → **Web Service** (manual setup)

### 3.2 Connect GitHub Repository
1. Select **Connect to GitHub**
2. Authorize Render to access your repository
3. Select your `PII-Sentinel-backend` repository
4. Branch: `main`
5. Root Directory: `backend` (if your code is in backend folder)

### 3.3 Configure Blueprint (if using render.yaml)
1. Render will detect `render.yaml` automatically
2. Click **Apply**
3. Proceed to **Step 3.4** to set environment variables

### 3.4 Configure Service Settings (Manual Setup)
If NOT using blueprint:
- **Name**: `pii-sentinel-backend`
- **Environment**: `Python 3`
- **Region**: Choose closest to your users
- **Branch**: `main`
- **Build Command**:
  ```bash
  cd backend && pip install --upgrade pip && pip install -r requirements.txt
  ```
- **Start Command**:
  ```bash
  cd backend && gunicorn -c gunicorn_config.py app:app
  ```
- **Plan**: Select **Starter** ($7/month) or **Free** (with limitations)

### 3.5 Add Disk Storage
1. In service settings, scroll to **Disks**
2. Click **Add Disk**
3. Name: `pii-sentinel-data`
4. Mount Path: `/opt/render/project/src/backend/data`
5. Size: 10 GB (adjust as needed)
6. Click **Save**

---

## Step 4: Configure Environment Variables

### 4.1 Required Environment Variables
In Render Dashboard → Your Service → **Environment**, add:

#### MongoDB (CRITICAL)
```
MONGO_URI = mongodb+srv://pii_sentinel_admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/
MONGO_DB_PREFIX = pii_sentinel_
MONGO_POOL_SIZE = 100
```

#### Security Keys
Generate using `python generate_secrets.py`:
```
FLASK_SECRET = [generated-secret-key]
API_KEY = [generated-api-key]
```

#### Server Configuration
```
FLASK_ENV = production
ENVIRONMENT = production
FLASK_HOST = 0.0.0.0
FLASK_PORT = 10000
LOG_LEVEL = WARNING
```

#### CORS (Replace with YOUR frontend URL)
```
CORS_ORIGINS = https://your-frontend-domain.com
```

#### Storage Path
```
STORAGE_PATH = /opt/render/project/src/backend/data
```

#### Performance
```
MAX_IO_WORKERS = 64
MAX_CPU_WORKERS = 8
MAX_CONCURRENT_FILES = 128
BATCH_SIZE = 50
```

#### OCR Settings
```
USE_GPU_OCR = false
PDF_DPI = 150
OCR_QUANTIZED = true
USE_ADVANCED_DETECTOR = true
```

#### Gunicorn
```
GUNICORN_WORKERS = 4
```

### 4.2 Optional Environment Variables

#### SMS (for OTP)
**Option 1: 2Factor.in** (India)
```
TWO_FACTOR_API_KEY = your_2factor_api_key
```

**Option 2: Twilio** (Global)
```
TWILIO_ACCOUNT_SID = your_twilio_sid
TWILIO_AUTH_TOKEN = your_twilio_token
TWILIO_PHONE_NUMBER = +1234567890
```

#### Razorpay (Payments)
```
RAZORPAY_KEY_ID = rzp_test_xxxxx
RAZORPAY_KEY_SECRET = your_secret
RAZORPAY_WEBHOOK_SECRET = your_webhook_secret
ENABLE_PAYMENT_SIMULATION = false
```

#### Google OAuth
```
GOOGLE_CLIENT_ID = xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET = your_google_secret
```

---

## Step 5: Deploy & Verify

### 5.1 Trigger Deployment
1. Click **Create Web Service** (or **Manual Deploy**)
2. Render will:
   - Clone your repository
   - Install dependencies
   - Start Gunicorn server
3. Watch the logs for any errors

### 5.2 Check Build Logs
Look for these success indicators:
```
✅ Successfully installed requirements
✅ Starting Gunicorn server...
✅ Gunicorn server ready to accept connections
✅ Worker spawned (pid: xxxx)
```

### 5.3 Verify Deployment
Once deployed, Render provides a URL like:
```
https://pii-sentinel-backend.onrender.com
```

Test the health endpoint:
```bash
curl https://pii-sentinel-backend.onrender.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-23T...",
  "version": "1.0.0"
}
```

---

## Step 6: Update Frontend Configuration

### 6.1 Update Frontend API URL
In your frontend `.env`:
```env
REACT_APP_API_URL=https://pii-sentinel-backend.onrender.com
```

### 6.2 Update CORS in Backend
Go back to Render → Environment Variables:
```
CORS_ORIGINS = https://your-deployed-frontend.com,https://www.your-deployed-frontend.com
```

Click **Save Changes** → Render will redeploy automatically

---

## Step 7: Setup Custom Domain (Optional)

### 7.1 Add Custom Domain
1. In Render Dashboard → Your Service → **Settings**
2. Scroll to **Custom Domain**
3. Click **Add Custom Domain**
4. Enter: `api.yourdomain.com`
5. Render will provide DNS records to add

### 7.2 Configure DNS
In your domain registrar (GoDaddy, Namecheap, Cloudflare):
1. Add **CNAME** record:
   - Name: `api`
   - Value: `pii-sentinel-backend.onrender.com`
   - TTL: 3600
2. Wait for DNS propagation (5-30 minutes)

### 7.3 Verify SSL Certificate
Render automatically provisions SSL certificates (Let's Encrypt)
Your API will be available at: `https://api.yourdomain.com`

---

## Step 8: Post-Deployment Monitoring

### 8.1 Check Service Health
Visit Render Dashboard to monitor:
- **Metrics**: CPU, Memory, Bandwidth usage
- **Logs**: Real-time application logs
- **Events**: Deployment history, restarts

### 8.2 Setup Alerts (Render Pro)
For production, consider upgrading to Render Pro for:
- Email alerts on service crashes
- Slack/Discord webhooks
- Zero-downtime deploys
- Auto-scaling

### 8.3 Monitor MongoDB
In MongoDB Atlas:
- **Metrics**: Database operations, connections
- **Alerts**: Setup alerts for high CPU, connection spikes
- **Backups**: Configure automated backups (Render Free tier has no backup)

---

## Troubleshooting

### Build Failed
**Check Render build logs for errors:**
```bash
# Common issues:
# 1. Missing dependencies in requirements.txt
# 2. Python version mismatch
# 3. Tesseract OCR not installed (should be auto-installed)
```

**Solution:**
- Verify `requirements.txt` is complete
- Check Python version in `render.yaml` (should be 3.11)
- Re-trigger deploy

### Application Crashes on Startup
**Check application logs:**
```
# Common issues:
# 1. MONGO_URI not set or invalid
# 2. Missing environment variables
# 3. Import errors (missing dependencies)
```

**Solution:**
- Verify all required env vars are set
- Test MongoDB connection string locally first
- Check for typos in environment variable names

### 502 Bad Gateway
**Means Gunicorn isn't starting:**
```
# Check logs for:
# - Port binding errors
# - Worker timeout errors
# - Out of memory errors
```

**Solution:**
- Reduce `GUNICORN_WORKERS` to 2
- Increase timeout in `gunicorn_config.py`
- Upgrade Render plan for more memory

### High Memory Usage
**Render Free tier has 512MB RAM limit:**
```
# Optimization tips:
# 1. Reduce MAX_IO_WORKERS
# 2. Reduce GUNICORN_WORKERS
# 3. Enable OCR_QUANTIZED
# 4. Disable GPU features
```

### CORS Errors
**Frontend can't reach backend:**
```
# Verify:
# 1. CORS_ORIGINS includes your frontend URL
# 2. Frontend API_URL points to Render service
# 3. Both use HTTPS (not mixed HTTP/HTTPS)
```

---

## Production Best Practices

### 1. Security
- ✅ Use strong, unique secrets for FLASK_SECRET and API_KEY
- ✅ Rotate secrets every 90 days
- ✅ Enable MongoDB IP whitelist (don't use 0.0.0.0/0 in production)
- ✅ Use HTTPS only (Render does this automatically)
- ✅ Set up Razorpay webhook signature verification

### 2. Performance
- ✅ Use Starter plan or higher for production (Free tier sleeps after inactivity)
- ✅ Enable Redis caching for high-traffic apps
- ✅ Monitor response times and optimize slow endpoints
- ✅ Use CDN for static assets

### 3. Reliability
- ✅ Setup MongoDB backups (Atlas has automated backups)
- ✅ Configure health checks in Render
- ✅ Setup uptime monitoring (UptimeRobot, Pingdom)
- ✅ Test disaster recovery procedures

### 4. Cost Optimization
- ✅ Start with Starter plan ($7/month)
- ✅ Monitor bandwidth usage (1st GB free, then $0.10/GB)
- ✅ Optimize file storage (use cloud storage for large files)
- ✅ Use MongoDB M0 free tier for small workloads

---

## Scaling for Growth

### When to Scale Up

**Signs you need to upgrade:**
- Response times > 2 seconds
- Memory usage > 80%
- CPU usage > 80%
- Frequent worker timeouts
- High error rates

**Scaling options:**
1. **Vertical**: Upgrade Render plan (Standard → Pro → Pro Plus)
2. **Horizontal**: Add Redis for session storage, use CDN
3. **Database**: Upgrade MongoDB Atlas tier (M0 → M10 → M20)

---

## Support & Resources

- **Render Docs**: https://render.com/docs
- **MongoDB Atlas Docs**: https://docs.atlas.mongodb.com/
- **Gunicorn Docs**: https://docs.gunicorn.org/
- **Render Community**: https://community.render.com/

---

## Deployment Checklist

Before going live, verify:

- [ ] All environment variables set in Render
- [ ] MongoDB connection working
- [ ] Health check endpoint returns 200 OK
- [ ] CORS configured with frontend domain
- [ ] SSL certificate active (HTTPS working)
- [ ] API key authentication working
- [ ] File uploads working (disk storage mounted)
- [ ] OTP SMS delivery working (Twilio/2Factor)
- [ ] Razorpay payments working (if enabled)
- [ ] Google OAuth working (if enabled)
- [ ] Frontend connected to backend API
- [ ] Error tracking setup (optional: Sentry)
- [ ] Monitoring/alerts configured
- [ ] Backup strategy in place

**Congratulations! Your PII Sentinel backend is now live on Render! 🎉**

