require('dotenv').config();
const express = require('express');
const cors = require('cors');
const B2 = require('backblaze-b2');
const { 
  getUnverifiedSubmission, 
  updateSubmission, 
  verifySubmission 
} = require('./admin-endpoints');

const app = express();
const PORT = process.env.PORT || 3000;

const b2 = new B2({
  applicationKeyId: process.env.B2_APPLICATION_KEY_ID,
  applicationKey: process.env.B2_APPLICATION_KEY
});

app.use(cors({
  origin: [
    'http://127.0.0.1:9292',
    'http://localhost:9292',
    'https://chugchamp.com',
    'https://cddgrs-yg.myshopify.com',
    process.env.ALLOWED_ORIGIN
  ].filter(Boolean)
}));
app.use(express.json());
app.use(express.raw({ type: 'video/*', limit: '100mb' }));

let authData = null;
let shopifyAccessToken = null;
let tokenExpiresAt = null;

async function authorizeB2() {
  if (!authData) {
    authData = await b2.authorize();
  }
  return authData;
}

async function getShopifyAccessToken() {
  if (shopifyAccessToken && tokenExpiresAt && new Date() < tokenExpiresAt) {
    return shopifyAccessToken;
  }

  const url = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to get Shopify access token: ${response.status}`);
  }

  const data = await response.json();
  shopifyAccessToken = data.access_token;
  const expiresIn = data.expires_in || 86399;
  tokenExpiresAt = new Date(Date.now() + (expiresIn - 300) * 1000);

  return shopifyAccessToken;
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/get-upload-url', async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    
    if (!filename || !contentType) {
      return res.status(400).json({ error: 'filename and contentType required' });
    }

    const timestamp = Date.now();
    const key = `submissions/${timestamp}-${filename}`;
    
    const uploadUrl = `${req.protocol}://${req.get('host')}/upload/${encodeURIComponent(key)}`;
    
    await authorizeB2();
    const publicUrl = `${authData.downloadUrl}/file/${process.env.B2_BUCKET_NAME}/${key}`;

    res.json({
      uploadUrl,
      publicUrl
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

app.put('/upload/:key', async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const fileBuffer = req.body;

    await authorizeB2();

    const uploadUrlResponse = await b2.getUploadUrl({
      bucketId: process.env.B2_BUCKET_ID
    });

    const uploadResponse = await b2.uploadFile({
      uploadUrl: uploadUrlResponse.data.uploadUrl,
      uploadAuthToken: uploadUrlResponse.data.authorizationToken,
      fileName: key,
      data: fileBuffer,
      contentType: req.get('content-type') || 'video/mp4'
    });

    const publicUrl = `${authData.downloadUrl}/file/${process.env.B2_BUCKET_NAME}/${key}`;

    res.json({
      success: true,
      publicUrl
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

app.delete('/delete/:key', async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);

    await authorizeB2();

    const fileListResponse = await b2.listFileNames({
      bucketId: process.env.B2_BUCKET_ID,
      startFileName: key,
      maxFileCount: 1
    });

    const file = fileListResponse.data.files.find(f => f.fileName === key);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    await b2.deleteFileVersion({
      fileId: file.fileId,
      fileName: file.fileName
    });

    res.json({
      success: true,
      message: 'File deleted'
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

app.post('/submit-chug', async (req, res) => {
  try {
    const handleText = req.body['contact[handle_text]'];
    const leaderboardType = req.body['contact[leaderboard_type]'];
    const beerStyle = req.body['contact[beer_style]'];
    const container = req.body['contact[container]'];
    const videoUrl = req.body['contact[video_url]'];
    const videoUploadUrl = req.body['contact[video_upload_url]'];
    const handleUrl = req.body['contact[handle_url]'];
    const location = req.body['contact[location]'];
    const timeS = req.body['contact[time_s]'];
    const volumeOz = req.body['contact[volume_oz]'];

    if (!handleText || !container || !leaderboardType) {
      return res.status(400).json({ error: 'handle_text, container, and leaderboard_type required' });
    }

    if (!videoUrl && !videoUploadUrl) {
      return res.status(400).json({ error: 'Either video_url or video_upload_url required' });
    }

    if (!timeS) {
      return res.status(400).json({ error: 'time_s is required' });
    }

    if (!volumeOz) {
      return res.status(400).json({ error: 'volume_oz is required' });
    }

    const finalVideoUrl = videoUploadUrl || videoUrl;

    const token = await getShopifyAccessToken();

    const mutation = `
      mutation CreateMetaobject($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject {
            id
            handle
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const fields = [
      { key: 'handle_text', value: handleText },
      { key: 'leaderboard_type', value: leaderboardType },
      { key: 'beer_style', value: beerStyle },
      { key: 'container', value: container },
      { key: 'video_url', value: finalVideoUrl },
      { key: 'time_s', value: timeS },
      { key: 'volume_oz', value: volumeOz },
      { key: 'time_to_rim_s', value: '0.25' },
      { key: 'time_to_setdown_s', value: '0.25' },
      { key: 'splash_pct', value: '0.0' },
      { key: 'foam_pct', value: '0.0' },
      { key: 'date_iso', value: new Date().toISOString() },
      { key: 'verified', value: 'false' }
    ];

    if (handleUrl) {
      fields.push({ key: 'handle_url', value: handleUrl });
    }

    if (location) {
      fields.push({ key: 'location', value: location });
    }

    const variables = {
      metaobject: {
        type: 'beer_leaderboard_entry',
        fields
      }
    };

    const response = await fetch(`https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token
      },
      body: JSON.stringify({ query: mutation, variables })
    });

    const data = await response.json();

    if (data.errors || data.data?.metaobjectCreate?.userErrors?.length > 0) {
      return res.status(400).json({ 
        error: 'Failed to create metaobject',
        details: data.errors || data.data.metaobjectCreate.userErrors
      });
    }

    res.json({
      success: true,
      metaobject: data.data.metaobjectCreate.metaobject
    });
  } catch (error) {
    console.error('Error creating metaobject:', error);
    res.status(500).json({ error: 'Failed to create metaobject' });
  }
});

app.get('/admin/unverified', getUnverifiedSubmission(getShopifyAccessToken, process.env.SHOPIFY_STORE_DOMAIN));
app.patch('/admin/submission/:id', updateSubmission(getShopifyAccessToken, process.env.SHOPIFY_STORE_DOMAIN));
app.post('/admin/verify/:id', verifySubmission(getShopifyAccessToken, process.env.SHOPIFY_STORE_DOMAIN));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
