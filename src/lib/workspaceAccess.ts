import type { WorkspaceSilo } from '../types/workspace';
import type { AppUser } from './firebase';

/**
 * True when the signed-in user may manage the workspace's connections.
 * Workspaces without an ownerUid predate the team system and are treated
 * as owner-held, so the current single-user behavior is unchanged.
 */
export function isWorkspaceOwner(
  ws: WorkspaceSilo | undefined,
  user: AppUser | null,
): boolean {
  if (!ws) return true;
  if (!ws.ownerUid) return true;
  return !!user && user.uid === ws.ownerUid;
}
