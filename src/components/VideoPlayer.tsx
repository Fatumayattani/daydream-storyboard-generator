import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { VideoPlayerProps } from '../types';

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, type, title }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!src || !videoRef.current) return;

    const video = videoRef.current;
    setError('');
    setLoading(true);

    if (type === 'hls') {
      if (Hls.isSupported()) {
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }

        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90
        });

        hlsRef.current = hls;

        hls.loadSource(src);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('HLS manifest parsed');
          setLoading(false);
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          console.error('HLS error:', data);
          setError(`HLS Error: ${data.details}`);
          setLoading(false);
        });

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = src;
        setLoading(false);
      } else {
        setError('HLS is not supported in this browser');
        setLoading(false);
      }
    } else if (type === 'webrtc') {
      video.src = src;
      setLoading(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, type]);

  const handleLoadStart = () => setLoading(true);
  const handleCanPlay = () => setLoading(false);
  const handleError = () => {
    setError(`Failed to load ${type.toUpperCase()} stream`);
    setLoading(false);
  };

  if (error) {
    return (
      <div className="relative w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center p-4">
          <div className="text-red-500 font-medium mb-2">Error</div>
          <div className="text-gray-600 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-600">Loading {type.toUpperCase()}...</span>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        controls
        autoPlay={type === 'webrtc'}
        playsInline
        muted
        onLoadStart={handleLoadStart}
        onCanPlay={handleCanPlay}
        onError={handleError}
      />

      <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
        {type.toUpperCase()} - {title}
      </div>
    </div>
  );
};

export default VideoPlayer;
