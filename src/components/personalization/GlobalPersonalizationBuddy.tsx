import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Braces } from 'lucide-react';

// Lazy: the panel plus the tag data only load the first time a user opens it.
const TagPanel = lazy(() => import('./PersonalizationPickerPanel'));

type Field = HTMLTextAreaElement | HTMLInputElement | HTMLElement;

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'email', 'tel', '']);

function isPersonalizationTextField(el: EventTarget | null): el is Field {
  if (!(el instanceof HTMLElement)) return false;
  // Skip fields that already have their own inline picker, and the picker's own search box.
  if (el.closest('[data-personalization-panel]')) return false;
  const tagged = el as HTMLElement;
  if (tagged.dataset && tagged.dataset.personalizationInline) return false;
  if (tagged.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement) {
    return !el.readOnly && !el.disabled;
  }
  if (el instanceof HTMLInputElement) {
    if (el.readOnly || el.disabled) return false;
    return TEXT_INPUT_TYPES.has((el.type || '').toLowerCase());
  }
  return false;
}

// Insert at the cursor in a way React controlled components pick up:
// use the native value setter, then dispatch a bubbling input event.
function insertAtCursor(el: Field, tagText: string) {
  if (el.isContentEditable && !(el instanceof HTMLTextAreaElement) && !(el instanceof HTMLInputElement)) {
    el.focus();
    if (document.queryCommandSupported?.('insertText')) {
      document.execCommand('insertText', false, tagText);
    } else {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(tagText));
        range.collapse(false);
      }
    }
    return;
  }
  const input = el as HTMLTextAreaElement | HTMLInputElement;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const next = input.value.slice(0, start) + tagText + input.value.slice(end);
  const pos = start + tagText.length;
  const proto =
    input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(input, next);
  else input.value = next;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
  try {
    input.setSelectionRange(pos, pos);
  } catch {
    /* selection unsupported */
  }
}

/**
 * GlobalPersonalizationBuddy: a floating tag button that appears next to ANY
 * focused text field in the app that does not already have an inline
 * personalization picker. This makes merge tags available on every typing
 * surface, including ones added later, with zero per-field wiring.
 * Mount once near the app root. It sits left of the emoji buddy button.
 */
export default function GlobalPersonalizationBuddy() {
  const [target, setTarget] = useState<Field | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const targetRef = useRef<Field | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const place = useCallback((el: Field) => {
    const r = el.getBoundingClientRect();
    // Bottom-right corner of the field, offset left so it sits beside the emoji buddy.
    const x = Math.max(8, Math.min(window.innerWidth - 80, r.right - 72));
    const y = Math.max(8, Math.min(window.innerHeight - 44, r.bottom - 36));
    setPos({ x, y });
  }, []);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as EventTarget | null;
      if (isPersonalizationTextField(el)) {
        targetRef.current = el as Field;
        setTarget(el as Field);
        place(el as Field);
      } else if (
        panelOpen &&
        !(e.target instanceof HTMLElement && e.target.closest('[data-personalization-panel]')) &&
        e.target !== btnRef.current &&
        !(e.target instanceof HTMLElement && btnRef.current?.contains(e.target))
      ) {
        targetRef.current = null;
        setTarget(null);
        setPanelOpen(false);
      }
    };
    const onScroll = () => {
      if (targetRef.current) place(targetRef.current);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPanelOpen(false);
        setTarget(null);
        targetRef.current = null;
      }
    };
    document.addEventListener('focusin', onFocusIn);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('resize', onScroll);
      document.removeEventListener('keydown', onKey);
    };
  }, [place, panelOpen]);

  const handlePick = useCallback(
    (tagText: string) => {
      const el = targetRef.current;
      if (el && document.contains(el)) insertAtCursor(el, tagText);
      setPanelOpen(false);
      if (el && document.contains(el)) place(el);
    },
    [place]
  );

  if (!target) return null;

  return createPortal(
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 200 }}>
      <button
        ref={btnRef}
        type="button"
        aria-label="Insert personalization"
        title="Insert personalization"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => setPanelOpen((o) => !o)}
        className="pointer-events-auto absolute p-1.5 rounded-full bg-slate-800/90 border border-white/20 text-slate-300 hover:text-cyan-300 hover:border-cyan-300/50 shadow-lg shadow-black/40 backdrop-blur transition-colors cursor-pointer"
        style={{ left: pos.x, top: pos.y }}
      >
        <Braces className="w-4 h-4" />
      </button>
      {panelOpen && (
        <div
          data-personalization-panel
          className="pointer-events-auto absolute"
          style={{
            left: Math.max(8, Math.min(window.innerWidth - 316, pos.x - 248)),
            top: Math.max(8, pos.y - 340),
          }}
        >
          <Suspense
            fallback={
              <div className="w-[300px] rounded-2xl border border-white/15 bg-slate-900 p-6 text-center text-[11px] text-slate-500">
                Loading tags…
              </div>
            }
          >
            <TagPanel onPick={handlePick} />
          </Suspense>
        </div>
      )}
    </div>,
    document.body
  );
}
