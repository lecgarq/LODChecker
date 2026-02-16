import { useState } from 'react';

interface DetailImageProps {
  src: string;
  alt?: string;
}

/** Image component with loading spinner and error fallback. */
export default function DetailImage({ src, alt = '' }: DetailImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {!loaded && !error && (
        <div className="w-4 h-4 border-2 border-secondary border-t-primary rounded-full animate-spin" />
      )}
      <img
        src={src}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        alt={alt}
      />
      {error && (
        <div className="text-xs text-text/60">Image not found</div>
      )}
    </div>
  );
}
