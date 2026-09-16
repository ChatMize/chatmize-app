import React, { useState } from 'react';
import { X, Download, Copy, Check, ExternalLink, QrCode } from 'lucide-react';

interface QrCodeModalProps {
  url: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({
  url,
  title,
  subtitle,
  onClose
}) => {
  const [copied, setCopied] = useState(false);
  
  // High quality QR Code generated via SVG endpoint
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(url)}&color=00d2ff&bgcolor=0a0f1d&margin=2`;

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(url)}&color=000000&bgcolor=ffffff&margin=4`;
    link.download = `qrcode-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
    link.target = '_blank';
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl relative space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">{title}</h3>
              {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QR Code Canvas Frame */}
        <div className="flex flex-col items-center justify-center p-6 bg-slate-950/80 border border-white/10 rounded-2xl relative group">
          <div className="p-3 bg-[#0a0f1d] rounded-xl border border-cyan-500/30 shadow-lg shadow-cyan-500/10">
            <img 
              src={qrImageUrl} 
              alt="QR Code" 
              className="w-52 h-52 object-contain rounded-lg"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="text-[11px] text-slate-400 mt-3 font-mono">Scan with camera to open instantly</span>
        </div>

        {/* Target URL string */}
        <div className="p-3 rounded-xl bg-slate-950 border border-white/5 flex items-center justify-between gap-2">
          <span className="text-xs font-mono text-cyan-300 truncate">{url}</span>
          <button
            onClick={handleCopy}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
            title="Copy URL"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
          <button
            onClick={handleDownload}
            className="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Download PNG</span>
          </button>

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-cyan-500/20"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Test Open Link</span>
          </a>
        </div>
      </div>
    </div>
  );
};
