import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { X } from "lucide-react";
import { prodDb, type AppUser } from "../lib/firebase";
import { getGamificationState, type BadgeDef } from "../lib/gamification";

interface ToastBadge {
  id: string;
  def: BadgeDef;
  key: number;
}

/**
 * Listens to the user's badge list and pops a toast whenever a new badge
 * is earned. Mount once at app root.
 */
export function BadgeToast({ currentUser, workspaceId }: { currentUser: AppUser | null; workspaceId?: string }) {
  const [toasts, setToasts] = useState<ToastBadge[]>([]);
  const knownRef = useRef<Set<string> | null>(null);
  const keyRef = useRef(0);

  useEffect(() => {
    if (!currentUser?.uid) {
      knownRef.current = null;
      return;
    }
    const unsub = onSnapshot(
      doc(prodDb, "users", currentUser.uid),
      async (snap) => {
        const badges = (snap.data() as { badges?: { id: string }[] } | undefined)?.badges ?? [];
        const ids = new Set(badges.map((b) => b.id));
        if (knownRef.current === null) {
          // First snapshot: baseline, no toasts for pre-existing badges.
          knownRef.current = ids;
          return;
        }
        const fresh = [...ids].filter((id) => !knownRef.current!.has(id));
        knownRef.current = ids;
        if (fresh.length === 0 || !workspaceId) return;
        try {
          const state = await getGamificationState(workspaceId);
          const defs = new Map(state.badges.map((b) => [b.id, b]));
          for (const id of fresh) {
            const def = defs.get(id);
            if (!def) continue;
            const key = ++keyRef.current;
            setToasts((t) => [...t, { id, def, key }]);
            setTimeout(() => {
              setToasts((t) => t.filter((x) => x.key !== key));
            }, 7000);
          }
        } catch {
          /* toast is best-effort */
        }
      },
      () => {},
    );
    return unsub;
  }, [currentUser?.uid, workspaceId]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map(({ def, key }) => (
        <div
          key={key}
          className="pointer-events-auto flex items-center gap-3 pl-2 pr-3 py-2 rounded-2xl bg-slate-900/95 border border-amber-500/40 shadow-2xl shadow-amber-500/10 animate-in slide-in-from-bottom-4 fade-in max-w-xs"
        >
          <img src={def.graphic} alt={def.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-300">Badge earned</div>
            <div className="text-sm font-black text-white truncate">{def.name}</div>
            <div className="text-[11px] text-slate-400">+{def.credits} AI credits</div>
          </div>
          <button
            onClick={() => setToasts((t) => t.filter((x) => x.key !== key))}
            className="p-1 text-slate-500 hover:text-white cursor-pointer shrink-0"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
