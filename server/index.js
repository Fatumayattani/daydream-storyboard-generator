import express from 'express';
import multer from 'multer';
import cors from 'cors';
import axios from 'axios';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;


const allowedOrigins = [
  'http://localhost:5173',             
  'https://daydream-storyboard.netlify.app/'  
];

app.use(cors({
  origin: function(origin, callback){
    
    if(!origin) return callback(null, true);
    if(allowedOrigins.indexOf(origin) === -1){
      const msg = `The CORS policy for this site does not allow access from the specified Origin.`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json());
app.use('/outputs', express.static(path.join(__dirname, '../outputs')));


const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};
ensureDir('uploads');
ensureDir('outputs');


const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed!'), false);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Daydream API configuration
const DAYDREAM_API_URL = 'https://api.daydream.live/v1/streams';
const PIPELINE_ID = 'pip_qpUgXycjWF6YMeSL';
const API_TOKEN = process.env.DAYDREAM_API_KEY;

const createDaydreamStream = async () => {
  try {
    const response = await axios.post(
      DAYDREAM_API_URL,
      { pipeline_id: PIPELINE_ID },
      { headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' } }
    );
    return response.data;
  } catch (error) {
    console.error('Error creating Daydream stream:', error.response?.data || error.message);
    throw error;
  }
};

const pushImageToDaydream = (imagePath, outputHlsPath) =>
  new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-loop', '1',
      '-i', imagePath,
      '-t', '10',
      '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-g', '30',
      '-keyint_min', '30',
      '-f', 'hls',
      '-hls_time', '2',
      '-hls_list_size', '0',
      '-hls_flags', 'delete_segments+append_list',
      outputHlsPath,
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => (errorOutput += data.toString()));
    ffmpeg.stdout.on('data', (data) => console.log(data.toString()));

    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg failed with code ${code}: ${errorOutput}`));
    });

    ffmpeg.on('error', (error) => reject(error));
  });

// Upload endpoint
app.post('/upload-images', upload.array('images'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: 'No images uploaded' });

    const results = [];

    for (const file of req.files) {
      try {
        const streamData = await createDaydreamStream();

        const outputFileName = `${path.parse(file.filename).name}.m3u8`;
        const outputHlsPath = path.join('outputs', outputFileName);

        await pushImageToDaydream(file.path, outputHlsPath);

        results.push({
          filename: file.filename,
          originalName: file.originalname,
          hls_url: `/outputs/${outputFileName}`,
          webrtc_url: streamData.webrtc_url || '',
          stream_id: streamData.id || '',
        });
      } catch (error) {
        results.push({
          filename: file.filename,
          originalName: file.originalname,
          error: error.message,
        });
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: 'Failed to process images: ' + error.message });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Upload directory:', path.resolve('uploads'));
  console.log('Output directory:', path.resolve('outputs'));
});
