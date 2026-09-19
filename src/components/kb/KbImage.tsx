import { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { kbImageUrl } from '../../lib/kb';

/**
 * Renders a KB media image from its Cloud Storage path. The article doc
 * stores the path, never a public URL, so media can be revoked or
 * reprocessed later.
 */
export function KbImage({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

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
        <ImageIcon className="w-8 h-8" />
      </div>
    );
  }

  if (!url) {
    return <div className={`animate-pulse bg-slate-800/60 ${className || ''}`} />;
  }

  return <img src={url} alt={alt} className={className} loading="lazy" />;
}
