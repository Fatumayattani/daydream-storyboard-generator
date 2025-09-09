# Daydream Storyboard Generator

A full-stack React + Node.js application that converts images into live video streams using the Daydream API.

## Features

- **Multiple Image Upload**: Drag-and-drop interface with file picker support
- **Daydream Integration**: Automatic stream creation via Daydream API
- **Live Video Generation**: FFmpeg-based image-to-video conversion
- **Inline Video Players**: HLS and WebRTC stream playback directly in the browser
- **CORS Proxy**: Built-in HLS proxy to handle cross-origin requests
- **Real-time Progress**: Upload progress and processing status indicators

## Prerequisites

- Node.js 16+ 
- FFmpeg installed and available in PATH
- Daydream API access (API key configured in server)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

### Development Mode (Both Frontend and Backend)
```bash
server - node server/index.js
frontend - npm run dev
(run in separate terminal)
```

This will start:
- Backend server on `http://localhost:3001`
- Frontend development server on `http://localhost:5173`

## Project Structure

```
├── server/
│   └── index.js          # Express server with Daydream API integration
├── src/
│   ├── components/
│   │   ├── BatchImageUploader.tsx  # Main upload component
│   │   └── VideoPlayer.tsx         # HLS/WebRTC video player
│   ├── types/
│   │   └── index.ts               # TypeScript interfaces
│   └── App.tsx                    # Main React component
├── uploads/                       # Image upload directory (auto-created)
└── outputs/                       # Video output directory (auto-created)
```

## API Endpoints

- `POST /upload-images` - Upload multiple images for processing
- `GET /proxy-hls` - Proxy HLS streams to handle CORS
- `GET /health` - Health check endpoint

## Configuration

The Daydream API configuration is in `server/index.js`:
- `PIPELINE_ID`: Daydream pipeline identifier
- `API_TOKEN`: Daydream API authentication token
