import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  ArrowRight,
  BarChart3,
  FlaskConical,
  HandHelping,
  Inbox,
  Loader2,
  Megaphone,
  MessageSquare,
  MousePointerClick,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** One daily counter doc, flattened keys with dotted per-channel names. */
type DailyRow = {
  date: string;
  [key: string]: number | string | Record<string, unknown> | undefined;
};

type FlowStep = { title?: string; views?: number };
type CampaignAgg = {
  name: string;
  sent: number;
  failed: number;
  delivered: number;
  read: number;
  clicked: number;
  unsubscribed: number;
  revenueCents: number;
};

type OverviewResponse = {
  ok: boolean;
  days: number;
  daily: DailyRow[];
  simDaily: DailyRow[];
  lifetimeRevenueCents: number;
  recentRevenue: Array<{ amountCents: number; note: string; loggedAt: string; source: string }>;
};

const CHANNELS = ["messenger", "instagram", "whatsapp", "sms", "web"] as const;
type ChannelFilter = "all" | (typeof CHANNELS)[number];

const CHANNEL_LABEL: Record<string, string> = {
  messenger: "Messenger",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  sms: "SMS",
  web: "Web chat",
};

const CHANNEL_COLORS = ["#38bdf8", "#f472b6", "#34d399", "#fbbf24", "#a78bfa"];

const fmtMoney = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);

const fmtPct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "0%");

const fmtNum = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n || 0));

function num(row: DailyRow, key: string): number {
  const v = row[key];
  return typeof v === "number" ? v : 0;
}

/** Sum a counter across days, optionally scoped to one channel. */
function sum(rows: DailyRow[], key: string, channel: ChannelFilter): number {
  const k = channel === "all" ? key : `${key}.${channel}`;
  return rows.reduce((acc, r) => acc + num(r, k), 0);
}

/** Merge the nested flows/campaigns maps across all days into plain aggregates. */
function mergeMaps(
  rows: DailyRow[],
  mapKey: "flows" | "campaigns",
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const row of rows) {
    const maps = row[mapKey];
    if (!maps || typeof maps !== "object") continue;
    for (const [id, raw] of Object.entries(maps)) {
      const e = raw as Record<string, unknown>;
      if (!out[id]) out[id] = { name: (e.name as string) || id };
      const agg = out[id];
      for (const [k, v] of Object.entries(e)) {
        if (k === "name") continue;
        if (k === "steps" && v && typeof v === "object") {
          const steps = (agg.steps ?? {}) as Record<string, FlowStep>;
          for (const [sid, sraw] of Object.entries(v as Record<string, FlowStep>)) {
            const s = steps[sid] ?? { title: sraw?.title };
            s.views = (s.views ?? 0) + (sraw?.views ?? 0);
            steps[sid] = s;
          }
          agg.steps = steps;
          continue;
        }
        agg[k] = (typeof agg[k] === "number" ? (agg[k] as number) : 0) + (typeof v === "number" ? v : 0);
      }
    }
  }
  return out;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 ${className}`}>
      {children}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          {icon}
        </div>
        <p className="text-sm text-slate-400">{label}</p>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub ? <p className="text-xs text-slate-500 mt-1">{sub}</p> : null}
    </Card>
  );
}

const tooltipStyle = {
  backgroundColor: "#0f172a",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "12px",
  color: "#e2e8f0",
  fontSize: "12px",
};

export function Dashboard({
  title = "Analytics & Overview",
  workspaceId,
}: {
  title?: string;
  workspaceId?: string;
}) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [includeSim, setIncludeSim] = useState(false);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const functions = getFunctions(getApp(), "us-west2");
      const fn = httpsCallable<{ workspaceId: string; days: number; includeSim: boolean }, OverviewResponse>(
        functions,
        "getAnalyticsOverview",
      );
      const res = await fn({ workspaceId, days, includeSim });
      setData(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, days, includeSim]);

  useEffect(() => {
    load();
  }, [load]);

  const agg = useMemo(() => {
    const rows = data?.daily ?? [];
    const sent = sum(rows, "sent", channel);
    const delivered = sum(rows, "delivered", channel);
    const read = sum(rows, "read", channel);
    const clicked = sum(rows, "clicked", channel);
    const inbound = sum(rows, "inbound", channel);
    const convosNew = sum(rows, "convosNew", channel);
    const subsNew = sum(rows, "subsNew", channel);
    const subsRemoved = sum(rows, "subsRemoved", channel);
    const broadcastsSent = sum(rows, "broadcastsSent", "all");
    const broadcastsFailed = sum(rows, "broadcastsFailed", "all");
    const fallback = sum(rows, "fallback", channel);
    const handoffStarted = sum(rows, "handoffStarted", channel);
    const handoffResolved = sum(rows, "handoffResolved", channel);
    const handoffMs = sum(rows, "handoffResponseMsTotal", channel);
    const handoffCount = sum(rows, "handoffResponseCount", channel);
    const revenueCents = sum(rows, "revenueCents", "all");

    const chartRows = rows.map((r) => ({
      date: r.date.slice(5),
      sent: channel === "all" ? num(r, "sent") : num(r, `sent.${channel}`),
      inbound: channel === "all" ? num(r, "inbound") : num(r, `inbound.${channel}`),
      subs: (channel === "all" ? num(r, "subsNew") : num(r, `subsNew.${channel}`)) -
        (channel === "all" ? num(r, "subsRemoved") : num(r, `subsRemoved.${channel}`)),
    }));

    const channelPie = CHANNELS.map((ch, i) => ({
      name: CHANNEL_LABEL[ch],
      value: sum(rows, "inbound", ch),
      color: CHANNEL_COLORS[i],
    })).filter((c) => c.value > 0);

    const flowMap = mergeMaps(rows, "flows");
    const flows = Object.values(flowMap)
      .map((f) => ({
        name: String(f.name ?? ""),
        entered: Number(f.entered ?? 0),
        completed: Number(f.completed ?? 0),
        revenueCents: Number(f.revenueCents ?? 0),
        steps: (f.steps ?? {}) as Record<string, FlowStep>,
      }))
      .filter((f) => f.entered > 0)
      .sort((a, b) => b.entered - a.entered)
      .slice(0, 5);

    const campMap = mergeMaps(rows, "campaigns");
    const campaigns: CampaignAgg[] = Object.values(campMap)
      .map((c) => ({
        name: String(c.name ?? ""),
        sent: Number(c.sent ?? 0),
        failed: Number(c.failed ?? 0),
        delivered: Number(c.delivered ?? 0),
        read: Number(c.read ?? 0),
        clicked: Number(c.clicked ?? 0),
        unsubscribed: Number(c.unsubscribed ?? 0),
        revenueCents: Number(c.revenueCents ?? 0),
      }))
      .filter((c) => c.sent > 0)
      .sort((a, b) => b.sent - a.sent)
      .slice(0, 10);

    return {
      sent, delivered, read, clicked, inbound, convosNew, subsNew, subsRemoved,
      broadcastsSent, broadcastsFailed, fallback, handoffStarted, handoffResolved,
      handoffMs, handoffCount, revenueCents, chartRows, channelPie, flows, campaigns,
    };
  }, [data, channel]);

  const simAgg = useMemo(() => {
    const rows = data?.simDaily ?? [];
    return {
      sent: sum(rows, "sent", "all"),
      inbound: sum(rows, "inbound", "all"),
    };
  }, [data]);

  const hasTraffic = agg.sent + agg.inbound + agg.convosNew > 0;

  if (!workspaceId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Select a workspace to see analytics.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-6">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-1">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">{title}</h2>
          <p className="text-slate-400 text-sm">
            How your chats, flows, broadcasts, and revenue are doing. Simulator runs are kept separate.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as 7 | 30 | 90)}
            className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-300 outline-none focus:border-blue-500"
            aria-label="Date range"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as ChannelFilter)}
            className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-300 outline-none focus:border-blue-500"
            aria-label="Channel filter"
          >
            <option value="all">All channels</option>
            {CHANNELS.map((ch) => (
              <option key={ch} value={ch}>{CHANNEL_LABEL[ch]}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeSim}
              onChange={(e) => setIncludeSim(e.target.checked)}
              className="accent-cyan-400"
            />
            Show simulator
          </label>
          <button
            onClick={load}
            className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:border-white/25"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-24">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-slate-400 text-sm">Loading your numbers...</p>
        </div>
      ) : error ? (
        <Card className="text-center py-16">
          <p className="text-white font-semibold mb-2">Could not load analytics</p>
          <p className="text-slate-400 text-sm mb-4">{error}</p>
          <button
            onClick={load}
            className="px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-400/30 text-cyan-200 text-sm font-semibold hover:bg-cyan-500/30"
          >
            Try again
          </button>
        </Card>
      ) : !hasTraffic ? (
        <Card className="text-center py-20">
          <Inbox className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-white font-semibold text-lg mb-2">No data yet</p>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Once chats come in, messages go out, or a flow runs, this dashboard fills in
            with funnels, delivery stats, subscriber growth, and revenue. Connect a
            channel to get started.
          </p>
        </Card>
      ) : (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi
              icon={<MessageSquare className="w-5 h-5 text-cyan-400" />}
              label="Messages sent"
              value={fmtNum(agg.sent)}
              sub={`${fmtPct(agg.read, agg.sent)} read, ${fmtPct(agg.clicked, agg.sent)} clicked`}
            />
            <Kpi
              icon={<Inbox className="w-5 h-5 text-blue-400" />}
              label="Messages received"
              value={fmtNum(agg.inbound)}
              sub={`${fmtNum(agg.convosNew)} new conversations`}
            />
            <Kpi
              icon={<Users className="w-5 h-5 text-emerald-400" />}
              label="Subscriber growth"
              value={`+${fmtNum(agg.subsNew - agg.subsRemoved)}`}
              sub={`${fmtNum(agg.subsNew)} joined, ${fmtNum(agg.subsRemoved)} left`}
            />
            <Kpi
              icon={<Wallet className="w-5 h-5 text-amber-400" />}
              label="Revenue earned"
              value={fmtMoney(agg.revenueCents)}
              sub={data ? `${fmtMoney(data.lifetimeRevenueCents)} all time` : undefined}
            />
            <Kpi
              icon={<BarChart3 className="w-5 h-5 text-indigo-400" />}
              label="Click rate"
              value={fmtPct(agg.clicked, agg.sent)}
              sub={`${fmtNum(agg.clicked)} clicks on ${fmtNum(agg.sent)} sent`}
            />
            <Kpi
              icon={<Megaphone className="w-5 h-5 text-rose-400" />}
              label="Broadcasts sent"
              value={fmtNum(agg.broadcastsSent)}
              sub={agg.broadcastsFailed > 0 ? `${fmtNum(agg.broadcastsFailed)} failed to send` : "Everything delivered to the provider"}
            />
            <Kpi
              icon={<TrendingUp className="w-5 h-5 text-orange-400" />}
              label="Unanswered chats"
              value={fmtPct(agg.fallback, agg.inbound)}
              sub={`${fmtNum(agg.fallback)} chats got no reply in time`}
            />
            <Kpi
              icon={<HandHelping className="w-5 h-5 text-violet-400" />}
              label="Human takeover"
              value={fmtPct(agg.handoffStarted, agg.convosNew)}
              sub={
                agg.handoffCount > 0
                  ? `First reply in ${Math.round(agg.handoffMs / agg.handoffCount / 60000)} min on average`
                  : `${fmtNum(agg.handoffResolved)} resolved by a person`
              }
            />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white">Messages over time</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={agg.chartRows} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Area type="monotone" dataKey="sent" name="Sent" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.25} />
                    <Area type="monotone" dataKey="inbound" name="Received" stroke="#34d399" fill="#34d399" fillOpacity={0.25} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white">Chats by channel</h3>
              </div>
              {agg.channelPie.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={agg.channelPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                        {agg.channelPie.map((c) => (
                          <Cell key={c.name} fill={c.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-slate-500 text-sm py-16 text-center">No chats yet in this range.</p>
              )}
            </Card>
          </section>

          {agg.flows.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white">Flow funnels</h3>
              </div>
              <p className="text-slate-500 text-xs mb-5">Where people enter, where they drop off, and what each flow earned.</p>
              <div className="flex flex-col gap-6">
                {agg.flows.map((f) => {
                  const steps = Object.entries(f.steps)
                    .sort((a, b) => (b[1].views ?? 0) - (a[1].views ?? 0))
                    .slice(0, 6);
                  const maxViews = Math.max(f.entered, ...steps.map(([, s]) => s.views ?? 0), f.completed, 1);
                  return (
                    <div key={f.name} className="border border-white/5 rounded-2xl p-4 bg-white/[0.02]">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <p className="font-semibold text-white">{f.name}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span>{fmtNum(f.entered)} entered</span>
                          <span className="flex items-center gap-1">
                            <ArrowRight className="w-3 h-3" /> {fmtNum(f.completed)} finished
                            <span className="text-emerald-300 font-semibold">({fmtPct(f.completed, f.entered)})</span>
                          </span>
                          {f.revenueCents > 0 && (
                            <span className="text-amber-300 font-semibold">
                              This flow earned {fmtMoney(f.revenueCents)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <FunnelRow label="Entered" views={f.entered} max={maxViews} color="#38bdf8" />
                        {steps.map(([sid, s]) => (
                          <FunnelRow
                            key={sid}
                            label={s.title || "Step"}
                            views={s.views ?? 0}
                            max={maxViews}
                            color="#818cf8"
                            dropFrom={f.entered}
                          />
                        ))}
                        <FunnelRow label="Completed" views={f.completed} max={maxViews} color="#34d399" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <MousePointerClick className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white">Message performance</h3>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Sent", value: agg.sent },
                      { name: "Delivered", value: agg.delivered },
                      { name: "Read", value: agg.read },
                      { name: "Clicked", value: agg.clicked },
                    ]}
                    margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Delivery and read counts depend on what each channel reports back. WhatsApp
                reports both, Messenger and Instagram report reads, SMS reports sends.
              </p>
            </Card>
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white">Subscriber growth</h3>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={agg.chartRows} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Area type="monotone" dataKey="subs" name="Net growth" stroke="#34d399" fill="#34d399" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-slate-500 mt-3">
                {fmtNum(agg.subsNew)} new and {fmtNum(agg.subsRemoved)} removed in this range.
              </p>
            </Card>
          </section>

          {agg.campaigns.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-1">
                <Megaphone className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-white">Broadcast and campaign reports</h3>
              </div>
              <p className="text-slate-500 text-xs mb-4">Delivery, reads, clicks, unsubscribes, and attributed revenue per campaign.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 text-xs border-b border-white/10">
                      <th className="py-2 pr-4 font-medium">Campaign</th>
                      <th className="py-2 pr-4 font-medium text-right">Sent</th>
                      <th className="py-2 pr-4 font-medium text-right">Failed</th>
                      <th className="py-2 pr-4 font-medium text-right">Delivered</th>
                      <th className="py-2 pr-4 font-medium text-right">Read</th>
                      <th className="py-2 pr-4 font-medium text-right">Clicked</th>
                      <th className="py-2 pr-4 font-medium text-right">Unsub</th>
                      <th className="py-2 font-medium text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agg.campaigns.map((c) => (
                      <tr key={c.name} className="border-b border-white/5 text-slate-300">
                        <td className="py-2.5 pr-4 text-white font-medium max-w-[220px] truncate" title={c.name}>
                          {c.name}
                        </td>
                        <td className="py-2.5 pr-4 text-right">{fmtNum(c.sent)}</td>
                        <td className="py-2.5 pr-4 text-right text-rose-300">{fmtNum(c.failed)}</td>
                        <td className="py-2.5 pr-4 text-right">{fmtNum(c.delivered)}</td>
                        <td className="py-2.5 pr-4 text-right">{fmtNum(c.read)}</td>
                        <td className="py-2.5 pr-4 text-right">{fmtNum(c.clicked)}</td>
                        <td className="py-2.5 pr-4 text-right">{fmtNum(c.unsubscribed)}</td>
                        <td className="py-2.5 text-right text-amber-300 font-semibold">
                          {c.revenueCents > 0 ? fmtMoney(c.revenueCents) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card>
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-white">Revenue</h3>
            </div>
            <p className="text-slate-500 text-xs mb-4">
              {fmtMoney(agg.revenueCents)} in this range, {fmtMoney(data?.lifetimeRevenueCents ?? 0)} all time.
            </p>
            {(data?.recentRevenue?.length ?? 0) > 0 ? (
              <div className="flex flex-col divide-y divide-white/5">
                {(data?.recentRevenue ?? []).map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm text-white font-medium">{r.note || "Revenue logged"}</p>
                      <p className="text-xs text-slate-500">
                        {r.source === "flow_action" ? "From a flow" : "Logged manually"}
                        {r.loggedAt ? `, ${new Date(r.loggedAt).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <p className="text-amber-300 font-bold">{fmtMoney(r.amountCents)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">
                Nothing logged in this range. Tag a booking or sale with a dollar value using
                the log revenue flow action and it shows up here.
              </p>
            )}
          </Card>

          {includeSim && (simAgg.sent + simAgg.inbound > 0) && (
            <Card className="border-amber-400/20">
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white">Simulator traffic (kept separate)</h3>
              </div>
              <p className="text-slate-400 text-sm">
                {fmtNum(simAgg.inbound)} test messages in and {fmtNum(simAgg.sent)} out from flow
                previews. These never touch the live numbers above.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function FunnelRow({
  label,
  views,
  max,
  color,
  dropFrom,
}: {
  label: string;
  views: number;
  max: number;
  color: string;
  dropFrom?: number;
}) {
  const pct = max > 0 ? (views / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs text-slate-400 w-36 truncate shrink-0" title={label}>{label}</p>
      <div className="flex-1 h-6 bg-white/5 rounded-lg overflow-hidden">
        <div
          className="h-full rounded-lg transition-all"
          style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.85 }}
        />
      </div>
      <p className="text-xs text-slate-300 w-24 text-right shrink-0">
        {fmtNum(views)}
        {dropFrom !== undefined && dropFrom > 0 && views < dropFrom ? (
          <span className="text-rose-300"> (−{fmtPct(dropFrom - views, dropFrom)})</span>
        ) : null}
      </p>
    </div>
  );
}
