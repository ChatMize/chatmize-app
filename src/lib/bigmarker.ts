import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(getApp(), 'us-west2');

export interface BigmarkerConnectionStatus {
  connected: boolean;
  keyInvalid: boolean;
  baseUrl: string | null;
  connectedAtMs: number | null;
}

export interface BigmarkerWebinar {
  id: string;
  title: string;
  startTime: string | null;
  conferenceAddress: string | null;
  type: string | null;
}

export type BigmarkerRegistrantStatus =
  | 'registered'
  | 'attended_live'
  | 'attended_replay'
  | 'no_show'
  | 'not_registered';

/**
 * BigMarker actions run through the shared admin callable (metaOAuthStatus)
 * with a `bigmarker*` action name, since new Cloud Functions cannot be
 * created through the deploy proxy.
 */
async function callBigmarkerAction<T>(
  workspaceId: string,
  action: string,
  extra?: Record<string, unknown>,
): Promise<T> {
  const fn = httpsCallable<{ workspaceId: string; action: string } & Record<string, unknown>, T>(
    functions,
    'metaOAuthStatus',
  );
  const res = await fn({ workspaceId, action, ...(extra ?? {}) });
  return res.data;
}

export function getBigmarkerStatus(workspaceId: string): Promise<BigmarkerConnectionStatus> {
  return callBigmarkerAction(workspaceId, 'bigmarkerStatus');
}

export function connectBigmarker(
  workspaceId: string,
  apiKey: string,
  baseUrl?: string,
): Promise<{ ok: true }> {
  return callBigmarkerAction(workspaceId, 'bigmarkerConnect', { apiKey, baseUrl });
}

export function disconnectBigmarker(workspaceId: string): Promise<{ ok: true }> {
  return callBigmarkerAction(workspaceId, 'bigmarkerDisconnect');
}

export async function listBigmarkerWebinars(
  workspaceId: string,
  query?: string,
): Promise<BigmarkerWebinar[]> {
  const res = await callBigmarkerAction<{ webinars: BigmarkerWebinar[] }>(
    workspaceId,
    'bigmarkerListWebinars',
    { query },
  );
  return res.webinars ?? [];
}

export function registerBigmarkerContact(
  workspaceId: string,
  conferenceId: string,
  contactId: string,
  conferenceTitle?: string,
): Promise<{ ok: true; conferenceUrl: string | null }> {
  return callBigmarkerAction(workspaceId, 'bigmarkerRegister', {
    conferenceId,
    contactId,
    conferenceTitle,
  });
}

export function syncBigmarkerStatus(
  workspaceId: string,
  conferenceId: string,
  contactId: string,
  conferenceTitle?: string,
): Promise<{ ok: true; status: BigmarkerRegistrantStatus }> {
  return callBigmarkerAction(workspaceId, 'bigmarkerSyncStatus', {
    conferenceId,
    contactId,
    conferenceTitle,
  });
}

/** Plain English label for a registrant status, for the contact view and flows. */
export function bigmarkerStatusLabel(status: BigmarkerRegistrantStatus): string {
  switch (status) {
    case 'registered':
      return 'Registered';
    case 'attended_live':
      return 'Attended live';
    case 'attended_replay':
      return 'Watched the replay';
    case 'no_show':
      return 'No show';
    case 'not_registered':
      return 'Not registered';
  }
}
