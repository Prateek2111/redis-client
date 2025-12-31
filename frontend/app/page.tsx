'use client';

import { useEffect, useState } from 'react';

interface CloudinaryImage {
  public_id: string;
  url: string;
  original_url: string;
  title: string;
}

interface ApiResponse {
  success: boolean;
  cached: boolean;
  data: CloudinaryImage[];
}

export default function Home() {
  const [images, setImages] = useState<CloudinaryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [loadTime, setLoadTime] = useState<number>(0);

  useEffect(() => {
    const fetchImages = async () => {
      const startTime = performance.now();
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('http://localhost:5000/api/images', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        const data: ApiResponse = await response.json();

        if (data.success) {
          setImages(data.data);
          setCached(data.cached);
          const endTime = performance.now();
          setLoadTime(Math.round(endTime - startTime));
        } else {
          throw new Error(data.error || 'Failed to fetch images');
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'An error occurred';
        setError(errorMsg);
        console.error('Error fetching images:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-white border-t-blue-500"></div>
          <p className="text-xl text-white">Loading images...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 px-4">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-white mb-4">
            Cloudinary Gallery
          </h1>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <span className="text-lg text-slate-300">
              Total Images: <span className="font-semibold text-blue-400">{images.length}</span>
            </span>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${
              cached
                ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50'
            }`}>
              {cached ? '✓ Cached from Redis' : '↓ Fresh from Cloudinary'}
            </span>
            <span className="text-lg text-slate-300">
              Load Time: <span className="font-semibold text-purple-400">{loadTime}ms</span>
            </span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 rounded-lg bg-red-500/10 border border-red-500/50 p-4 text-red-300">
            <p className="font-semibold">Error loading images:</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Image Grid - 20 Images in 5x4 Grid */}
        {images.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {images.map((image, index) => (
              <div
                key={image.public_id}
                className="group relative overflow-hidden rounded-lg shadow-lg transition-transform duration-300 hover:scale-105 bg-slate-700"
              >
                {/* Image Container */}
                <div className="relative aspect-square w-full overflow-hidden bg-slate-600">
                  <img
                    src={image.url}
                    alt={image.title}
                    loading={index < 5 ? 'eager' : 'lazy'}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                </div>

                {/* Overlay with Title */}
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="w-full p-4">
                    <p className="text-sm font-semibold text-white truncate">
                      {image.title}
                    </p>
                    <p className="text-xs text-slate-300 mt-1">
                      Image {index + 1} of {images.length}
                    </p>
                  </div>
                </div>

                {/* Loading Skeleton */}
                <div className="absolute inset-0 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 animate-pulse opacity-0 group-hover:hidden"></div>
              </div>
            ))}
          </div>
        ) : (
          !error && (
            <div className="text-center py-12">
              <p className="text-xl text-slate-400">No images found</p>
            </div>
          )
        )}

        {/* Stats Footer */}
        {images.length > 0 && (
          <div className="mt-12 rounded-lg bg-slate-700/50 border border-slate-600 p-6 text-center">
            <p className="text-slate-300">
              Displaying <span className="font-semibold text-blue-400">{images.length}</span> images
              {cached && (
                <>
                  {' '}from <span className="font-semibold text-green-400">Redis Cache</span>
                  {' '}in <span className="font-semibold text-purple-400">{loadTime}ms</span></>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
