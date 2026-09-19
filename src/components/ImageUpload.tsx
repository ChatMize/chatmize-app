import { useRef, useState } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Upload, X, Link2, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { storage } from '../lib/firebase';

interface ImageUploadProps {
  /** Current image URL. Empty string means no image yet. */
  value: string;
  /** Called with the new download URL after upload, a pasted URL, or '' when removed. */
  onChange: (url: string) => void;
  label?: string;
  /** Focus ring color, e.g. 'focus-within:border-emerald-500'. */
  accentClass?: string;
  /** Tighter layout for cramped editors (gallery cards). */
  compact?: boolean;
  /** Override workspace for the storage path. Defaults to the active workspace. */
  workspaceId?: string;
}

function resolveWorkspaceId(override?: string): string {
  if (override) return override;
  try {
    return localStorage.getItem('chatmize_active_workspace_id') || 'ws-chatmize-dev';
  } catch {
    return 'ws-chatmize-dev';
  }
}

function randomSuffix(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * ImageUpload replaces raw image URL text inputs. Upload is the primary path:
 * click to browse or drag and drop. Images are compressed in the browser
 * before upload (max 1600px edge, WebP at quality 0.8) and stored in Firebase
 * Storage under the workspace's own folder. Pasting a URL stays available as
 * a secondary option.
 */
export function ImageUpload({
  value,
  onChange,
  label,
  accentClass = 'focus-within:border-cyan-500',
  compact = false,
  workspaceId,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');

  const startUpload = async (file: File) => {
    setError(null);
    setProgress(0);
    // Compression lib is lazy loaded so it never lands in the initial bundle.
    const { validateImageFile, compressImage } = await import('../lib/imageCompression');
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const wsId = resolveWorkspaceId(workspaceId);
      const path = `workspaces/${wsId}/images/${randomSuffix()}.${compressed.extension}`;
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, compressed.blob, {
        contentType: compressed.extension === 'gif' ? 'image/gif' : `image/${compressed.extension}`,
      });
      await new Promise<void>((resolve, reject) => {
        task.on(
          'state_changed',
          (snap) => {
            if (snap.totalBytes > 0) {
              setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
            }
          },
          (err) => reject(err),
          () => resolve()
        );
      });
      const downloadUrl = await getDownloadURL(storageRef);
      onChange(downloadUrl);
    } catch (err: any) {
      console.error('Image upload failed:', err);
      const code = err?.code || '';
      if (code === 'storage/unauthorized') {
        setError('You do not have permission to upload images. Please sign in again.');
      } else if (code === 'storage/canceled') {
        setError('The upload was canceled. Please try again.');
      } else if (err?.message) {
        setError(err.message);
      } else {
        setError('The upload failed. Please check your connection and try again.');
      }
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) {
      startUpload(files[0]);
    }
  };

  const applyPastedUrl = () => {
    const url = urlDraft.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      setError('That does not look like a web address. Links must start with http.');
      return;
    }
    setError(null);
    onChange(url);
    setUrlDraft('');
    setShowUrlInput(false);
  };

  const zoneClasses = [
    'relative w-full rounded-xl border border-dashed transition-colors cursor-pointer',
    accentClass,
    dragging ? 'border-solid bg-white/5' : 'border-white/15 hover:border-white/30 bg-slate-950',
    compact ? 'px-2 py-2' : 'px-3 py-4',
  ].join(' ');

  return (
    <div className="w-full">
      {label && (
        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{label}</label>
      )}

      {value ? (
        <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-950 relative">
          <img
            src={value}
            alt="Uploaded preview"
            className={compact ? 'w-full h-16 object-cover' : 'w-full h-28 object-cover'}
            referrerPolicy="no-referrer"
          />
          <div className="absolute top-1.5 right-1.5 flex gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-2 py-1 rounded-lg bg-black/70 text-white text-[11px] font-medium hover:bg-black/90 backdrop-blur"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              disabled={uploading}
              aria-label="Remove image"
              className="p-1 rounded-lg bg-black/70 text-white hover:bg-black/90 backdrop-blur"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {uploading && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
              <div className="h-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      ) : (
        <div
          className={zoneClasses}
          onClick={() => !uploading && fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!uploading) handleFiles(e.dataTransfer.files);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
          }}
        >
          {uploading ? (
            <div className="flex items-center gap-2.5">
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-[11px] text-slate-300 whitespace-nowrap">
                {progress > 0 ? `Uploading ${progress}%` : 'Preparing image'}
              </span>
            </div>
          ) : (
            <div className={`flex items-center ${compact ? 'gap-2' : 'gap-2.5'}`}>
              <div className={`${compact ? 'p-1.5' : 'p-2'} rounded-lg bg-white/5 shrink-0`}>
                {dragging ? (
                  <Upload className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-cyan-300`} />
                ) : (
                  <ImageIcon className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-slate-400`} />
                )}
              </div>
              <div className="min-w-0">
                <div className={`${compact ? 'text-[11px]' : 'text-xs'} text-slate-200 font-medium`}>
                  {dragging ? 'Drop the image here' : 'Click to upload or drag an image here'}
                </div>
                {!compact && (
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    JPG, PNG, GIF or WebP up to 10 MB. Compressed automatically.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Secondary path: paste a URL, for workflows that already have one. */}
      {!showUrlInput ? (
        <button
          type="button"
          onClick={() => setShowUrlInput(true)}
          className="mt-1.5 text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
        >
          <Link2 className="w-3 h-3" />
          Or paste an image link
        </button>
      ) : (
        <div className="mt-1.5 flex gap-1.5">
          <input data-no-emoji
            type="text"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyPastedUrl();
            }}
            placeholder="https://..."
            className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white outline-none focus:border-cyan-500"
          />
          <button
            type="button"
            onClick={applyPastedUrl}
            className="px-2.5 py-1.5 rounded-lg bg-white/10 text-white text-[11px] font-medium hover:bg-white/15"
          >
            Use link
          </button>
          <button
            type="button"
            onClick={() => {
              setShowUrlInput(false);
              setUrlDraft('');
            }}
            aria-label="Close link input"
            className="px-2 py-1.5 rounded-lg text-slate-500 hover:text-slate-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-red-300">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
