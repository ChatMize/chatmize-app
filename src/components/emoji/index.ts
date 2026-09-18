import { useCallback, useRef } from 'react';

type TextField = HTMLTextAreaElement | HTMLInputElement;

/**
 * Hook for a single textarea/input. Usage:
 *   const emoji = useEmojiTarget<HTMLTextAreaElement>();
 *   <textarea ref={emoji.ref} ... />
 *   <EmojiPickerButton onPick={(e) => emoji.insert(e, value, setValue)} />
 */
export function useEmojiTarget<T extends TextField>() {
  const inner = useRef<T | null>(null);

  // Callback ref: also tags the field so the global emoji buddy skips it
  // (this field already has its own inline picker).
  const ref = useCallback((el: T | null) => {
    inner.current = el;
    if (el) el.dataset.emojiInline = '1';
    else if (inner.current) {
      try { delete inner.current.dataset.emojiInline; } catch { /* noop */ }
    }
  }, []);

  const insert = useCallback((emoji: string, value: string, setValue: (v: string) => void) => {
    const el = inner.current;
    const base = el ? el.value : value;
    const start = el?.selectionStart ?? base.length;
    const end = el?.selectionEnd ?? base.length;
    const next = base.slice(0, start) + emoji + base.slice(end);
    const pos = start + emoji.length;
    setValue(next);
    requestAnimationFrame(() => {
      const node = inner.current;
      if (node) {
        node.focus();
        try {
          node.setSelectionRange(pos, pos);
        } catch {
          /* selection unsupported, focus is enough */
        }
      }
    });
  }, []);

  return { ref, insert };
}

/**
 * Hook for repeated fields in a list (flow builder components, drip steps).
 * Usage:
 *   const emoji = useEmojiTargetMap<HTMLTextAreaElement>();
 *   <textarea ref={emoji.setRef(item.id)} ... />
 *   <EmojiPickerButton onPick={(e) => emoji.insert(item.id, e, item.text, (v) => update(item.id, v))} />
 */
export function useEmojiTargetMap<T extends TextField>() {
  const map = useRef(new Map<string, T | null>());

  const setRef = useCallback(
    (id: string) =>
      (el: T | null) => {
        if (el) {
          el.dataset.emojiInline = '1';
          map.current.set(id, el);
        } else {
          const prev = map.current.get(id);
          if (prev) {
            try { delete prev.dataset.emojiInline; } catch { /* noop */ }
          }
          map.current.delete(id);
        }
      },
    []
  );

  const insert = useCallback((id: string, emoji: string, value: string, setValue: (v: string) => void) => {
    const el = map.current.get(id) ?? null;
    const base = el ? el.value : value;
    const start = el?.selectionStart ?? base.length;
    const end = el?.selectionEnd ?? base.length;
    const next = base.slice(0, start) + emoji + base.slice(end);
    const pos = start + emoji.length;
    setValue(next);
    requestAnimationFrame(() => {
      const node = map.current.get(id);
      if (node) {
        node.focus();
        try {
          node.setSelectionRange(pos, pos);
        } catch {
          /* selection unsupported, focus is enough */
        }
      }
    });
  }, []);

  return { setRef, insert };
}

export { default as EmojiPickerButton } from './EmojiPickerButton';
