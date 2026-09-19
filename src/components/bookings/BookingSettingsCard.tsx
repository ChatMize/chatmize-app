import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CalendarCheck,
  Check,
  Clock,
  Copy,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import {
  BookingReminderRule,
  BookingRow,
  BookingSettings,
  BookingStatus,
  ReminderChannel,
  adminCancelBooking,
  adminCreateBooking,
  adminSetBookingStatus,
  bookingEmbedSnippet,
  bookingPageUrl,
  getBookingSettings,
  listBookings,
  saveBookingSettings,
} from '../../lib/bookings';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIMEZONES = ['America/Phoenix', 'America/Denver', 'America/Chicago', 'America/New_York', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu', 'UTC'];

function emptySettings(): BookingSettings {
  return {
    enabled: true,
    eventName: 'Intro Call',
    eventDescription: '',
    location: '',
    timeZone: 'America/Phoenix',
    workingHours: DAY_NAMES.map((_, day) => ({
      day,
      start: '09:00',
      end: '17:00',
      enabled: day >= 1 && day <= 5,
    })),
    slotMinutes: 30,
    bufferMinutes: 10,
    maxPerDay: 8,
    minLeadHours: 2,
    maxAdvanceDays: 30,
    reminders: [
      { id: 'r24h', offsetMinutes: 1440, channels: ['email', 'sms', 'chat'], enabled: true },
      { id: 'r1h', offsetMinutes: 60, channels: ['email', 'sms', 'chat'], enabled: true },
    ],
    autoMarkNoShow: true,
    noShowGraceMinutes: 30,
  };
}

const inputCls =
  'w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60';
const labelCls = 'block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5';

function fmtWhen(iso: string, tz: string): string {
  try {
    const d = new Date(iso);
    return (
      d.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }) +
      ' ' +
      d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' })
    );
  } catch {
    return iso;
  }
}

const STATUS_STYLE: Record<BookingStatus, string> = {
  confirmed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  completed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  cancelled: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  no_show: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export const BookingSettingsCard: React.FC<{ workspaceId: string }> = ({ workspaceId }) => {
  const [settings, setSettings] = useState<BookingSettings>(emptySettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [copied, setCopied] = useState<'link' | 'embed' | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', phone: '', startUtc: '', notes: '' });
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setSettings(await getBookingSettings(workspaceId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load booking settings.');
    } finally {
      setLoading(false);
    }
  };

  const loadBookings = async () => {
    setBookingsLoading(true);
    try {
      setBookings(await listBookings(workspaceId, { limit: 50 }));
    } catch {
      // bookings list is a nice to have; settings matter most
    } finally {
      setBookingsLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const next = await saveBookingSettings(workspaceId, settings);
      setSettings(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  const updateReminder = (id: string, patch: Partial<BookingReminderRule>) => {
    setSettings((s) => ({
      ...s,
      reminders: s.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const toggleChannel = (id: string, channel: ReminderChannel) => {
    setSettings((s) => ({
      ...s,
      reminders: s.reminders.map((r) =>
        r.id === id
          ? { ...r, channels: r.channels.includes(channel) ? r.channels.filter((c) => c !== channel) : [...r.channels, channel] }
          : r,
      ),
    }));
  };

  const copy = async (kind: 'link' | 'embed') => {
    const text = kind === 'link' ? bookingPageUrl(workspaceId) : bookingEmbedSnippet(workspaceId);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  const setStatus = async (bookingId: string, status: BookingStatus) => {
    try {
      await adminSetBookingStatus(workspaceId, bookingId, status);
      await loadBookings();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update booking.');
    }
  };

  const cancel = async (bookingId: string) => {
    if (!window.confirm('Cancel this booking?')) return;
    try {
      await adminCancelBooking(workspaceId, bookingId);
      await loadBookings();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel booking.');
    }
  };

  const addManual = async () => {
    if (!addForm.name.trim() || !addForm.email.trim() || !addForm.startUtc) {
      setError('Name, email, and date/time are required.');
      return;
    }
    setAdding(true);
    setError('');
    try {
      await adminCreateBooking(workspaceId, {
        name: addForm.name.trim(),
        email: addForm.email.trim(),
        phone: addForm.phone.trim() || undefined,
        startUtc: new Date(addForm.startUtc).toISOString(),
        notes: addForm.notes.trim() || undefined,
      });
      setAddForm({ name: '', email: '', phone: '', startUtc: '', notes: '' });
      setShowAdd(false);
      await loadBookings();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create booking.');
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {/* Availability */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">Availability</h3>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              className="w-4 h-4 accent-cyan-500"
            />
            Online booking on
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelCls}>Event name</label>
            <input className={inputCls} value={settings.eventName} onChange={(e) => setSettings({ ...settings, eventName: e.target.value })} placeholder="Intro Call" />
          </div>
          <div>
            <label className={labelCls}>Location</label>
            <input className={inputCls} value={settings.location || ''} onChange={(e) => setSettings({ ...settings, location: e.target.value })} placeholder="Zoom link, office address..." />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Description</label>
            <textarea className={inputCls} rows={2} value={settings.eventDescription || ''} onChange={(e) => setSettings({ ...settings, eventDescription: e.target.value })} placeholder="What happens on this call..." />
          </div>
          <div>
            <label className={labelCls}>Time zone</label>
            <select className={inputCls} value={settings.timeZone} onChange={(e) => setSettings({ ...settings, timeZone: e.target.value })}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Slot length (min)</label>
              <input type="number" min={5} max={480} className={inputCls} value={settings.slotMinutes} onChange={(e) => setSettings({ ...settings, slotMinutes: Number(e.target.value) || 30 })} />
            </div>
            <div>
              <label className={labelCls}>Buffer between (min)</label>
              <input type="number" min={0} max={240} className={inputCls} value={settings.bufferMinutes} onChange={(e) => setSettings({ ...settings, bufferMinutes: Number(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 md:col-span-2">
            <div>
              <label className={labelCls}>Max per day</label>
              <input type="number" min={1} max={100} className={inputCls} value={settings.maxPerDay} onChange={(e) => setSettings({ ...settings, maxPerDay: Number(e.target.value) || 8 })} />
            </div>
            <div>
              <label className={labelCls}>Min lead time (hrs)</label>
              <input type="number" min={0} max={720} className={inputCls} value={settings.minLeadHours} onChange={(e) => setSettings({ ...settings, minLeadHours: Number(e.target.value) || 0 })} />
            </div>
            <div>
              <label className={labelCls}>Book ahead (days)</label>
              <input type="number" min={1} max={365} className={inputCls} value={settings.maxAdvanceDays} onChange={(e) => setSettings({ ...settings, maxAdvanceDays: Number(e.target.value) || 30 })} />
            </div>
          </div>
        </div>

        <label className={labelCls}>Working hours</label>
        <div className="space-y-2">
          {settings.workingHours.map((w, i) => (
            <div key={w.day} className="flex items-center gap-3">
              <label className="flex items-center gap-2 w-20 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={w.enabled}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      workingHours: s.workingHours.map((d, j) => (j === i ? { ...d, enabled: e.target.checked } : d)),
                    }))
                  }
                  className="w-4 h-4 accent-cyan-500"
                />
                {DAY_NAMES[w.day]}
              </label>
              <input
                type="time"
                disabled={!w.enabled}
                className={`${inputCls} !w-auto disabled:opacity-40`}
                value={w.start}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    workingHours: s.workingHours.map((d, j) => (j === i ? { ...d, start: e.target.value } : d)),
                  }))
                }
              />
              <span className="text-slate-500 text-xs">to</span>
              <input
                type="time"
                disabled={!w.enabled}
                className={`${inputCls} !w-auto disabled:opacity-40`}
                value={w.end}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    workingHours: s.workingHours.map((d, j) => (j === i ? { ...d, end: e.target.value } : d)),
                  }))
                }
              />
            </div>
          ))}
        </div>
      </div>

      {/* Reminders */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-5 h-5 text-amber-400" />
          <h3 className="text-base font-bold text-white">Calendar reminders</h3>
        </div>
        <p className="text-xs text-slate-400 mb-4">Automatic reminders before each booking. This is what stops missed appointments.</p>
        <div className="space-y-3">
          {settings.reminders.map((r) => (
            <div key={r.id} className="bg-slate-900/60 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={r.enabled} onChange={(e) => updateReminder(r.id, { enabled: e.target.checked })} className="w-4 h-4 accent-cyan-500" />
                  On
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    max={10080}
                    className={`${inputCls} !w-24`}
                    value={r.offsetMinutes}
                    onChange={(e) => updateReminder(r.id, { offsetMinutes: Number(e.target.value) || 60 })}
                  />
                  <span className="text-xs text-slate-400">minutes before</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {(['email', 'sms', 'chat'] as ReminderChannel[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleChannel(r.id, c)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                        r.channels.includes(c)
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                          : 'bg-white/5 text-slate-500 border-white/10 hover:text-slate-300'
                      }`}
                    >
                      {c === 'chat' ? 'Chat' : c.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, reminders: s.reminders.filter((x) => x.id !== r.id) }))}
                  className="ml-auto p-1.5 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                  title="Remove reminder"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3">
                <label className={labelCls}>Custom message (optional)</label>
                <textarea
                  className={inputCls}
                  rows={2}
                  value={r.message || ''}
                  onChange={(e) => updateReminder(r.id, { message: e.target.value })}
                  placeholder="Hi {{name}}, reminder: {{event_name}} on {{date}} at {{time}}. Change it: {{manage_link}}"
                />
                <p className="text-[10px] text-slate-500 mt-1">Tags: {'{{name}} {{event_name}} {{date}} {{time}} {{location}} {{manage_link}}'}</p>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setSettings((s) => ({
                ...s,
                reminders: [...s.reminders, { id: `r${Date.now()}`, offsetMinutes: 120, channels: ['email'], enabled: true }],
              }))
            }
            className="flex items-center gap-1.5 text-xs font-bold text-cyan-300 hover:text-cyan-200 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add reminder
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input
            type="checkbox"
            id="auto-noshow"
            checked={settings.autoMarkNoShow}
            onChange={(e) => setSettings({ ...settings, autoMarkNoShow: e.target.checked })}
            className="w-4 h-4 accent-cyan-500"
          />
          <label htmlFor="auto-noshow" className="text-xs text-slate-300 cursor-pointer">
            Auto mark missed
          </label>
          <input
            type="number"
            min={0}
            max={1440}
            className={`${inputCls} !w-20`}
            value={settings.noShowGraceMinutes}
            onChange={(e) => setSettings({ ...settings, noShowGraceMinutes: Number(e.target.value) || 0 })}
          />
          <span className="text-xs text-slate-400">minutes after the booking ends</span>
        </div>
      </div>

      {/* Share */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <CalendarCheck className="w-5 h-5 text-emerald-400" />
          <h3 className="text-base font-bold text-white">Share your booking page</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input className={inputCls} readOnly value={bookingPageUrl(workspaceId)} onFocus={(e) => e.target.select()} />
            <button type="button" onClick={() => copy('link')} className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer">
              {copied === 'link' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied === 'link' ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input className={inputCls} readOnly value={bookingEmbedSnippet(workspaceId)} onFocus={(e) => e.target.select()} />
            <button type="button" onClick={() => copy('embed')} className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              {copied === 'embed' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied === 'embed' ? 'Copied' : 'Copy embed'}
            </button>
          </div>
          <p className="text-[11px] text-slate-500">Paste the embed snippet on your website, or send the link in chat, email, or SMS. Booking data lands on the contact automatically.</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save settings'}
        </button>
        {saved && <span className="text-xs text-emerald-400 font-bold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Saved</span>}
      </div>

      {/* Bookings list */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white">Upcoming and recent bookings</h3>
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
          >
            {showAdd ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showAdd ? 'Close' : 'Add booking'}
          </button>
        </div>

        {showAdd && (
          <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Name</label>
              <input className={inputCls} value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input className={inputCls} value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Phone (optional)</label>
              <input className={inputCls} value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Date and time</label>
              <input type="datetime-local" className={inputCls} value={addForm.startUtc} onChange={(e) => setAddForm({ ...addForm, startUtc: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Notes (optional)</label>
              <input className={inputCls} value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={addManual}
                disabled={adding}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                {adding ? 'Adding...' : 'Add booking'}
              </button>
            </div>
          </div>
        )}

        {bookingsLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-cyan-400 animate-spin" /></div>
        ) : bookings.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No bookings yet. Share your booking page to get the first one.</p>
        ) : (
          <div className="space-y-2">
            {bookings.map((b) => (
              <div key={b.id} className="flex items-center gap-3 bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white truncate">{b.name}</div>
                  <div className="text-[11px] text-slate-400 truncate">{fmtWhen(b.startUtc, settings.timeZone)} &middot; {b.email}</div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${STATUS_STYLE[b.status]}`}>{b.status === 'no_show' ? 'missed' : b.status}</span>
                {b.status === 'confirmed' && (
                  <>
                    <button type="button" onClick={() => setStatus(b.id, 'completed')} className="text-[11px] font-bold text-emerald-300 hover:text-emerald-200 cursor-pointer">Complete</button>
                    <button type="button" onClick={() => setStatus(b.id, 'no_show')} className="text-[11px] font-bold text-amber-300 hover:text-amber-200 cursor-pointer">Missed</button>
                    <button type="button" onClick={() => cancel(b.id)} className="text-[11px] font-bold text-red-300 hover:text-red-200 cursor-pointer">Cancel</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
