# OmniScript Backend Deployment Guide

## Hugging Face Spaces Deployment

### Prerequisites

1. Hugging Face account
2. SSH key configured (see below)
3. External database services (PostgreSQL, Redis, MongoDB)

### Step 1: Add SSH Key to Hugging Face

**Your SSH Public Key:**
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMGIA6vDgqceFTtARXgbX8yXzoIqqtV5zaedPJYkhp49 vidhitts@gmail.com
```

**Add to Hugging Face:**
1. Go to https://huggingface.co/settings/keys
2. Click "Add SSH Key"
3. Paste the public key above
4. Give it a name (e.g., "MacBook Pro")
5. Click "Add"

### Step 2: Clone the Space Repository

```bash
git clone git@hf.co:spaces/Vidhitts/omniScript
cd omniScript
```

### Step 3: Copy Backend Files

```bash
# Copy all backend files to the space
cp -r backend/* omniScript/
cd omniScript
```

### Step 4: Configure Environment Variables

Go to your Space settings on Hugging Face and add these secrets:

#### Required Environment Variables

**Database:**
```bash
DATABASE_URL=postgresql://user:password@host:5432/omniscript
```

**Redis:**
```bash
REDIS_URL=redis://host:6379
```

**MongoDB:**
```bash
MONGODB_URI=mongodb://host:27017/omniscript
```

**JWT Secrets:**
```bash
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars
```

**API Keys:**
```bash
GROQ_API_KEY=gsk_your_groq_api_key
COHERE_API_KEY=your_cohere_api_key
```

**Server Configuration:**
```bash
PORT=7860
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-url.com
```

### Step 5: Push to Hugging Face

```bash
git add .
git commit -m "Initial backend deployment"
git push origin main
```

### Step 6: Monitor Deployment

1. Go to your Space: https://huggingface.co/spaces/Vidhitts/omniScript
2. Check the "Logs" tab for build progress
3. Wait for the build to complete (5-10 minutes)
4. Test the health endpoint: `https://vidhitts-omniscript.hf.space/health`

## Database Setup

### Option 1: Managed Services (Recommended)

**PostgreSQL:**
- [Neon](https://neon.tech) - Free tier available
- [Supabase](https://supabase.com) - Free tier available
- [Railway](https://railway.app) - $5/month

**Redis:**
- [Upstash](https://upstash.com) - Free tier available
- [Redis Cloud](https://redis.com/cloud) - Free tier available

**MongoDB:**
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) - Free tier available

### Option 2: Self-Hosted

Use Railway, Render, or DigitalOcean to host your databases.

## Post-Deployment

### Run Database Migrations

After deployment, you need to run Prisma migrations:

```bash
# SSH into your space (if available) or use Hugging Face CLI
npx prisma migrate deploy
```

### Test the API

```bash
# Health check
curl https://vidhitts-omniscript.hf.space/health

# Register a user
curl -X POST https://vidhitts-omniscript.hf.space/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","fullName":"Test User"}'
```

## Troubleshooting

### Build Fails

1. Check logs in Hugging Face Space
2. Verify all environment variables are set
3. Ensure Dockerfile is correct

### Database Connection Issues

1. Verify DATABASE_URL is correct
2. Check if database allows connections from Hugging Face IPs
3. Test connection string locally first

### Out of Memory

1. Reduce worker processes
2. Optimize chunk sizes
3. Consider upgrading to a paid Space tier

## Monitoring

### Logs

View logs in Hugging Face Space dashboard:
- Build logs: Shows Docker build process
- Runtime logs: Shows application logs

### Health Check

Monitor: `https://vidhitts-omniscript.hf.space/health`

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-04-16T10:00:00.000Z"
}
```

## Scaling

### Upgrade Space Tier

For production use, consider upgrading to:
- **CPU Basic**: 2 vCPU, 16GB RAM
- **CPU Upgrade**: 8 vCPU, 32GB RAM
- **GPU**: For ML-heavy workloads

### Optimize Performance

1. Enable Redis caching
2. Use connection pooling
3. Implement rate limiting
4. Add CDN for static assets

## Security Checklist

- [ ] All environment variables set as secrets
- [ ] JWT secrets are strong (32+ characters)
- [ ] Database has strong password
- [ ] CORS_ORIGIN is set to your frontend URL
- [ ] Rate limiting enabled
- [ ] Helmet security headers enabled
- [ ] Database backups configured

## Support

For issues:
1. Check Hugging Face Space logs
2. Review backend logs
3. Test locally with same environment variables
4. Open an issue on GitHub

## Cost Estimation

**Free Tier:**
- Hugging Face Space: Free (with limitations)
- Neon PostgreSQL: Free (1GB storage)
- Upstash Redis: Free (10K commands/day)
- MongoDB Atlas: Free (512MB storage)

**Total: $0/month** (with free tiers)

**Production Tier:**
- Hugging Face Space CPU Basic: $0.60/hour
- Neon PostgreSQL Pro: $19/month
- Upstash Redis Pro: $10/month
- MongoDB Atlas M10: $57/month

**Total: ~$518/month** (24/7 operation)
