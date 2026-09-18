import React, { useEffect, useMemo, useState } from 'react';
import {
  QrCode,
  Download,
  Copy,
  Check,
  ExternalLink,
  Link2,
  Sparkles,
  Loader2,
  Printer,
  MonitorSmartphone
} from 'lucide-react';

/**
 * BUILDER C: QR Builder tab for the Growth suite.
 * Generates QR codes via the same api.qrserver.com approach as QrCodeModal
 * (no new dependency). Works standalone for any pasted URL, and can be
 * prefilled from a cloaked link row via the prefillUrl / prefillNonce props.
 */

type QrSize = 256 | 512 | 1000;
type QrEcc = 'L' | 'M' | 'Q' | 'H';
type QrStyle = 'brand' | 'print';

interface QrBuilderTabProps {
  prefillUrl?: string | null;
  prefillLabel?: string | null;
  prefillNonce?: number;
}

const SIZE_OPTIONS: Array<{ value: QrSize; label: string; hint: string }> = [
  { value: 256, label: '256px', hint: 'Web. Fast for screens.' },
  { value: 512, label: '512px', hint: 'Standard. Crisp on retina.' },
  { value: 1000, label: '1000px', hint: 'Print. Sharp for flyers and merch.' }
];

const ECC_OPTIONS: Array<{ value: QrEcc; label: string; hint: string }> = [
  { value: 'L', label: 'Low', hint: 'Smallest code, best for clean screens.' },
  { value: 'M', label: 'Medium', hint: 'Balanced recovery for most uses.' },
  { value: 'Q', label: 'Quartile', hint: 'Stronger recovery for print.' },
  { value: 'H', label: 'High', hint: 'Maximum recovery, survives damage.' }
];

const STYLE_PRESETS: Record<QrStyle, { color: string; bgcolor: string; label: string; hint: string }> = {
  brand: {
    color: '00d2ff',
    bgcolor: '0a0f1d',
    label: 'Brand Dark',
    hint: 'Cyan on deep navy. Matches the ChatMize look.'
  },
  print: {
    color: '000000',
    bgcolor: 'ffffff',
    label: 'Print Light',
    hint: 'Black on white. Best for print and packaging.'
  }
};

const buildQrUrl = (text: string, size: QrSize, ecc: QrEcc, style: QrStyle): string => {
  const preset = STYLE_PRESETS[style];
  return (
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}` +
    `&ecc=${ecc}&margin=4&format=png` +
    `&color=${preset.color}&bgcolor=${preset.bgcolor}` +
    `&data=${encodeURIComponent(text)}`
  );
};

const slugifyForFilename = (text: string): string => {
  try {
    const url = new URL(text.startsWith('http') ? text : `https://${text}`);
    const host = url.hostname.replace(/^www\./, '').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const path = url.pathname.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    const base = [host, path].filter(Boolean).join('-').slice(0, 60);
    return base || 'qr-code';
  } catch {
    return (
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'qr-code'
    );
  }
};

export const QrBuilderTab: React.FC<QrBuilderTabProps> = ({
  prefillUrl = null,
  prefillLabel = null,
  prefillNonce = 0
}) => {
  const [text, setText] = useState(prefillUrl || '');
  const [size, setSize] = useState<QrSize>(512);
  const [ecc, setEcc] = useState<QrEcc>('M');
  const [style, setStyle] = useState<QrStyle>('brand');
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(
    prefillNonce > 0 && prefillUrl ? prefillLabel || prefillUrl : null
  );

  // Prefill from a cloaked link row in the cloaker tab
  useEffect(() => {
    if (prefillNonce > 0 && prefillUrl) {
      setText(prefillUrl);
      setPrefilledFrom(prefillLabel || prefillUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillNonce]);

  const trimmed = text.trim();
  const qrImageUrl = useMemo(
    () => (trimmed ? buildQrUrl(trimmed, size, ecc, style) : ''),
    [trimmed, size, ecc, style]
  );

  const openHref = trimmed
    ? trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(trimmed);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    if (!trimmed || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(buildQrUrl(trimmed, size, ecc, style));
      if (!res.ok) throw new Error('QR download failed');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${slugifyForFilename(trimmed)}-${size}px.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Fallback: open the image in a new tab so the user can save it manually
      window.open(buildQrUrl(trimmed, size, ecc, style), '_blank', 'noopener');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-200">

      {/* Builder Form (7 cols) */}
      <div className="lg:col-span-7 bg-slate-900/90 border border-white/10 rounded-2xl p-6 space-y-6 shadow-xl">
        <div className="space-y-1 pb-4 border-b border-white/10">
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 text-xs font-semibold">
            <QrCode className="w-3.5 h-3.5 text-violet-400" />
            <span>Scannable QR Codes</span>
          </div>
          <h2 className="text-lg font-bold text-white">QR Code Builder</h2>
          <p className="text-xs text-slate-400">
            Paste any link or text to generate a downloadable QR code. Works great with your{' '}
            <code className="text-violet-300 font-mono">send.chat</code> cloaked links on flyers, packaging, and store signage.
          </p>
          {prefilledFrom && (
            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-[11px] font-semibold">
              <Sparkles className="w-3 h-3" />
              <span className="truncate max-w-[320px]">Loaded from: {prefilledFrom}</span>
            </div>
          )}
        </div>

        {/* URL / Text input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300">Link or Text to Encode</label>
          <div className="flex items-center px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus-within:border-violet-500/60 transition-colors">
            <Link2 className="w-4 h-4 text-slate-500 mr-2 flex-shrink-0" />
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="https://send.chat/your-workspace/your-offer"
              className="flex-1 bg-transparent focus:outline-none text-violet-300 font-mono font-semibold placeholder:text-slate-600"
            />
          </div>
          <span className="text-[11px] text-slate-500">
            Paste any URL, or plain text like a coupon code or WiFi details.
          </span>
        </div>

        {/* Size options */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300">Image Size</label>
          <div className="grid grid-cols-3 gap-2">
            {SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSize(opt.value)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  size === opt.value
                    ? 'bg-violet-500/15 border-violet-500/50 shadow-sm'
                    : 'bg-slate-950 border-white/10 hover:border-white/25'
                }`}
              >
                <div className={`text-sm font-bold ${size === opt.value ? 'text-violet-300' : 'text-white'}`}>
                  {opt.label}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">{opt.hint}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Error correction level */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300">Error Correction</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ECC_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setEcc(opt.value)}
                title={opt.hint}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  ecc === opt.value
                    ? 'bg-violet-500/15 border-violet-500/50 shadow-sm'
                    : 'bg-slate-950 border-white/10 hover:border-white/25'
                }`}
              >
                <div className={`text-xs font-bold ${ecc === opt.value ? 'text-violet-300' : 'text-white'}`}>
                  {opt.label}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{opt.hint}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Style presets */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300">Code Style</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(STYLE_PRESETS) as QrStyle[]).map((key) => {
              const preset = STYLE_PRESETS[key];
              const isActive = style === key;
              return (
                <button
                  key={key}
                  onClick={() => setStyle(key)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                    isActive
                      ? 'bg-violet-500/15 border-violet-500/50 shadow-sm'
                      : 'bg-slate-950 border-white/10 hover:border-white/25'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg border flex-shrink-0 flex items-center justify-center ${
                      key === 'brand'
                        ? 'bg-[#0a0f1d] border-cyan-500/40 text-cyan-400'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    {key === 'brand' ? <MonitorSmartphone className="w-4 h-4" /> : <Printer className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${isActive ? 'text-violet-300' : 'text-white'}`}>
                      {preset.label}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{preset.hint}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Preview + actions (5 cols) */}
      <div className="lg:col-span-5 space-y-4">
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <QrCode className="w-4 h-4 text-violet-400" />
            <span>Live Preview</span>
          </h3>

          <div className="flex flex-col items-center justify-center p-6 bg-slate-950/80 border border-white/10 rounded-2xl">
            {qrImageUrl ? (
              <>
                <div className="p-3 bg-[#0a0f1d] rounded-xl border border-violet-500/30 shadow-lg shadow-violet-500/10">
                  <img
                    key={qrImageUrl}
                    src={qrImageUrl}
                    alt="QR Code preview"
                    className="w-56 h-56 object-contain rounded-lg"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-3">Scan with camera to open instantly</span>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-white/15 flex items-center justify-center text-slate-600 mb-3">
                  <QrCode className="w-8 h-8" />
                </div>
                <p className="text-xs text-slate-500 max-w-[220px]">
                  Paste any link on the left and your QR code appears here.
                </p>
              </div>
            )}
          </div>

          {trimmed && (
            <div className="p-3 rounded-xl bg-slate-950 border border-white/5 flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-violet-300 truncate">{trimmed}</span>
              <button
                onClick={handleCopy}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
                title="Copy link"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleDownload}
              disabled={!trimmed || downloading}
              className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-violet-500/20"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{downloading ? 'Preparing...' : `Download PNG (${size}px)`}</span>
            </button>

            <a
              href={openHref || undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { if (!openHref) e.preventDefault(); }}
              className={`py-2.5 px-3 rounded-xl bg-white/5 text-white border border-white/10 text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                openHref ? 'hover:bg-white/10 cursor-pointer' : 'opacity-40 cursor-not-allowed'
              }`}
            >
              <ExternalLink className="w-4 h-4 text-violet-400" />
              <span>Test Open Link</span>
            </a>
          </div>
        </div>

        {/* Tips card */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span>QR Tips</span>
          </h3>
          <ul className="text-xs text-slate-300 leading-relaxed space-y-2 list-disc pl-4 marker:text-violet-400">
            <li>Use <code className="text-violet-300 font-mono">send.chat</code> cloaked links so scans are tracked in your click stats.</li>
            <li>Choose <span className="text-white font-semibold">1000px</span> and <span className="text-white font-semibold">High</span> error correction for anything printed.</li>
            <li>Leave white space around the code on flyers so phones scan it fast.</li>
            <li>Test every printed batch with two different phones before you print big.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
