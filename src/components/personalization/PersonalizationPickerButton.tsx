import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Braces } from 'lucide-react';

// Lazy: the panel plus the tag data only load the first time a user opens it.
const TagPanel = lazy(() => import('./PersonalizationPickerPanel'));

interface Props {
  onPick: (tagText: string) => void;
  /** Open upward (default) or downward */
  placement?: 'up' | 'down';
  /** Extra classes for the trigger button */
  buttonClassName?: string;
  title?: string;
}

export default function PersonalizationPickerButton({
  onPick,
  placement = 'up',
  buttonClassName = '',
  title,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handlePick = useCallback(
    (tagText: string) => {
      onPick(tagText);
      setOpen(false);
    },
    [onPick]
  );

  return (
    <span ref={wrapRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={title || 'Insert personalization'}
        aria-label="Insert personalization"
        className={`p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-white/10 transition-colors cursor-pointer ${buttonClassName}`}
      >
        <Braces className="w-4 h-4" />
      </button>
      {open && (
        <span
          className={`absolute z-[80] ${
            placement === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
          } right-0`}
        >
          <Suspense
            fallback={
              <span className="block w-[300px] max-w-[calc(100vw-3rem)] rounded-2xl border border-white/15 bg-slate-900 p-6 text-center text-[11px] text-slate-500">
                Loading tags…
              </span>
            }
          >
            <TagPanel onPick={handlePick} />
          </Suspense>
        </span>
      )}
    </span>
  );
}
