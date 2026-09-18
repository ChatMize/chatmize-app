import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Smile } from 'lucide-react';

// Lazy: the panel plus the emoji data only load the first time a user opens it.
const EmojiPanel = lazy(() => import('./EmojiPickerPanel'));

type Field = HTMLTextAreaElement | HTMLInputElement | HTMLElement;

const TEXT_INPUT_TYPES = new Set(['text', 'search', '']);

// URL, email, and phone fields never get emoji: inserting emoji there is
// always a user error, and Karl explicitly excluded them.
const NO_EMOJI_HINTS = [
  'url',
  'link',
  'href',
  'website',
  'domain',
  'email',
  'e-mail',
  'phone',
  'tel',
  'telephone',
  'mobile',
  'fax',
];
const NO_EMOJI_RE = new RegExp(`\\b(${NO_EMOJI_HINTS.join('|')})\\b`, 'i');

// Collect the name, id, placeholder, aria label, and visible label text for a
// field so we can spot URL / email / phone fields by their wording.
function fieldHintText(el: HTMLElement): string {
  const parts: string[] = [];
  for (const attr of ['name', 'id', 'placeholder', 'aria-label', 'data-testid']) {
    const v = el.getAttribute(attr);
    if (v) parts.push(v);
  }
  if (el.id) {
    try {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label && label.textContent) parts.push(label.textContent);
    } catch {
      /* invalid selector, skip */
    }
  }
  const wrappingLabel = el.closest('label');
  if (wrappingLabel && wrappingLabel.textContent) parts.push(wrappingLabel.textContent);
  return parts.join(' ');
}

function looksLikeUrlEmailPhoneField(el: HTMLElement): boolean {
  return NO_EMOJI_RE.test(fieldHintText(el));
}

function isEmojiTextField(el: EventTarget | null): el is Field {
  if (!(el instanceof HTMLElement)) return false;
  // Skip fields that already have their own inline picker, and the picker's own search box.
  if (el.closest('[data-emoji-panel]')) return false;
  const tagged = el as HTMLElement;
  if (tagged.dataset && tagged.dataset.emojiInline) return false;
  // Explicit opt-out: data-no-emoji on the field or any ancestor (plumbing fields:
  // prompts, configs, keywords, topics, ids, admin internals).
  if (tagged.dataset && 'noEmoji' in tagged.dataset) return false;
  if (typeof tagged.closest === 'function' && tagged.closest('[data-no-emoji]')) return false;
  if (tagged.isContentEditable) return !looksLikeUrlEmailPhoneField(tagged);
  if (el instanceof HTMLTextAreaElement) {
    if (el.readOnly || el.disabled) return false;
    return !looksLikeUrlEmailPhoneField(el);
  }
  if (el instanceof HTMLInputElement) {
    if (el.readOnly || el.disabled) return false;
    if (!TEXT_INPUT_TYPES.has((el.type || '').toLowerCase())) return false;
    return !looksLikeUrlEmailPhoneField(el);
  }
  return false;
}

// True only when the field is attached to the document, has real size, and is
// at least partly inside the viewport. A detached, display:none, or scrolled
// away field must never anchor the buddy.
function isVisible(el: HTMLElement): boolean {
  if (!document.contains(el)) return false;
  const r = el.getBoundingClientRect();
  return (
    r.width > 2 &&
    r.height > 2 &&
    r.bottom > 0 &&
    r.right > 0 &&
    r.top < window.innerHeight &&
    r.left < window.innerWidth
  );
}

// Insert at the cursor in a way React controlled components pick up:
// use the native value setter, then dispatch a bubbling input event.
function insertAtCursor(el: Field, emoji: string) {
  if (el.isContentEditable && !(el instanceof HTMLTextAreaElement) && !(el instanceof HTMLInputElement)) {
    el.focus();
    if (document.queryCommandSupported?.('insertText')) {
      document.execCommand('insertText', false, emoji);
    } else {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(emoji));
        range.collapse(false);
      }
    }
    return;
  }
  const input = el as HTMLTextAreaElement | HTMLInputElement;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const next = input.value.slice(0, start) + emoji + input.value.slice(end);
  const pos = start + emoji.length;
  const proto = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
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
 * GlobalEmojiBuddy: a floating emoji button that appears next to ANY focused
 * text field in the app that does not already have an inline emoji picker.
 * This makes emoji available on every typing surface, including ones added
 * later, with zero per-field wiring. Mount once near the app root.
 *
 * Visibility rules (the buddy must never float over tab bars, headers, or
 * other chrome): it shows only while a genuinely typable, visible field has
 * focus. It hides the moment focus leaves the field/picker, when the field
 * scrolls out of view or unmounts, and on Escape.
 */
export default function GlobalEmojiBuddy() {
  const [target, setTarget] = useState<Field | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const targetRef = useRef<Field | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const hide = useCallback(() => {
    targetRef.current = null;
    setTarget(null);
    setPanelOpen(false);
  }, []);

  const place = useCallback((el: Field) => {
    // Never anchor to a detached, hidden, or scrolled-away field: hide instead
    // of clamping a stale rectangle over unrelated UI.
    if (!isVisible(el)) {
      targetRef.current = null;
      setTarget(null);
      setPanelOpen(false);
      return;
    }
    const r = el.getBoundingClientRect();
    // Bottom-right corner of the field, clamped into the viewport.
    const x = Math.max(8, Math.min(window.innerWidth - 44, r.right - 36));
    const y = Math.max(8, Math.min(window.innerHeight - 44, r.bottom - 36));
    setPos({ x, y });
  }, []);

  const insidePickerUi = useCallback((node: EventTarget | null) => {
    if (!(node instanceof HTMLElement)) return false;
    return !!node.closest('[data-emoji-panel]') || !!btnRef.current?.contains(node);
  }, []);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as EventTarget | null;
      // Focus moved inside the picker UI itself: keep the current state.
      if (insidePickerUi(t)) return;
      if (isEmojiTextField(t)) {
        const el = t as Field;
        // A focused field that is not actually visible must not show the buddy.
        if (!isVisible(el)) {
          hide();
          return;
        }
        targetRef.current = el;
        setTarget(el);
        place(el);
        // keep panel state; it re-anchors to the new field
      } else {
        // Focus moved to anything that is not a typable field (tabs, buttons,
        // nav, body): the buddy must not linger over it.
        hide();
      }
    };
    const onFocusOut = () => {
      // Backstop for clicks on non-focusable areas where focusin may not fire.
      // Check after the browser settles focus.
      requestAnimationFrame(() => {
        const a = document.activeElement;
        const stillInside =
          a === targetRef.current || insidePickerUi(a);
        if (!stillInside) hide();
      });
    };
    const onScroll = () => {
      if (targetRef.current) place(targetRef.current);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('keydown', onKey);
    };
  }, [place, hide, insidePickerUi]);

  const handlePick = useCallback((emoji: string) => {
    const el = targetRef.current;
    if (el && document.contains(el)) insertAtCursor(el, emoji);
    // Keep the panel open for multiple picks; re-anchor in case layout shifted.
    if (el && document.contains(el)) place(el);
  }, [place]);

  if (!target) return null;

  return createPortal(
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 200 }}>
      <button
        ref={btnRef}
        type="button"
        aria-label="Add emoji"
        title="Add emoji"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => setPanelOpen((o) => !o)}
        className="pointer-events-auto absolute p-1.5 rounded-full bg-slate-800/90 border border-white/20 text-slate-300 hover:text-amber-300 hover:border-amber-300/50 shadow-lg shadow-black/40 backdrop-blur transition-colors cursor-pointer"
        style={{ left: pos.x, top: pos.y }}
      >
        <Smile className="w-4 h-4" />
      </button>
      {panelOpen && (
        <div
          data-emoji-panel
          className="pointer-events-auto absolute"
          style={{
            left: Math.max(8, Math.min(window.innerWidth - 336, pos.x - 284)),
            top: Math.max(8, pos.y - 320),
          }}
        >
          <Suspense
            fallback={
              <div className="w-[320px] rounded-2xl border border-white/15 bg-slate-900 p-6 text-center text-[11px] text-slate-500">
                Loading emoji…
              </div>
            }
          >
            <EmojiPanel onPick={handlePick} />
          </Suspense>
        </div>
      )}
    </div>,
    document.body
  );
}
