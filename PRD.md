# Chug Champ Video Upload Backend - PRD

## Overview
A serverless backend service that handles video uploads from the Chug Champ Shopify theme to Backblaze B2 storage.

## Tech Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Storage**: Backblaze B2
- **Hosting**: Render.com

## API Endpoints

### POST `/get-upload-url`
Generate presigned URL for video upload.

**Request:**
```json
{
  "filename": "video.mp4",
  "contentType": "video/mp4"
}
```

**Response:**
```json
{
  "uploadUrl": "https://your-service.onrender.com/upload/submissions/1234567890-video.mp4",
  "publicUrl": "https://f000.backblazeb2.com/file/bucket-name/submissions/1234567890-video.mp4"
}
```

### PUT `/upload/:key`
Upload video file to B2.

**Headers:**
- `Content-Type`: video mime type

**Body:** Raw video file (binary)

**Response:**
```json
{
  "success": true,
  "publicUrl": "https://..."
}
```

### GET `/health`
Health check endpoint.

## Environment Variables

```bash
B2_APPLICATION_KEY_ID=your_key_id
B2_APPLICATION_KEY=your_application_key
B2_BUCKET_NAME=chugchampleaderboard
B2_BUCKET_ID=your_bucket_id
ALLOWED_ORIGIN=https://chugchamp.com
PORT=3000
```

## Backblaze B2 Setup

1. Sign up: https://www.backblaze.com/b2/sign-up.html
2. Create bucket named `chugchampleaderboard` (Public)
3. Create App Key with Read/Write access
4. Save Key ID and Application Key

## File Structure for New Repo

```
chug-upload-backend/
├── index.js              # Express server
├── package.json          # Dependencies
├── .env.example          # Example env vars
├── .gitignore           # Ignore .env
└── README.md            # Setup docs
```

## Dependencies

```json
{
  "express": "^4.18.2",
  "cors": "^2.8.5",
  "backblaze-b2": "^1.7.0",
  "dotenv": "^16.3.1"
}
```

## Deployment to Render

1. Create Web Service on Render.com
2. Connect Git repository
3. Build: `npm install`
4. Start: `node index.js`
5. Add environment variables
6. Deploy

## Shopify Integration

Update `assets/submit-chug.js`:
```javascript
const CONFIG = {
  workerUrl: 'https://your-service.onrender.com/get-upload-url',
  maxFileSize: 100 * 1024 * 1024,
  allowedVideoTypes: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
};
```

## Cost Estimate
- Backblaze B2: ~$0.06-1/month (10-100GB)
- Render: $0 (free tier) or $7/month (production)
- **Total: $7-8/month**

## Security
- CORS restricted to chugchamp.com
- Max file size: 100MB
- B2 credentials never exposed to frontend
- All uploads proxied through backend

## Testing

```bash
# Health check
curl https://your-service.onrender.com/health

# Get upload URL
curl -X POST https://your-service.onrender.com/get-upload-url \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.mp4","contentType":"video/mp4"}'
```
