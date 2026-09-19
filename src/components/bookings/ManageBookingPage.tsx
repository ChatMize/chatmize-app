import React, { useCallback, useEffect, useState } from 'react';
import { CalendarX, Check, Loader2, RefreshCw } from 'lucide-react';
import {
  ManageLinkAuth,
  ManagedBooking,
  Slot,
  cancelPublicBooking,
  getBookingSlots,
  getManagedBooking,
  rescheduleBooking,
} from '../../lib/bookings';

interface ManageBookingPageProps {
  auth: ManageLinkAuth;
}

function slotLabel(iso: string, tz: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
}

function toIso(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export const ManageBookingPage: React.FC<ManageBookingPageProps> = ({ auth }) => {
  const workspaceId = auth.workspaceId;
  const [booking, setBooking] = useState<ManagedBooking | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [mode, setMode] = useState<'view' | 'reschedule'>('view');
  const [days, setDays] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const b = await getManagedBooking(auth);
      setBooking(b);
      const list: string[] = [];
      const now = new Date();
      for (let i = 0; i < 30; i++) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i));
        list.push(toIso(d));
      }
      setDays(list);
      setSelectedDay(list[0] || '');
      setLoadState('ready');
    } catch {
      setLoadState('missing');
    }
  }, [auth]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (mode !== 'reschedule' || !selectedDay) return;
    (async () => {
      setSlotsLoading(true);
      try {
        const { slots: s } = await getBookingSlots(workspaceId, selectedDay, selectedDay);
        setSlots(s);
      } catch {
        setSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    })();
  }, [mode, selectedDay, workspaceId]);

  const doReschedule = async (startUtc: string) => {
    setBusy(true);
    setError('');
    try {
      await rescheduleBooking(auth, startUtc);
      setDone('Your booking was moved. A confirmation is on the way.');
      setMode('view');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reschedule.');
    } finally {
      setBusy(false);
    }
  };

  const doCancel = async () => {
    if (!window.confirm('Cancel this booking?')) return;
    setBusy(true);
    setError('');
    try {
      await cancelPublicBooking(auth);
      setDone('Your booking was cancelled.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel.');
    } finally {
      setBusy(false);
    }
  };

  if (loadState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-cyan-600 animate-spin" />
      </div>
    );
  }
  if (loadState === 'missing' || !booking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <p className="text-sm text-slate-500 text-center">This booking link is not valid anymore.</p>
      </div>
    );
  }

  const tz = booking.timeZone;
  const when =
    new Date(booking.startUtc).toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' }) +
    ' at ' +
    new Date(booking.startUtc).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto py-10 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h1 className="text-xl font-bold text-slate-900">{booking.eventName}</h1>
          <p className="text-sm text-slate-500 mt-1">{when}</p>
          {booking.location && <p className="text-sm text-slate-500">{booking.location}</p>}
          <p className="text-xs text-slate-400 mt-1">Booked for {booking.name} &middot; {booking.email}</p>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mt-4">{error}</div>}
          {done && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 mt-4">{done}</div>}

          {booking.status !== 'confirmed' ? (
            <p className="text-sm text-slate-500 mt-4">This booking is {booking.status === 'no_show' ? 'marked as missed' : booking.status}.</p>
          ) : mode === 'reschedule' ? (
            <div className="mt-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Pick a new day</p>
              <div className="grid grid-cols-7 gap-1 mb-4">
                {days.slice(0, 14).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDay(d)}
                    className={`py-1.5 rounded-lg text-center text-xs font-bold border cursor-pointer ${
                      d === selectedDay ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: tz, day: 'numeric' })}
                  </button>
                ))}
              </div>
              {slotsLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-cyan-600 animate-spin" /></div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((s) => (
                    <button
                      key={s.startUtc}
                      type="button"
                      disabled={busy}
                      onClick={() => doReschedule(s.startUtc)}
                      className="py-2 bg-white border border-slate-200 hover:border-cyan-500 rounded-xl text-sm font-bold text-slate-700 disabled:opacity-50 cursor-pointer"
                    >
                      {slotLabel(s.startUtc, tz)}
                    </button>
                  ))}
                </div>
              )}
              {!slotsLoading && slots.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No open times this day.</p>}
              <button type="button" onClick={() => setMode('view')} className="mt-4 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer">
                &larr; Back
              </button>
            </div>
          ) : (
            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => setMode('reschedule')}
                disabled={busy}
                className="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> Reschedule
              </button>
              <button
                type="button"
                onClick={doCancel}
                disabled={busy}
                className="flex-1 py-2.5 bg-white border border-red-200 text-red-600 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
              >
                <CalendarX className="w-4 h-4" /> Cancel
              </button>
            </div>
          )}

          {done && (
            <p className="text-xs text-emerald-600 font-bold mt-3 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> {done}
            </p>
          )}
        </div>
        <p className="text-center text-[11px] text-slate-400 mt-4">Powered by ChatMize</p>
      </div>
    </div>
  );
};
