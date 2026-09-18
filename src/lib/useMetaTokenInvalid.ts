import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { prodDb } from './firebase';

/**
 * Realtime token-invalid flag for the Meta reconnect prompts.
 *
 * The backend flips workspaces/{workspaceId}/integrations/meta.status to
 * "token_invalid" the instant a Meta page token dies (sendChannelMessage
 * error 190, OAuth health checks). Listening to that doc directly means the
 * banner appears the moment the token dies instead of waiting for a poll
 * or refresh cycle. Members can read the doc under firestore.rules, so no
 * callable round-trip is needed.
 */
export function useMetaTokenInvalid(workspaceId: string | undefined): boolean {
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!workspaceId) {
      setInvalid(false);
      return;
    }
    setInvalid(false);
    const ref = doc(prodDb, 'workspaces', workspaceId, 'integrations', 'meta');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        setInvalid(snap.data()?.status === 'token_invalid');
      },
      () => {
        // Read blocked or offline: stay silent rather than flashing a
        // false alarm. A later successful read corrects the flag.
      },
    );
    return () => unsub();
  }, [workspaceId]);

  return invalid;
}
