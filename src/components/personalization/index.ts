import { useCallback, useRef } from 'react';

type TextField = HTMLTextAreaElement | HTMLInputElement;

/**
 * Hook for a single textarea/input. Usage:
 *   const pz = usePersonalizationTarget<HTMLTextAreaElement>();
 *   <textarea ref={pz.ref} ... />
 *   <PersonalizationPickerButton onPick={(t) => pz.insert(t, value, setValue)} />
 */
export function usePersonalizationTarget<T extends TextField>() {
  const inner = useRef<T | null>(null);

  // Callback ref: also tags the field so the global buddy skips it
  // (this field already has its own inline picker).
  const ref = useCallback((el: T | null) => {
    inner.current = el;
    if (el) el.dataset.personalizationInline = '1';
    else if (inner.current) {
      try {
        delete inner.current.dataset.personalizationInline;
      } catch {
        /* noop */
      }
    }
  }, []);

  const insert = useCallback((tagText: string, value: string, setValue: (v: string) => void) => {
    const el = inner.current;
    const base = el ? el.value : value;
    const start = el?.selectionStart ?? base.length;
    const end = el?.selectionEnd ?? base.length;
    const next = base.slice(0, start) + tagText + base.slice(end);
    const pos = start + tagText.length;
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
 *   const pz = usePersonalizationTargetMap<HTMLTextAreaElement>();
 *   <textarea ref={pz.setRef(item.id)} ... />
 *   <PersonalizationPickerButton onPick={(t) => pz.insert(item.id, t, item.text, (v) => update(item.id, v))} />
 */
export function usePersonalizationTargetMap<T extends TextField>() {
  const map = useRef(new Map<string, T | null>());

  const setRef = useCallback(
    (id: string) => (el: T | null) => {
      if (el) {
        el.dataset.personalizationInline = '1';
        map.current.set(id, el);
      } else {
        const prev = map.current.get(id);
        if (prev) {
          try {
            delete prev.dataset.personalizationInline;
          } catch {
            /* noop */
          }
        }
        map.current.delete(id);
      }
    },
    []
  );

  const insert = useCallback(
    (id: string, tagText: string, value: string, setValue: (v: string) => void) => {
      const el = map.current.get(id) ?? null;
      const base = el ? el.value : value;
      const start = el?.selectionStart ?? base.length;
      const end = el?.selectionEnd ?? base.length;
      const next = base.slice(0, start) + tagText + base.slice(end);
      const pos = start + tagText.length;
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
    },
    []
  );

  return { setRef, insert };
}

export { default as PersonalizationPickerButton } from './PersonalizationPickerButton';
