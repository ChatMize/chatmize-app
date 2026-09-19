import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Variable } from 'lucide-react';
import type { FlowVariable } from './VariablePickerPanel';

// Lazy: the panel only loads the first time a user opens it.
const VarPanel = lazy(() => import('./VariablePickerPanel'));

interface Props {
  variables: FlowVariable[];
  onPick: (tagText: string) => void;
  placement?: 'up' | 'down';
  title?: string;
}

export default function VariablePickerButton({
  variables,
  onPick,
  placement = 'down',
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
        title={title || 'Insert flow variable'}
        aria-label="Insert flow variable"
        className="p-1.5 rounded-lg text-slate-400 hover:text-violet-300 hover:bg-white/10 transition-colors cursor-pointer"
      >
        <Variable className="w-4 h-4" />
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
                Loading variables…
              </span>
            }
          >
            <VarPanel variables={variables} onPick={handlePick} />
          </Suspense>
        </span>
      )}
    </span>
  );
}
