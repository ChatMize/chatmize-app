import { Activity, ArrowUpRight, MessageSquare, Sparkles, Users } from 'lucide-react';
import React from 'react';

export function Dashboard({ title = "Analytics & Overview" }: { title?: string }) {
  return (
    <div className="flex-1 flex flex-col gap-6">
      <div className="flex justify-between items-center mb-1">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">{title}</h2>
          <p className="text-slate-400 text-sm">Real-time performance metrics, audience acquisition, and bot resolution rates.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Active Conversations"
          value="1,248"
          trend="+12%"
          icon={<MessageSquare className="w-5 h-5 text-cyan-400" />}
        />
        <StatCard
          title="Audience Growth"
          value="8,492"
          trend="+5.4%"
          icon={<Users className="w-5 h-5 text-blue-400" />}
        />
        <StatCard
          title="Automated Resolutions"
          value="94.2%"
          trend="+2.1%"
          icon={<Sparkles className="w-5 h-5 text-indigo-400" />}
        />
      </section>

      {/* Main Dashboard Area */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Chart/Activity Area */}
        <div className="lg:col-span-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg">Engagement Overview</h3>
            <select className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-300 outline-none focus:border-blue-500">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="flex-1 border border-dashed border-white/10 rounded-xl flex items-center justify-center text-slate-500 min-h-[200px]">
            <div className="text-center flex flex-col items-center">
              <Activity className="w-10 h-10 mb-2 opacity-50" />
              <p>Chart visualization will render here</p>
            </div>
          </div>
        </div>

        {/* Recent AI Activity */}
        <div className="bg-gradient-to-b from-blue-900/20 to-slate-900/50 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-lg">AI Insights</h3>
          </div>

          <div className="space-y-4">
            <InsightCard text="Your 'Welcome Series' bot has a 45% higher completion rate when sending messages before 10 AM." />
            <InsightCard text="Detected 15 repeated inquiries about 'pricing'. Consider adding a dedicated pricing flow." />
          </div>

          <button className="mt-auto w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2">
            View All Insights <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  title,
  value,
  trend,
  icon,
}: {
  title: string;
  value: string;
  trend: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex flex-col justify-between hover:bg-white/10 transition-colors cursor-pointer">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-slate-900/50 rounded-xl border border-white/5">{icon}</div>
        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/20">
          {trend}
        </span>
      </div>
      <div>
        <h4 className="text-slate-400 text-sm font-medium mb-1">{title}</h4>
        <span className="text-3xl font-bold tracking-tight">{value}</span>
      </div>
    </div>
  );
}

function InsightCard({ text }: { text: string }) {
  return (
    <div className="p-4 bg-slate-950/50 rounded-2xl border border-white/5">
      <p className="text-sm leading-relaxed text-slate-300">{text}</p>
    </div>
  );
}
