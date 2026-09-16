import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Code, 
  Globe, 
  ExternalLink, 
  Layers, 
  FileCode,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { NurtureTool } from '../../types/nurture';

export interface NurtureEmbedModalProps {
  tool: NurtureTool;
  isOpen: boolean;
  onClose: () => void;
}

export const NurtureEmbedModal: React.FC<NurtureEmbedModalProps> = ({
  tool,
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'script' | 'link' | 'iframe' | 'react' | 'cms'>('script');
  const [copied, setCopied] = useState<string | null>(null);

  if (!isOpen) return null;

  const scriptEmbedCode = `<!-- ChatMize Nurture™ Live Support & Lead Tool -->
<script 
  src="https://cdn.chatmize.io/nurture/v1.js" 
  data-nurture-widget="${tool.id}" 
  data-theme="${tool.theme}"
  data-color="${tool.brandColor}"
  data-position="${tool.position}"
  async>
</script>`;

  const directUrl = `https://chatmize.io/n/${tool.id}`;

  const iframeCode = `<iframe 
  src="https://chatmize.io/n/${tool.id}?embed=true" 
  width="100%" 
  height="600" 
  style="border:none;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.15);"
  allow="microphone; camera">
</iframe>`;

  const reactSnippet = `import { useEffect } from 'react';

export function ChatMizeNurtureWidget() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.chatmize.io/nurture/v1.js';
    script.setAttribute('data-nurture-widget', '${tool.id}');
    script.setAttribute('data-color', '${tool.brandColor}');
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return null;
}`;

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-white/15 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Embed &amp; Install "{tool.name}"
                <Sparkles className="w-4 h-4 text-cyan-400" />
              </h3>
              <p className="text-xs text-slate-400">
                Deploy this Nurture Tool on any Shopify, Webflow, WordPress, or custom site in under 60 seconds.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 border-b border-white/10 pb-2 overflow-x-auto scrollbar-none text-xs">
          {[
            { id: 'script', label: 'HTML Script (Recommended)', icon: Code },
            { id: 'link', label: 'Direct Share Link', icon: Globe },
            { id: 'iframe', label: 'Inline iFrame', icon: Layers },
            { id: 'react', label: 'React / Next.js', icon: FileCode },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  isActive 
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {activeTab === 'script' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Paste this snippet right before the closing <code className="text-cyan-300 font-mono">&lt;/body&gt;</code> tag:</span>
                <button
                  onClick={() => copyToClipboard(scriptEmbedCode, 'script')}
                  className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                >
                  {copied === 'script' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied === 'script' ? 'Copied to clipboard!' : 'Copy Snippet'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 border border-white/10 text-cyan-300 text-xs font-mono overflow-x-auto selection:bg-cyan-500/30">
                {scriptEmbedCode}
              </pre>
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span>SSL Encrypted &amp; asynchronous loader: zero impact on Google PageSpeed or Core Web Vitals.</span>
              </div>
            </div>
          )}

          {activeTab === 'link' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Direct full-page link for social bio, emails, or direct messages:</span>
                <button
                  onClick={() => copyToClipboard(directUrl, 'link')}
                  className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                >
                  {copied === 'link' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied === 'link' ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={directUrl}
                  className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none"
                />
                <a 
                  href={directUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}

          {activeTab === 'iframe' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Embed directly inside a specific container or blog post:</span>
                <button
                  onClick={() => copyToClipboard(iframeCode, 'iframe')}
                  className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                >
                  {copied === 'iframe' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied === 'iframe' ? 'Copied!' : 'Copy iFrame'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 border border-white/10 text-cyan-300 text-xs font-mono overflow-x-auto">
                {iframeCode}
              </pre>
            </div>
          )}

          {activeTab === 'react' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>React hook / component wrapper:</span>
                <button
                  onClick={() => copyToClipboard(reactSnippet, 'react')}
                  className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                >
                  {copied === 'react' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied === 'react' ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 border border-white/10 text-cyan-300 text-xs font-mono overflow-x-auto">
                {reactSnippet}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 flex items-center justify-between border-t border-white/10 text-xs">
          <span className="text-slate-400">
            Assigned Level: <strong className="text-cyan-300 capitalize">{tool.accessLevel}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-200 rounded-xl font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};

export const ConvertMateEmbedModal = NurtureEmbedModal;
