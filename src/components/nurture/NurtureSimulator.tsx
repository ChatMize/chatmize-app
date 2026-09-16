import React, { useState, useEffect } from 'react';
import { 
  X, 
  Send, 
  Sparkles, 
  MessageSquare, 
  Laptop, 
  Smartphone, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Check, 
  Zap, 
  ShieldCheck, 
  ChevronDown 
} from 'lucide-react';
import { NurtureTool } from '../../types/nurture';

export interface NurtureSimulatorProps {
  tool: NurtureTool;
  onLeadCaptured?: (name: string, email: string) => void;
}

export const NurtureSimulator: React.FC<NurtureSimulatorProps> = ({ 
  tool,
  onLeadCaptured
}) => {
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  // Interactive Chat State
  const [messages, setMessages] = useState<Array<{ sender: 'bot' | 'user'; text: string; time: string }>>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [leadCaptured, setLeadCaptured] = useState<boolean>(false);
  const [leadName, setLeadName] = useState<string>('');
  const [leadEmail, setLeadEmail] = useState<string>('');

  // Reset simulator when tool changes
  useEffect(() => {
    setIsOpen(true);
    setIsMinimized(false);
    setLeadCaptured(false);
    setMessages([
      {
        sender: 'bot',
        text: tool.welcomeMessage || 'Hello! How can I help you today?',
        time: 'Just now'
      }
    ]);
  }, [tool.id, tool.welcomeMessage]);

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text) return;

    // Add User Message
    const userMsg = { sender: 'user' as const, text, time: 'Just now' };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');

    // Simulate AI / Bot Map Response
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      let reply = "Thanks for your message! Our team is reviewing this right now.";
      const lower = text.toLowerCase();
      
      if (lower.includes('sales') || lower.includes('demo') || lower.includes('pricing') || lower.includes('plan')) {
        reply = "Great! I'd love to walk you through our pricing tiers and how ChatMize will scale your automated revenue. What is your estimated monthly subscriber volume?";
      } else if (lower.includes('coupon') || lower.includes('discount') || lower.includes('20%')) {
        reply = "🎉 Your exclusive VIP discount code is 'VIP20'! Enter this at checkout for 20% off all quarterly and annual plans.";
      } else if (lower.includes('order') || lower.includes('track')) {
        reply = "Sure thing! Please provide your 6-digit Order ID or the email address used during purchase so I can look up live tracking.";
      } else if (lower.includes('support') || lower.includes('help') || lower.includes('bug')) {
        reply = "I've noted this down for our tier-1 engineering support desk. We typically resolve technical inquiries within 15 minutes!";
      } else {
        reply = `Thanks for asking about "${text}". I have logged your request into your CRM profile and alerted our specialist team!`;
      }

      setMessages(prev => [
        ...prev,
        { sender: 'bot', text: reply, time: 'Just now' }
      ]);
    }, 850);
  };

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadEmail) return;
    setLeadCaptured(true);
    if (onLeadCaptured) onLeadCaptured(leadName, leadEmail);
    setMessages(prev => [
      ...prev,
      {
        sender: 'bot',
        text: `Awesome, thank you ${leadName || 'friend'}! We just dispatched full details to ${leadEmail}. Feel free to continue chatting below!`,
        time: 'Just now'
      }
    ]);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
      {/* Mock Browser Top Chrome */}
      <div className="bg-slate-900/90 border-b border-white/10 px-4 py-2.5 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
          </div>
          <span className="text-[11px] font-mono text-slate-400 ml-2 hidden sm:inline">
            Interactive Live Nurture Simulator
          </span>
        </div>

        {/* URL Bar */}
        <div className="flex-1 max-w-md bg-slate-950/80 border border-white/10 rounded-lg px-3 py-1 text-xs text-slate-300 flex items-center justify-between mx-2 truncate">
          <div className="flex items-center gap-1.5 truncate">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="text-slate-400 truncate">https://yourstore.com</span>
            <span className="text-cyan-400 font-mono text-[11px]">
              {tool.type === 'support_widget' ? '#live-chat' : tool.type === 'popup_modal' ? '#exit-intent' : tool.type === 'slider' ? '#slide-in' : tool.type === 'page_takeover' ? '#takeover' : '#announcement'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded font-mono uppercase">SSL</span>
        </div>

        {/* Device Mode Switcher & Reset */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setDeviceMode('desktop')}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              deviceMode === 'desktop' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title="Desktop view"
          >
            <Laptop className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeviceMode('mobile')}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              deviceMode === 'mobile' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title="Mobile view"
          >
            <Smartphone className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setIsOpen(true);
              setIsMinimized(false);
              setLeadCaptured(false);
              setMessages([{ sender: 'bot', text: tool.welcomeMessage, time: 'Just now' }]);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer ml-1"
            title="Replay simulator triggers"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mock Website Canvas Body */}
      <div className="flex-1 overflow-auto bg-slate-900/40 relative flex justify-center p-2 sm:p-4">
        <div 
          className={`w-full transition-all duration-300 relative bg-slate-950 border border-white/10 rounded-xl overflow-hidden flex flex-col ${
            deviceMode === 'mobile' ? 'max-w-[390px] min-h-[640px] shadow-2xl my-auto' : 'min-h-[580px]'
          }`}
        >
          
          {/* ================= STICKY BAR (If type is sticky_bar) ================= */}
          {tool.type === 'sticky_bar' && (
            <div 
              style={{ borderColor: tool.brandColor }}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b flex items-center justify-between text-xs text-white z-20 shadow-md"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: tool.brandColor }}></span>
                <p className="font-medium truncate">{tool.headline}</p>
              </div>
              <button 
                onClick={() => setIsOpen(true)}
                style={{ backgroundColor: tool.brandColor }}
                className="px-3 py-1 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 hover:brightness-110 transition-all flex-shrink-0 ml-3 shadow cursor-pointer"
              >
                <span>Chat with Bot</span>
                <Zap className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Mock Website Page Content */}
          <div className="flex-1 p-6 space-y-6 opacity-75 select-none pointer-events-none filter blur-[0.2px]">
            {/* Mock Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
                  A
                </div>
                <span className="font-bold text-sm text-white">Acme Commerce &amp; SaaS</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span>Products</span>
                <span>Pricing</span>
                <span>Solutions</span>
                <span className="px-2.5 py-1 bg-white/10 rounded-lg text-white">Sign In</span>
              </div>
            </div>

            {/* Mock Hero Content */}
            <div className="space-y-3 pt-4">
              <div className="inline-block px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-mono">
                SPRING COLLECTION &amp; SOFTWARE RELEASE
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Scale Customer Conversations Automatically
              </h1>
              <p className="text-xs text-slate-400 max-w-lg leading-relaxed">
                Connect your business across Instagram, WhatsApp, Messenger, and live website chat with intelligent conversational workflows.
              </p>
              <div className="flex gap-2 pt-2">
                <div className="h-8 w-28 bg-cyan-500/30 rounded-lg"></div>
                <div className="h-8 w-24 bg-white/10 rounded-lg"></div>
              </div>
            </div>

            {/* Mock Feature Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-6">
              {[1, 2, 3].map(n => (
                <div key={n} className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-2">
                  <div className="w-6 h-6 rounded-lg bg-white/10"></div>
                  <div className="h-3 w-16 bg-white/20 rounded"></div>
                  <div className="h-2 w-full bg-white/10 rounded"></div>
                </div>
              ))}
            </div>
          </div>

          {/* =========================================================================
              NURTURE TOOL RENDERING (SUPPORT WIDGET / POPUP / SLIDER / TAKEOVER)
             ========================================================================= */}

          {/* 1. SUPPORT WIDGET (Chat Bubble & Expandable Live Chat) */}
          {tool.type === 'support_widget' && (
            <div className={`absolute bottom-4 ${tool.position === 'bottom_left' ? 'left-4' : 'right-4'} z-30 flex flex-col items-end`}>
              
              {/* Expandable Chat Window */}
              {isOpen && !isMinimized && (
                <div className="w-80 sm:w-88 h-[440px] bg-slate-900/95 border border-white/15 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden mb-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
                  {/* Widget Header */}
                  <div 
                    style={{ background: `linear-gradient(135deg, ${tool.brandColor}25, #0f172a)` }}
                    className="p-3.5 border-b border-white/10 flex items-center justify-between text-white"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <img 
                          src={tool.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80"} 
                          alt={tool.botName}
                          className="w-8 h-8 rounded-full object-cover border border-white/20 shadow-sm"
                        />
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-slate-900"></span>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white leading-tight flex items-center gap-1.5">
                          {tool.botName}
                          <Sparkles className="w-3 h-3 text-cyan-400" />
                        </h4>
                        <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Online • Instant Replies
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                        title={soundEnabled ? "Mute notifications" : "Enable sound"}
                      >
                        {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                      </button>
                      <button 
                        onClick={() => setIsMinimized(true)}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => setIsOpen(false)}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Pre-chat Lead Capture (if required & not yet submitted) */}
                  {tool.requireEmailCapture && !leadCaptured && (
                    <div className="bg-slate-950/70 p-3 border-b border-white/5">
                      <form onSubmit={handleLeadSubmit} className="space-y-2">
                        <p className="text-[11px] text-slate-300 font-medium leading-tight">
                          👋 Introduce yourself for priority routing:
                        </p>
                        <div className="flex gap-1.5">
                          {tool.requireNameCapture && (
                            <input 
                              type="text" 
                              placeholder="Your Name"
                              value={leadName}
                              onChange={(e) => setLeadName(e.target.value)}
                              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                            />
                          )}
                          <input 
                            type="email" 
                            required
                            placeholder="Email address"
                            value={leadEmail}
                            onChange={(e) => setLeadEmail(e.target.value)}
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                          />
                          <button 
                            type="submit"
                            style={{ backgroundColor: tool.brandColor }}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-950 hover:brightness-110 transition-all cursor-pointer flex-shrink-0"
                          >
                            Save
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Messages Feed */}
                  <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs">
                    {messages.map((m, idx) => (
                      <div 
                        key={idx} 
                        className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                      >
                        <div 
                          style={m.sender === 'user' ? { backgroundColor: tool.brandColor } : {}}
                          className={`max-w-[85%] rounded-2xl px-3 py-2 leading-relaxed shadow-sm ${
                            m.sender === 'user' 
                              ? 'text-slate-950 font-medium rounded-br-none' 
                              : 'bg-slate-800 text-slate-100 border border-white/5 rounded-bl-none'
                          }`}
                        >
                          {m.text}
                        </div>
                        <span className="text-[9px] text-slate-500 mt-0.5 px-1">{m.time}</span>
                      </div>
                    ))}

                    {/* Typing Indicator */}
                    {isTyping && (
                      <div className="flex items-center gap-1 bg-slate-800 border border-white/5 rounded-full px-2.5 py-1 w-14">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.4s]"></span>
                      </div>
                    )}
                  </div>

                  {/* Quick Replies Chips */}
                  {tool.quickReplies && tool.quickReplies.length > 0 && (
                    <div className="px-3 py-1.5 border-t border-white/5 flex flex-wrap gap-1.5 bg-slate-950/40">
                      {tool.quickReplies.map((qr) => (
                        <button
                          key={qr.id}
                          onClick={() => handleSendMessage(qr.label)}
                          className="text-[10px] font-semibold bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400 text-cyan-300 px-2 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap"
                        >
                          {qr.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Message Input Box */}
                  <div className="p-2.5 border-t border-white/10 bg-slate-950/80 flex items-center gap-1.5">
                    <input 
                      type="text" 
                      placeholder="Write a reply..."
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                    <button 
                      onClick={() => handleSendMessage()}
                      disabled={!inputValue.trim()}
                      style={{ backgroundColor: tool.brandColor }}
                      className="p-1.5 rounded-xl text-slate-950 font-bold hover:brightness-110 transition-all disabled:opacity-40 cursor-pointer flex-shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Footer Branding */}
                  <div className="py-1 px-3 bg-slate-950 text-[9px] text-slate-500 text-center flex items-center justify-center gap-1 border-t border-white/5">
                    <span>Powered by</span>
                    <span className="text-cyan-400 font-bold">ChatMize Nurture™</span>
                  </div>
                </div>
              )}

              {/* Minimized Teaser Banner */}
              {isMinimized && (
                <div 
                  onClick={() => setIsMinimized(false)}
                  className="mb-3 bg-slate-900 border border-cyan-500/30 rounded-2xl p-3 shadow-xl flex items-center gap-3 cursor-pointer hover:border-cyan-400 transition-all animate-bounce"
                >
                  <img 
                    src={tool.avatarUrl} 
                    alt={tool.botName}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-white">{tool.botName}</p>
                    <p className="text-[11px] text-cyan-300">👋 Click to reopen conversation</p>
                  </div>
                </div>
              )}

              {/* Floating Launcher Button */}
              <button
                onClick={() => {
                  setIsOpen(!isOpen);
                  setIsMinimized(false);
                }}
                style={{ backgroundColor: tool.brandColor }}
                className="w-13 h-13 rounded-full shadow-xl shadow-cyan-500/20 flex items-center justify-center text-slate-950 hover:scale-105 active:scale-95 transition-all cursor-pointer relative group"
                title="Toggle Live Chat Support"
              >
                {isOpen && !isMinimized ? (
                  <X className="w-6 h-6 stroke-[2.5]" />
                ) : (
                  <MessageSquare className="w-6 h-6 stroke-[2.5]" />
                )}
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 border-2 border-slate-900 rounded-full"></span>
              </button>
            </div>
          )}

          {/* 2. POPUP MODAL (Exit-Intent / Time Delay Lightbox) */}
          {tool.type === 'popup_modal' && isOpen && (
            <div className="absolute inset-0 z-40 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="w-full max-w-md bg-slate-900 border border-white/20 rounded-3xl p-6 shadow-2xl relative space-y-4">
                {/* Close Button */}
                <button 
                  onClick={() => setIsOpen(false)}
                  className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Header with Avatar & Headline */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img 
                      src={tool.avatarUrl} 
                      alt={tool.botName}
                      className="w-12 h-12 rounded-2xl object-cover border border-cyan-500/30"
                    />
                    <span className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-cyan-500 text-slate-950">
                      <Zap className="w-2.5 h-2.5 fill-current" />
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                      {tool.triggerType === 'exit_intent' ? 'Exit-Intent Triggered' : 'Special Offer'}
                    </span>
                    <h3 className="text-base font-bold text-white mt-1 leading-snug">
                      {tool.headline}
                    </h3>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {tool.subheadline}
                </p>

                {/* Embedded Mini Bot / Chat Thread inside Modal */}
                <div className="bg-slate-950/80 rounded-2xl p-3 border border-white/5 space-y-2 max-h-48 overflow-y-auto text-xs">
                  {messages.map((m, idx) => (
                    <div key={idx} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`rounded-xl px-3 py-1.5 ${m.sender === 'user' ? 'bg-cyan-500 text-slate-950 font-medium' : 'bg-slate-800 text-slate-200'}`}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="text-[10px] text-cyan-400 italic">Bot is writing...</div>
                  )}
                </div>

                {/* Action CTA Buttons / Quick Replies */}
                <div className="space-y-2 pt-1">
                  {tool.quickReplies.map((qr) => (
                    <button
                      key={qr.id}
                      onClick={() => handleSendMessage(qr.label)}
                      style={{ borderColor: tool.brandColor }}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-white/5 hover:bg-cyan-500/20 border transition-all flex items-center justify-between cursor-pointer group"
                    >
                      <span>{qr.label}</span>
                      <Zap className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. CORNER SLIDER (Slide-in Drawer) */}
          {tool.type === 'slider' && isOpen && (
            <div className={`absolute bottom-4 ${tool.position === 'bottom_left' ? 'left-4' : 'right-4'} z-40 w-80 bg-slate-900/95 border border-cyan-500/30 rounded-2xl p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-right duration-300 space-y-3`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <img 
                    src={tool.avatarUrl} 
                    alt={tool.botName}
                    className="w-8 h-8 rounded-full object-cover border border-emerald-400"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-white">{tool.botName}</h4>
                    <span className="text-[10px] text-emerald-400 font-mono">Slide-In Active</span>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <h5 className="text-xs font-bold text-white leading-snug">{tool.headline}</h5>
                <p className="text-[11px] text-slate-400 mt-1">{tool.subheadline}</p>
              </div>

              <div className="space-y-1.5 pt-1">
                {tool.quickReplies.slice(0, 2).map((qr) => (
                  <button
                    key={qr.id}
                    onClick={() => handleSendMessage(qr.label)}
                    style={{ backgroundColor: tool.brandColor }}
                    className="w-full py-2 px-3 rounded-lg text-xs font-bold text-slate-950 hover:brightness-110 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <span>{qr.label}</span>
                    <Zap className="w-3 h-3" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. PAGE TAKEOVER (Fullscreen Overlay) */}
          {tool.type === 'page_takeover' && isOpen && (
            <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col p-6 sm:p-10 animate-in fade-in duration-300 overflow-y-auto">
              {/* Header with Exit Control */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold">
                    ⚡
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Fullscreen Takeover</span>
                    <p className="text-[10px] text-slate-400">Interactive High-Conversion Flow</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Close Overlay</span>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Split Layout: Pitch & Interactive Bot */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 items-center pt-6">
                <div className="space-y-4">
                  <span className="px-3 py-1 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 text-xs font-bold">
                    🚀 Special Launch Event
                  </span>
                  <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                    {tool.headline}
                  </h2>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {tool.subheadline}
                  </p>
                  <div className="space-y-2 pt-2">
                    {['✓ Direct Meta Graph Syncing', '✓ Zero-Delay Live Human Agent Escalation', '✓ Unlimited Webhook Automations'].map((pt, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-200">
                        <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>{pt}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Live Chatbot Terminal */}
                <div className="bg-slate-900 border border-white/15 rounded-3xl p-5 shadow-2xl space-y-4 flex flex-col h-[380px]">
                  <div className="flex items-center gap-3 border-b border-white/10 pb-3 flex-shrink-0">
                    <img 
                      src={tool.avatarUrl} 
                      alt={tool.botName}
                      className="w-10 h-10 rounded-full object-cover border border-pink-500/40"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-white">{tool.botName}</h4>
                      <p className="text-xs text-pink-400">Ready to chat &amp; answer questions</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2.5 text-xs">
                    {messages.map((m, idx) => (
                      <div key={idx} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`rounded-2xl px-3 py-2 ${m.sender === 'user' ? 'bg-pink-500 text-white font-medium' : 'bg-slate-800 text-slate-200'}`}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                    {isTyping && (
                      <div className="text-[11px] text-pink-400 italic">Concierge is replying...</div>
                    )}
                  </div>

                  {/* Quick replies inside takeover */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {tool.quickReplies.map((qr) => (
                      <button
                        key={qr.id}
                        onClick={() => handleSendMessage(qr.label)}
                        className="text-[11px] font-semibold bg-pink-500/15 border border-pink-500/30 hover:bg-pink-500/25 text-pink-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                      >
                        {qr.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

// Also export as ConvertMateSimulator for compatibility
export const ConvertMateSimulator = NurtureSimulator;
