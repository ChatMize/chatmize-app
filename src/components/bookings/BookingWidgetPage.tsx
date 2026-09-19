import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Check, ChevronLeft, ChevronRight, Clock, Loader2, MapPin } from 'lucide-react';
import {
  PublicBookingSettings,
  Slot,
  createPublicBooking,
  getBookingSlots,
  getPublicBookingSettings,
} from '../../lib/bookings';

interface BookingWidgetPageProps {
  workspaceId: string;
  embed?: boolean;
}

function dayLabel(iso: string, tz: string): { dow: string; num: string } {
  const d = new Date(`${iso}T12:00:00Z`);
  return {
    dow: d.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' }),
    num: d.toLocaleDateString('en-US', { timeZone: tz, day: 'numeric' }),
  };
}

function slotLabel(iso: string, tz: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
}

function toIso(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

const inputCls =
  'w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-cyan-500';

export const BookingWidgetPage: React.FC<BookingWidgetPageProps> = ({ workspaceId, embed }) => {
  const [settings, setSettings] = useState<PublicBookingSettings | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [days, setDays] = useState<string[]>([]);
  const [dayOffset, setDayOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [step, setStep] = useState<'pick' | 'form' | 'done'>('pick');
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '', smsConsent: true });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [doneInfo, setDoneInfo] = useState<{ startUtc: string; manageLink: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await getPublicBookingSettings(workspaceId);
        setSettings(s);
        const list: string[] = [];
        const now = new Date();
        for (let i = 0; i < Math.min(s.maxAdvanceDays, 60); i++) {
          const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i));
          list.push(toIso(d));
        }
        setDays(list);
        setSelectedDay(list[0] || '');
        setLoadState('ready');
      } catch {
        setLoadState('missing');
      }
    })();
  }, [workspaceId]);

  const loadSlots = useCallback(
    async (day: string) => {
      if (!day) return;
      setSlotsLoading(true);
      setSelectedSlot('');
      try {
        const { slots: s } = await getBookingSlots(workspaceId, day, day);
        setSlots(s);
      } catch {
        setSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    if (loadState === 'ready' && selectedDay) loadSlots(selectedDay);
  }, [loadState, selectedDay, loadSlots]);

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || !selectedSlot) {
      setError('Please fill in your name, email, and pick a time.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await createPublicBooking({
        workspaceId,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        startUtc: selectedSlot,
        notes: form.notes.trim() || undefined,
        smsConsent: form.smsConsent,
        embed,
      });
      setDoneInfo({ startUtc: res.startUtc, manageLink: res.manageLink });
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete the booking.');
    } finally {
      setSubmitting(false);
    }
  };

  const shell = embed ? 'min-h-0' : 'min-h-screen';
  const card = embed ? 'max-w-lg mx-auto' : 'max-w-lg mx-auto py-10 px-4';

  if (loadState === 'loading') {
    return (
      <div className={`${shell} bg-slate-50 flex items-center justify-center py-20`}>
        <Loader2 className="w-6 h-6 text-cyan-600 animate-spin" />
      </div>
    );
  }
  if (loadState === 'missing' || !settings) {
    return (
      <div className={`${shell} bg-slate-50 flex items-center justify-center py-20 px-4`}>
        <p className="text-sm text-slate-500 text-center">Online booking is not available right now.</p>
      </div>
    );
  }

  const visibleDays = days.slice(dayOffset, dayOffset + 7);
  const tz = settings.timeZone;

  return (
    <div className={`${shell} bg-slate-50 ${card}`}>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-700 px-6 py-5">
          <div className="flex items-center gap-2 text-white/80 text-xs font-bold uppercase tracking-wide mb-1">
            <Calendar className="w-3.5 h-3.5" /> Book now
          </div>
          <h1 className="text-xl font-bold text-white">{settings.eventName}</h1>
          {settings.eventDescription && <p className="text-sm text-white/80 mt-1">{settings.eventDescription}</p>}
          <div className="flex items-center gap-3 mt-2 text-xs text-white/70">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {settings.slotMinutes} min</span>
            {settings.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {settings.location}</span>}
          </div>
        </div>

        <div className="p-6">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

          {step === 'done' && doneInfo ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-7 h-7 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">You are booked</h2>
              <p className="text-sm text-slate-500 mt-1">
                {new Date(doneInfo.startUtc).toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' })}
                {' at '}
                {new Date(doneInfo.startUtc).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' })}
              </p>
              <p className="text-xs text-slate-400 mt-2">A confirmation and reminders are on the way. Need to change it?</p>
              <a href={doneInfo.manageLink} className="inline-block mt-3 text-sm font-bold text-cyan-700 hover:text-cyan-600">
                Reschedule or cancel
              </a>
            </div>
          ) : step === 'form' ? (
            <div>
              <button type="button" onClick={() => setStep('pick')} className="text-xs font-bold text-slate-500 hover:text-slate-700 mb-4 cursor-pointer">
                &larr; Pick a different time
              </button>
              <p className="text-sm font-bold text-slate-900 mb-1">
                {new Date(selectedSlot).toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' })}
                {' at '}
                {slotLabel(selectedSlot, tz)}
              </p>
              <div className="space-y-3 mt-4">
                <input className={inputCls} placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <input className={inputCls} placeholder="Email address" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <input className={inputCls} placeholder="Phone (for text reminders)" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <textarea className={inputCls} rows={2} placeholder="Anything we should know? (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                <label className="flex items-start gap-2 text-xs text-slate-500 cursor-pointer">
                  <input type="checkbox" checked={form.smsConsent} onChange={(e) => setForm({ ...form, smsConsent: e.target.checked })} className="w-4 h-4 mt-0.5 accent-cyan-600" />
                  Text me reminders before the booking
                </label>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold cursor-pointer"
                >
                  {submitting ? 'Booking...' : 'Confirm booking'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  disabled={dayOffset === 0}
                  onClick={() => setDayOffset((o) => Math.max(0, o - 7))}
                  className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Pick a day</span>
                <button
                  type="button"
                  disabled={dayOffset + 7 >= days.length}
                  onClick={() => setDayOffset((o) => o + 7)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1.5 mb-5">
                {visibleDays.map((d) => {
                  const { dow, num } = dayLabel(d, tz);
                  const active = d === selectedDay;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelectedDay(d)}
                      className={`py-2 rounded-xl text-center border transition-all cursor-pointer ${
                        active ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-slate-700 border-slate-200 hover:border-cyan-400'
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase">{dow}</div>
                      <div className="text-sm font-bold">{num}</div>
                    </button>
                  );
                })}
              </div>

              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Pick a time</p>
              {slotsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-cyan-600 animate-spin" /></div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No open times this day. Try another day.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((s) => (
                    <button
                      key={s.startUtc}
                      type="button"
                      onClick={() => {
                        setSelectedSlot(s.startUtc);
                        setStep('form');
                      }}
                      className="py-2 px-1 bg-white border border-slate-200 hover:border-cyan-500 hover:text-cyan-700 rounded-xl text-sm font-bold text-slate-700 transition-all cursor-pointer"
                    >
                      {slotLabel(s.startUtc, tz)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {!embed && <p className="text-center text-[11px] text-slate-400 mt-4">Powered by ChatMize</p>}
    </div>
  );
};
