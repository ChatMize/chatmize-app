import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Smile } from 'lucide-react';

// Lazy: the panel plus the emoji data only load the first time a user opens it.
const EmojiPanel = lazy(() => import('./EmojiPickerPanel'));

interface Props {
  onPick: (emoji: string) => void;
  /** Open upward (default) or downward */
  placement?: 'up' | 'down';
  /** Extra classes for the trigger button */
  buttonClassName?: string;
  title?: string;
}

export default function EmojiPickerButton({ onPick, placement = 'up', buttonClassName = '', title }: Props) {
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
  }, [open ]);

  const handlePick = useCallback(
    (emoji: string) => {
      onPick(emoji);
      // Keep the panel open so users can add several in a row.
    },
    [onPick]
  );

  return (
    <span ref={wrapRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={title || 'Add emoji'}
        aria-label="Add emoji"
        className={`p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-white/10 transition-colors cursor-pointer ${buttonClassName}`}
      >
        <Smile className="w-4 h-4" />
      </button>
      {open && (
        <span
          className={`absolute z-[80] ${
            placement === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
          } right-0`}
        >
          <Suspense
            fallback={
              <span className="block w-[320px] max-w-[calc(100vw-3rem)] rounded-2xl border border-white/15 bg-slate-900 p-6 text-center text-[11px] text-slate-500">
                Loading emoji…
              </span>
            }
          >
            <EmojiPanel onPick={handlePick} />
          </Suspense>
        </span>
      )}
    </span>
  );
}
