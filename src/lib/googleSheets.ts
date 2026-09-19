import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(getApp(), 'us-west2');

export interface GoogleSheetsStatus {
  connected: boolean;
  tokenInvalid: boolean;
  email: string | null;
  spreadsheetId: string | null;
  spreadsheetTitle: string | null;
}

export interface SheetTabInfo {
  title: string;
  headers: string[];
}

async function callSheets<T>(workspaceId: string, action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const fn = httpsCallable<Record<string, unknown>, T>(functions, 'googleSheets');
  const res = await fn({ workspaceId, action, ...extra });
  return res.data;
}

/** Step 1: get the Google consent URL and send the browser there. */
export async function startGoogleSheetsOAuth(workspaceId: string, returnTo?: string): Promise<string> {
  const { url } = await callSheets<{ url: string }>(workspaceId, 'start', { returnTo });
  return url;
}

export function getGoogleSheetsStatus(workspaceId: string): Promise<GoogleSheetsStatus> {
  return callSheets<GoogleSheetsStatus>(workspaceId, 'status');
}

export function disconnectGoogleSheets(workspaceId: string): Promise<{ ok: true }> {
  return callSheets<{ ok: true }>(workspaceId, 'disconnect');
}

export function setSheetsSpreadsheet(
  workspaceId: string,
  spreadsheet: string,
): Promise<{ spreadsheetId: string; title: string }> {
  return callSheets(workspaceId, 'setSpreadsheet', { spreadsheet });
}

export async function listSheetsTabs(
  workspaceId: string,
  spreadsheetId?: string,
): Promise<SheetTabInfo[]> {
  const { tabs } = await callSheets<{ tabs: SheetTabInfo[] }>(workspaceId, 'listTabs', { spreadsheetId });
  return tabs;
}

export function sheetsAppendRow(
  workspaceId: string,
  tab: string,
  values: Record<string, string>,
  spreadsheetId?: string,
): Promise<{ updatedRange: string | null }> {
  return callSheets(workspaceId, 'appendRow', { tab, values, spreadsheetId });
}

export function sheetsReadRows(
  workspaceId: string,
  tab: string,
  opts: { matchHeader?: string; matchValue?: string; limit?: number; spreadsheetId?: string } = {},
): Promise<{ headers: string[]; rows: Array<Record<string, string>> }> {
  return callSheets(workspaceId, 'readRows', { tab, ...opts });
}
