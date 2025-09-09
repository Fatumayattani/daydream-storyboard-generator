export interface UploadResult {
  filename: string;
  originalName: string;
  hls_url?: string;
  webrtc_url?: string;
  stream_id?: string;
  error?: string;
}

export interface UploadResponse {
  success: boolean;
  results: UploadResult[];
  error?: string;
}

export interface VideoPlayerProps {
  src: string;
  type: 'hls' | 'webrtc';
  title: string;
}