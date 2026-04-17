# 🚀 OmniScript Backend Deployment Instructions

## ✅ Setup Complete!

Your backend is ready to deploy to Hugging Face Spaces.

---

## 📋 Step 1: Add SSH Key to Hugging Face

**Your SSH Public Key:**
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMGIA6vDgqceFTtARXgbX8yXzoIqqtV5zaedPJYkhp49 vidhitts@gmail.com
```

**Add it to Hugging Face:**
1. Go to: https://huggingface.co/settings/keys
2. Click "Add SSH Key"
3. Paste the key above
4. Name it: "MacBook Pro"
5. Click "Add"

---

## 🔧 Step 2: Configure Environment Variables

Go to your Space settings: https://huggingface.co/spaces/Vidhitts/omniScript/settings

Add these **Secrets**:

### Database (Required)
```bash
DATABASE_URL=postgresql://user:password@host:5432/omniscript
REDIS_URL=redis://host:6379
MONGODB_URI=mongodb://host:27017/omniscript
```

**Recommended Free Services:**
- PostgreSQL: [Neon](https://neon.tech) or [Supabase](https://supabase.com)
- Redis: [Upstash](https://upstash.com)
- MongoDB: [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

### JWT Secrets (Required)
```bash
JWT_SECRET=generate-a-random-32-character-string-here
JWT_REFRESH_SECRET=generate-another-random-32-character-string
```

**Generate strong secrets:**
```bash
# Run these commands to generate random secrets
openssl rand -base64 32
openssl rand -base64 32
```

### API Keys (Required)
```bash
GROQ_API_KEY=gsk_your_groq_api_key
COHERE_API_KEY=your_cohere_api_key
```

Get keys from:
- Groq: https://console.groq.com/keys
- Cohere: https://dashboard.cohere.com/api-keys

### Server Config (Required)
```bash
PORT=7860
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-url.com
```

---

## 🚀 Step 3: Deploy to Hugging Face

```bash
cd deployment/omniScript
git push origin main
```

---

## 📊 Step 4: Monitor Deployment

1. **Watch Build Logs**: https://huggingface.co/spaces/Vidhitts/omniScript
2. **Wait**: Build takes 5-10 minutes
3. **Test Health**: https://vidhitts-omniscript.hf.space/health

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-04-16T10:00:00.000Z"
}
```

---

## 🗄️ Step 5: Run Database Migrations

After deployment, run migrations:

```bash
# Option 1: Using Hugging Face CLI (if available)
huggingface-cli space exec Vidhitts/omniScript -- npx prisma migrate deploy

# Option 2: Connect to your database directly
npx prisma migrate deploy
```

---

## ✅ Step 6: Test the API

```bash
# Health check
curl https://vidhitts-omniscript.hf.space/health

# Register a user
curl -X POST https://vidhitts-omniscript.hf.space/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "fullName": "Test User"
  }'

# Login
curl -X POST https://vidhitts-omniscript.hf.space/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

---

## 🔍 Troubleshooting

### Build Fails
- Check logs in HF Space dashboard
- Verify all environment variables are set
- Ensure database URLs are correct

### Database Connection Issues
- Test connection strings locally first
- Check if database allows external connections
- Verify credentials are correct

### Out of Memory
- Upgrade to paid Space tier
- Reduce worker processes
- Optimize chunk sizes

---

## 📈 Monitoring

### View Logs
- Build logs: Shows Docker build process
- Runtime logs: Shows application logs
- Access at: https://huggingface.co/spaces/Vidhitts/omniScript

### Health Monitoring
Set up monitoring for: `https://vidhitts-omniscript.hf.space/health`

---

## 💰 Cost Estimation

### Free Tier (Development)
- HF Space: Free (with limitations)
- Neon PostgreSQL: Free (1GB)
- Upstash Redis: Free (10K commands/day)
- MongoDB Atlas: Free (512MB)

**Total: $0/month**

### Production Tier
- HF Space CPU Basic: ~$432/month (24/7)
- Neon Pro: $19/month
- Upstash Pro: $10/month
- MongoDB M10: $57/month

**Total: ~$518/month**

---

## 🎯 Next Steps

1. ✅ Add SSH key to Hugging Face
2. ✅ Set up database services
3. ✅ Configure environment variables
4. ✅ Push to deploy
5. ✅ Run migrations
6. ✅ Test API endpoints
7. 🔄 Connect frontend
8. 📊 Set up monitoring

---

## 📞 Support

If you encounter issues:
1. Check HF Space logs
2. Review backend logs
3. Test locally with same env vars
4. Check database connectivity

---

## 🎉 Success!

Once deployed, your backend will be available at:
**https://vidhitts-omniscript.hf.space**

Connect your frontend by setting:
```javascript
const API_URL = 'https://vidhitts-omniscript.hf.space/api';
```
