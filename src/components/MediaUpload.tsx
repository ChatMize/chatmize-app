import { useRef, useState } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Upload, X, Link2, Video as VideoIcon, Mic, AlertCircle } from 'lucide-react';
import { getStorageInstance } from '../lib/firebase';

export type BotMediaKind = 'video' | 'audio';

interface MediaUploadProps {
  /** Current media download URL. Empty string means none yet. */
  value: string;
  /** Called with the new download URL after upload, a pasted URL, or '' when removed. */
  onChange: (url: string) => void;
  kind: BotMediaKind;
  label?: string;
  /** Focus ring color, e.g. 'focus-within:border-rose-500'. */
  accentClass?: string;
  /** Override workspace for the storage path. Defaults to the active workspace. */
  workspaceId?: string;
}

const MAX_BYTES = 25 * 1024 * 1024; // 25MB — Meta attachment limit for video and audio

const VIDEO_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/ogg': 'ogv',
};

const AUDIO_TYPES: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/vnd.wave': 'wav',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
};

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
 * MediaUpload handles video and audio uploads for bot builder message
 * components. Files go to Firebase Storage under the workspace's bot_media
 * folder and the component stores the download URL, which is what Meta's
 * attachment APIs fetch when the message sends. No compression is applied
 * to video or audio. 25MB cap matches Meta's attachment limit.
 */
export function MediaUpload({
  value,
  onChange,
  kind,
  label,
  accentClass = 'focus-within:border-cyan-500',
  workspaceId,
}: MediaUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');

  const allowed = kind === 'video' ? VIDEO_TYPES : AUDIO_TYPES;
  const acceptAttr = kind === 'video' ? 'video/mp4,video/webm,video/quicktime,video/ogg' : 'audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/aac';
  const KindIcon = kind === 'video' ? VideoIcon : Mic;
  const noun = kind === 'video' ? 'video' : 'audio clip';

  const validate = (file: File): string | null => {
    const ext = allowed[file.type];
    if (!ext) {
      const list = kind === 'video' ? 'MP4, WebM, MOV, or OGV' : 'MP3, WAV, M4A, or AAC';
      return `That file type is not supported. Use ${list}.`;
    }
    if (file.size > MAX_BYTES) {
      return 'That file is over the 25MB limit. Trim it down and try again.';
    }
    return null;
  };

  const startUpload = async (file: File) => {
    setError(null);
    setProgress(0);
    const validationError = validate(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setUploading(true);
    try {
      const wsId = resolveWorkspaceId(workspaceId);
      const ext = allowed[file.type];
      const path = `workspaces/${wsId}/bot_media/${randomSuffix()}.${ext}`;
      const storageRef = ref(await getStorageInstance(), path);
      const task = uploadBytesResumable(storageRef, file, { contentType: file.type });
      const url = await new Promise<string>((resolve, reject) => {
        task.on(
          'state_changed',
          (snap) => {
            if (snap.totalBytes > 0) {
              setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
            }
          },
          (err) => reject(err),
          () => {
            getDownloadURL(task.snapshot.ref).then(resolve, reject);
          },
        );
      });
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Try again.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) void startUpload(files[0]);
  };

  const handleUrlSave = () => {
    const url = urlDraft.trim();
    if (!url) {
      setError('Paste a link first.');
      return;
    }
    if (!/^https:\/\//i.test(url)) {
      setError('The link must start with https:// so Meta can fetch the file.');
      return;
    }
    setError(null);
    onChange(url);
    setShowUrlInput(false);
    setUrlDraft('');
  };

  return (
    <div>
      {label && (
        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">{label}</label>
      )}
      {value ? (
        <div className={`relative rounded-xl overflow-hidden border border-white/10 bg-slate-950 ${accentClass}`}>
          {kind === 'video' ? (
            <video src={value} controls preload="metadata" className="w-full max-h-40 bg-black" />
          ) : (
            <div className="p-3">
              <audio src={value} controls preload="metadata" className="w-full" />
            </div>
          )}
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-950/80 text-slate-300 hover:text-white border border-white/10"
            title={`Remove ${noun}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          className={`rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-colors focus-within:outline-none ${accentClass} ${
            dragging ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/10 bg-slate-950 hover:border-white/25'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptAttr}
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
          />
          {uploading ? (
            <div className="py-1">
              <div className="text-xs text-slate-300 mb-2">Uploading {noun}... {progress}%</div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <>
              <KindIcon className="w-6 h-6 mx-auto text-slate-500 mb-1.5" />
              <div className="text-xs text-slate-300">
                Click to browse or drop a {noun} here
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {kind === 'video' ? 'MP4, WebM, MOV, OGV' : 'MP3, WAV, M4A, AAC'} up to 25MB
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowUrlInput((s) => !s); }}
                className="mt-2 inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300"
              >
                <Link2 className="w-3 h-3" /> Or paste a link
              </button>
            </>
          )}
        </div>
      )}
      {showUrlInput && !value && (
        <div className="mt-2 flex gap-1.5">
          <input
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="https://..."
            className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
          />
          <button
            type="button"
            onClick={handleUrlSave}
            className="px-3 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-bold hover:bg-cyan-500/30"
          >
            Use link
          </button>
        </div>
      )}
      {error && (
        <div className="mt-2 flex items-start gap-1.5 text-[11px] text-rose-300">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {!value && !error && (
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-500">
          <Upload className="w-3 h-3" />
          <span>Sends as a {noun} attachment on Messenger and Instagram</span>
        </div>
      )}
    </div>
  );
}
