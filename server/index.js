import express from 'express';
import multer from 'multer';
import cors from 'cors';
import axios from 'axios';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure directories exist
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDir('uploads');
ensureDir('outputs');

// Multer configuration for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Daydream API configuration
const DAYDREAM_API_URL = 'https://api.daydream.live/v1/streams';
const PIPELINE_ID = 'pip_qpUgXycjWF6YMeSL';
const API_TOKEN = 'sk_VhJvReuTM6R6yoK7vQVNLdXrVFLAh2A2inshX3TmbJ3qeHCU8oZnMaNghJnDvnB9';

// Function to create Daydream stream
const createDaydreamStream = async () => {
  try {
    const response = await axios.post(DAYDREAM_API_URL, {
      pipeline_id: PIPELINE_ID
    }, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error creating Daydream stream:', error.response?.data || error.message);
    throw error;
  }
};

// Function to push image to Daydream using FFmpeg
const pushImageToDaydream = (imagePath, whipUrl) => {
  return new Promise((resolve, reject) => {
    // Create a slideshow from the single image (loop it for 10 seconds)
    const ffmpegArgs = [
      '-loop', '1',
      '-i', imagePath,
      '-t', '10', // 10 seconds duration
      '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-g', '30',
      '-keyint_min', '30',
      '-f', 'mp4',
      '-movflags', '+faststart',
      whipUrl
    ];

    console.log('Starting FFmpeg with args:', ffmpegArgs);
    
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    
    let errorOutput = '';
    
    ffmpeg.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.log('FFmpeg stderr:', data.toString());
    });
    
    ffmpeg.stdout.on('data', (data) => {
      console.log('FFmpeg stdout:', data.toString());
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log('FFmpeg process completed successfully');
        resolve();
      } else {
        console.error('FFmpeg process failed with code:', code);
        console.error('Error output:', errorOutput);
        reject(new Error(`FFmpeg failed with code ${code}: ${errorOutput}`));
      }
    });
    
    ffmpeg.on('error', (error) => {
      console.error('Failed to start FFmpeg process:', error);
      reject(error);
    });
  });
};

// Upload images endpoint
app.post('/upload-images', upload.array('images'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    const results = [];

    for (const file of req.files) {
      try {
        console.log(`Processing file: ${file.filename}`);
        
        // Create Daydream stream
        const streamData = await createDaydreamStream();
        console.log('Stream created:', streamData);
        
        if (!streamData.whip_url) {
          throw new Error('No WHIP URL received from Daydream API');
        }

        // Push image to Daydream
        await pushImageToDaydream(file.path, streamData.whip_url);
        
        // Prepare result
        const result = {
          filename: file.filename,
          originalName: file.originalname,
          hls_url: `/proxy-hls?url=${encodeURIComponent(streamData.hls_url || '')}`,
          webrtc_url: streamData.webrtc_url || '',
          stream_id: streamData.id || ''
        };
        
        results.push(result);
        console.log(`Successfully processed: ${file.filename}`);
        
      } catch (error) {
        console.error(`Error processing file ${file.filename}:`, error.message);
        results.push({
          filename: file.filename,
          originalName: file.originalname,
          error: error.message
        });
      }
    }

    res.json({ success: true, results });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process images: ' + error.message 
    });
  }
});

// HLS proxy endpoint to handle CORS
app.get('/proxy-hls', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    console.log('Proxying HLS request to:', targetUrl);
    
    const response = await axios.get(targetUrl, {
      responseType: 'stream',
      timeout: 30000
    });
    
    // Set appropriate headers for HLS
    res.set({
      'Content-Type': response.headers['content-type'] || 'application/vnd.apple.mpegurl',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-cache'
    });
    
    response.data.pipe(res);
    
  } catch (error) {
    console.error('HLS proxy error:', error.message);
    res.status(500).json({ error: 'Failed to proxy HLS stream: ' + error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Upload directory:', path.resolve('uploads'));
  console.log('Output directory:', path.resolve('outputs'));
});