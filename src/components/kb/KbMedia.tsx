import { useEffect, useState } from 'react';
import { Film, Image as ImageIcon } from 'lucide-react';
import { kbImageUrl } from '../../lib/kb';

const VIDEO_EXTENSIONS = ['mp4', 'webm'];

/** True when the storage path points at a video file. */
export function isKbVideoPath(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return VIDEO_EXTENSIONS.includes(ext);
}

/**
 * Renders KB media from its Cloud Storage path. Videos get a native player
 * with controls, images render as before. The article doc stores the path,
 * never a public URL, so media can be revoked or reprocessed later.
 */
export function KbMedia({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const isVideo = isKbVideoPath(path);

  useEffect(() => {
    let live = true;
    setUrl(null);
    setFailed(false);
    kbImageUrl(path)
      .then(u => {
        if (live) setUrl(u);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [path]);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-slate-800/60 text-slate-500 ${className || ''}`}>
        {isVideo ? <Film className="w-8 h-8" /> : <ImageIcon className="w-8 h-8" />}
      </div>
    );
  }

  if (!url) {
    return <div className={`animate-pulse bg-slate-800/60 ${className || ''}`} />;
  }

  if (isVideo) {
    return (
      <video src={url} controls preload="metadata" className={className} aria-label={alt}>
        Your browser cannot play this video.
      </video>
    );
  }

  return <img src={url} alt={alt} className={className} loading="lazy" />;
}
