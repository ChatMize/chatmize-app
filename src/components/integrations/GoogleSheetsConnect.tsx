import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  Table2,
  Unplug,
} from 'lucide-react';
import {
  disconnectGoogleSheets,
  getGoogleSheetsStatus,
  listSheetsTabs,
  setSheetsSpreadsheet,
  startGoogleSheetsOAuth,
  type GoogleSheetsStatus,
  type SheetTabInfo,
} from '../../lib/googleSheets';

/**
 * Google Sheets connection card, rendered inside the Settings > Integrations
 * modal for the google_sheets app. Handles OAuth connect, spreadsheet pick,
 * and carries the in app introduction guide.
 */
export function GoogleSheetsConnect({ workspaceId }: { workspaceId: string }) {
  const [status, setStatus] = useState<GoogleSheetsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [sheetInput, setSheetInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [tabs, setTabs] = useState<SheetTabInfo[]>([]);
  const [tabsLoading, setTabsLoading] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await getGoogleSheetsStatus(workspaceId);
      setStatus(s);
      if (s.spreadsheetId) setSheetInput((prev) => prev || s.spreadsheetId || '');
    } catch {
      setNotice({ kind: 'err', text: 'Could not load the Sheets connection status.' });
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  // The OAuth callback lands back at app.chatmize.com/?google_sheets=...
  // with a result flag. Surface it once, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('google_sheets');
    if (result === 'success') {
      setNotice({ kind: 'ok', text: 'Google Sheets connected. Pick a spreadsheet below to finish setup.' });
    } else if (result === 'error') {
      const detail = params.get('google_sheets_error');
      setNotice({ kind: 'err', text: detail ? decodeURIComponent(detail) : 'Google did not approve the connection.' });
    }
    if (result) {
      params.delete('google_sheets');
      params.delete('google_sheets_error');
      params.delete('return_to');
      const clean = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState(null, '', clean);
    }
    refresh();
  }, [refresh]);

  const handleConnect = async () => {
    setNotice(null);
    try {
      const url = await startGoogleSheetsOAuth(workspaceId, 'app:settings_integrations');
      window.location.href = url;
    } catch {
      setNotice({ kind: 'err', text: 'Could not start the Google sign in. Please try again.' });
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Google Sheets? Flows will no longer be able to log to your sheet.')) return;
    setNotice(null);
    try {
      await disconnectGoogleSheets(workspaceId);
      setStatus({ connected: false, tokenInvalid: false, email: null, spreadsheetId: null, spreadsheetTitle: null });
      setTabs([]);
      setNotice({ kind: 'ok', text: 'Google Sheets disconnected.' });
    } catch {
      setNotice({ kind: 'err', text: 'Could not disconnect. Please try again.' });
    }
  };

  const handleSaveSheet = async () => {
    if (!sheetInput.trim()) return;
    setSaving(true);
    setNotice(null);
    try {
      const { spreadsheetId, title } = await setSheetsSpreadsheet(workspaceId, sheetInput.trim());
      setStatus((s) => (s ? { ...s, spreadsheetId, spreadsheetTitle: title } : s));
      setNotice({ kind: 'ok', text: `Using spreadsheet "${title}".` });
      loadTabs();
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Could not open that sheet.' });
    } finally {
      setSaving(false);
    }
  };

  const loadTabs = useCallback(async () => {
    setTabsLoading(true);
    try {
      setTabs(await listSheetsTabs(workspaceId));
    } catch {
      setTabs([]);
    } finally {
      setTabsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (status?.connected) loadTabs();
  }, [status?.connected, loadTabs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div
          className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
            notice.kind === 'ok'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-red-950/40 border-red-500/30 text-red-300'
          }`}
        >
          {notice.kind === 'ok' ? (
            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {!status?.connected ? (
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#0F9D58] flex items-center justify-center">
              <Table2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Log chat answers to a spreadsheet</p>
              <p className="text-xs text-slate-400">Every answer a flow captures can land in a Google Sheet row, automatically.</p>
            </div>
          </div>
          {status?.tokenInvalid && (
            <p className="text-xs text-amber-300 mb-3">
              Google revoked access for this workspace. Reconnect to continue logging rows.
            </p>
          )}
          <button
            type="button"
            onClick={handleConnect}
            className="w-full px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-900 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
            Connect with Google
          </button>
          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
            ChatMize only asks for access to your spreadsheets, so it can read and write rows. It never
            sees your Drive files, email, or anything else.
          </p>
        </div>
      ) : (
        <>
          <div className="p-3 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">Connected as {status.email}</p>
                <p className="text-[11px] text-slate-400">Token stored encrypted, never shown here.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDisconnect}
              className="px-3 py-1.5 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg border border-transparent hover:border-red-500/20 transition-all flex-shrink-0 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Unplug className="w-3.5 h-3.5" /> Disconnect
              </span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Spreadsheet
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={sheetInput}
                onChange={(e) => setSheetInput(e.target.value)}
                placeholder="Paste a Google Sheet link or id"
                className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder:text-slate-600 outline-none focus:border-emerald-500 transition-colors"
              />
              <button
                type="button"
                onClick={handleSaveSheet}
                disabled={saving || !sheetInput.trim()}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                Save
              </button>
            </div>
            {status.spreadsheetTitle && (
              <p className="text-[11px] text-slate-500 mt-1.5">
                Using: <span className="text-slate-300 font-semibold">{status.spreadsheetTitle}</span>
              </p>
            )}
            <p className="text-[11px] text-slate-500 mt-1">
              Tip: put your column names in row 1, for example Name, Email, Phone.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300">Tabs and columns</label>
              <button
                type="button"
                onClick={loadTabs}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${tabsLoading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
            {tabsLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Reading your sheet...
              </div>
            ) : tabs.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                {status.spreadsheetId ? 'No tabs found yet.' : 'Save a spreadsheet above to see its tabs.'}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {tabs.map((t) => (
                  <div key={t.title} className="p-2.5 rounded-lg bg-slate-950 border border-white/10">
                    <p className="text-xs font-bold text-white">{t.title}</p>
                    <p className="text-[11px] text-slate-500 font-mono truncate">
                      {t.headers.length > 0 ? t.headers.join(' | ') : 'No header row yet'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* In app introduction guide */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <button
          type="button"
          onClick={() => setGuideOpen((v) => !v)}
          className="w-full px-4 py-3 flex items-center justify-between gap-2 bg-white/[0.02] hover:bg-white/[0.05] transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-white">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            What the Sheets connection does
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${guideOpen ? 'rotate-180' : ''}`} />
        </button>
        {guideOpen && (
          <div className="px-4 py-3 space-y-3 text-xs text-slate-300 leading-relaxed border-t border-white/10">
            <div>
              <p className="font-bold text-white mb-1">Log answers to a sheet</p>
              <p>
                Add an action step in BotMaps, choose "Log to Google Sheet", pick the tab, then match
                each column to a captured answer (for example the Email column gets the email variable).
                Every time someone answers, a new row appears in your sheet. Great for lead lists,
                bookings, and survey results you want in one place.
              </p>
            </div>
            <div>
              <p className="font-bold text-white mb-1">Read from a sheet</p>
              <p>
                Your flows can also look up sheet rows. For example, keep a price list or an event
                schedule in a tab and have the bot pull the right row before it replies. API users get
                the same tools: sheets_append_row, sheets_read_rows, and sheets_list_tabs.
              </p>
            </div>
            <div>
              <p className="font-bold text-white mb-1">Setup in three steps</p>
              <ol className="list-decimal list-inside space-y-1 text-slate-300">
                <li>Click "Connect with Google" above and approve the spreadsheet access.</li>
                <li>Paste your Google Sheet link and press Save. Put column names in row 1 first.</li>
                <li>In BotMaps, add an action step and map your columns to the answers you capture.</li>
              </ol>
            </div>
            <p className="text-slate-500">
              Your Google token is encrypted and stored on our servers. It is never shown in the app,
              and you can disconnect any time, which deletes it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
