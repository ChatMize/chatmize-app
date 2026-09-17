import { Bot, Play, Plus, Settings } from 'lucide-react';
import React from 'react';

export function AIAgents() {
  return (
    <div className="flex-1 flex flex-col gap-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold mb-2 flex items-center gap-3">
            Autonomous AI Agents
            <span className="text-[10px] px-2 py-1 bg-amber-500/20 text-amber-300 rounded-full font-bold uppercase tracking-wider">Coming Soon</span>
          </h2>
          <p className="text-slate-400 text-sm">Deploy fully conversational AI without rigid node flows.</p>
        </div>
        <button disabled title="AI Agent builder — Coming soon" className="px-4 py-2 bg-white/5 border border-white/10 text-slate-500 rounded-xl font-medium text-sm flex items-center gap-2 cursor-not-allowed">
          <Plus className="w-4 h-4" />
          Create AI Agent
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AIAgentCard 
          name="Support Copilot" 
          description="Handles general FAQ, order tracking, and refund requests based on your knowledge base."
          status="active"
          conversations={842}
        />
        <AIAgentCard 
          name="Lead Qualifier" 
          description="Engages with new website visitors to collect emails and qualify them for sales."
          status="active"
          conversations={315}
        />
        <AIAgentCard 
          name="Promo Re-engager" 
          description="Reaches out to cart abandoners on IG and Messenger with dynamic discounts."
          status="draft"
          conversations={0}
        />
      </div>
    </div>
  );
}

function AIAgentCard({ name, description, status, conversations }: { name: string, description: string, status: 'active' | 'draft', conversations: number }) {
  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-cyan-400/20 to-blue-600/20 rounded-2xl flex items-center justify-center border border-white/10">
            <Bot className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-bold">{name}</h3>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${status === 'active' ? 'text-emerald-400' : 'text-slate-500'}`}>
              {status === 'active' ? 'Live & Learning' : 'Draft'}
            </span>
          </div>
        </div>
        <button disabled title="Agent settings — Coming soon" className="text-slate-600 cursor-not-allowed transition-colors">
          <Settings className="w-5 h-5" />
        </button>
      </div>
      
      <p className="text-sm text-slate-400 mb-6 flex-1">{description}</p>
      
      <div className="flex justify-between items-center pt-4 border-t border-white/10">
        <div className="text-sm">
          <span className="text-slate-500">Conversations: </span>
          <span className="font-bold text-slate-200">{conversations}</span>
        </div>
        <button disabled title="Agent logs — Coming soon" className="flex items-center gap-2 text-sm font-medium text-slate-600 cursor-not-allowed transition-colors">
          {status === 'active' ? 'View Logs' : 'Test Agent'}
          <Play className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
