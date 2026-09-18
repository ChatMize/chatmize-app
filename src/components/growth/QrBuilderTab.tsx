import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCodeStyling, {
  DotType,
  CornerSquareType,
  CornerDotType,
  DrawType,
  ErrorCorrectionLevel,
  GradientType,
  Options,
} from 'qr-code-styling';
import {
  QrCode,
  Download,
  Copy,
  Check,
  ExternalLink,
  Link2,
  Sparkles,
  Loader2,
  ImagePlus,
  Trash2,
  Type,
  Mail,
  Phone,
  MessageSquareText,
  Wifi,
  Contact,
  Palette,
  Shapes,
  Frame,
  BadgeCheck,
} from 'lucide-react';

/**
 * QR Builder tab (styled edition): qrcode-monkey-grade QR codes rendered
 * locally with qr-code-styling. Content types, dot/eye styling, gradients,
 * logo embed, PNG (512/1024/2048) + SVG export. Prefillable from a cloaked
 * link row via the prefillUrl / prefillNonce props.
 */

type ContentType = 'link' | 'text' | 'email' | 'phone' | 'sms' | 'wifi' | 'vcard';

interface QrBuilderTabProps {
  prefillUrl?: string | null;
  prefillLabel?: string | null;
  prefillNonce?: number;
}

const PREVIEW_SIZE = 640;
const CHATMIZE_LOGO = '/chatmize-head.png';

const CONTENT_TABS: Array<{ value: ContentType; label: string; icon: React.ReactNode }> = [
  { value: 'link', label: 'Link', icon: <Link2 className="w-4 h-4" /> },
  { value: 'text', label: 'Text', icon: <Type className="w-4 h-4" /> },
  { value: 'email', label: 'Email', icon: <Mail className="w-4 h-4" /> },
  { value: 'phone', label: 'Phone', icon: <Phone className="w-4 h-4" /> },
  { value: 'sms', label: 'SMS', icon: <MessageSquareText className="w-4 h-4" /> },
  { value: 'wifi', label: 'WiFi', icon: <Wifi className="w-4 h-4" /> },
  { value: 'vcard', label: 'vCard', icon: <Contact className="w-4 h-4" /> },
];

const DOT_STYLES: Array<{ value: DotType; label: string; swatch: React.CSSProperties }> = [
  { value: 'square', label: 'Square', swatch: { borderRadius: 2 } },
  { value: 'rounded', label: 'Rounded', swatch: { borderRadius: '35%' } },
  { value: 'dots', label: 'Dots', swatch: { borderRadius: '50%' } },
  { value: 'classy', label: 'Classy', swatch: { borderRadius: '35% 8% 35% 8%' } },
  { value: 'classy-rounded', label: 'Classy+', swatch: { borderRadius: '50% 12% 50% 12%' } },
  { value: 'extra-rounded', label: 'Soft', swatch: { borderRadius: '45% 45% 45% 12%' } },
];

const CORNER_SQUARE_STYLES: Array<{ value: CornerSquareType; label: string }> = [
  { value: 'square', label: 'Square' },
  { value: 'extra-rounded', label: 'Rounded' },
  { value: 'dot', label: 'Dot' },
];

const CORNER_DOT_STYLES: Array<{ value: CornerDotType; label: string }> = [
  { value: 'square', label: 'Square' },
  { value: 'dot', label: 'Dot' },
];

const FG_SWATCHES = ['#0b1220', '#000000', '#7c3aed', '#0891b2', '#db2777', '#16a34a', '#ea580c'];
const BG_SWATCHES = ['#ffffff', '#0a0f1d', '#f8fafc', '#fef3c7', '#ecfdf5', '#f5f3ff'];

const ECC_OPTIONS: Array<{ value: 'M' | 'Q' | 'H'; label: string; hint: string }> = [
  { value: 'M', label: 'Medium', hint: 'Smaller code. Fine without a logo.' },
  { value: 'Q', label: 'Quartile', hint: 'Recommended with a logo.' },
  { value: 'H', label: 'High', hint: 'Maximum recovery for print.' },
];

interface StylePreset {
  name: string;
  hint: string;
  dots: DotType;
  cornerSquare: CornerSquareType;
  cornerDot: CornerDotType;
  fg: string;
  bg: string;
  gradient: boolean;
  gradientColor2: string;
  logo: boolean;
}

const STYLE_PRESETS: StylePreset[] = [
  {
    name: 'Classic', hint: 'Black on white. Scans everywhere.',
    dots: 'square', cornerSquare: 'square', cornerDot: 'square',
    fg: '#000000', bg: '#ffffff', gradient: false, gradientColor2: '#7c3aed', logo: false,
  },
  {
    name: 'ChatMize', hint: 'Rounded dots with the ChatMize logo.',
    dots: 'rounded', cornerSquare: 'extra-rounded', cornerDot: 'dot',
    fg: '#0b1220', bg: '#ffffff', gradient: false, gradientColor2: '#7c3aed', logo: true,
  },
  {
    name: 'Neon Night', hint: 'Cyan on deep navy. Made for screens.',
    dots: 'dots', cornerSquare: 'extra-rounded', cornerDot: 'dot',
    fg: '#00e5ff', bg: '#0a0f1d', gradient: false, gradientColor2: '#7c3aed', logo: true,
  },
  {
    name: 'Sunset', hint: 'Warm gradient fade.',
    dots: 'extra-rounded', cornerSquare: 'extra-rounded', cornerDot: 'dot',
    fg: '#f59e0b', bg: '#ffffff', gradient: true, gradientColor2: '#ec4899', logo: true,
  },
  {
    name: 'Royal', hint: 'Violet gradient on light.',
    dots: 'classy-rounded', cornerSquare: 'extra-rounded', cornerDot: 'dot',
    fg: '#7c3aed', bg: '#ffffff', gradient: true, gradientColor2: '#06b6d4', logo: true,
  },
];

const slugifyForFilename = (text: string): string => {
  try {
    const url = new URL(text.startsWith('http') ? text : `https://${text}`);
    const host = url.hostname.replace(/^www\./, '').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const path = url.pathname.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    const base = [host, path].filter(Boolean).join('-').slice(0, 60);
    return base || 'qr-code';
  } catch {
    return (
      text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'qr-code'
    );
  }
};

const escapeWifi = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/:/g, '\\:');

const inputCls =
  'w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-violet-500/60 transition-colors placeholder:text-slate-600';
const labelCls = 'text-xs font-bold text-slate-300';
const sectionTitleCls = 'text-xs font-bold text-slate-300 flex items-center gap-1.5';

export const QrBuilderTab: React.FC<QrBuilderTabProps> = ({
  prefillUrl = null,
  prefillLabel = null,
  prefillNonce = 0,
}) => {
  // ---- content state ----
  const [contentType, setContentType] = useState<ContentType>('link');
  const [linkUrl, setLinkUrl] = useState(prefillUrl || '');
  const [plainText, setPlainText] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [phoneNum, setPhoneNum] = useState('');
  const [smsNum, setSmsNum] = useState('');
  const [smsMsg, setSmsMsg] = useState('');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPass, setWifiPass] = useState('');
  const [wifiEnc, setWifiEnc] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
  const [wifiHidden, setWifiHidden] = useState(false);
  const [vcFirst, setVcFirst] = useState('');
  const [vcLast, setVcLast] = useState('');
  const [vcOrg, setVcOrg] = useState('');
  const [vcPhone, setVcPhone] = useState('');
  const [vcEmail, setVcEmail] = useState('');
  const [vcUrl, setVcUrl] = useState('');

  // ---- style state ----
  const [dotsType, setDotsType] = useState<DotType>('rounded');
  const [cornerSquareType, setCornerSquareType] = useState<CornerSquareType>('extra-rounded');
  const [cornerDotType, setCornerDotType] = useState<CornerDotType>('dot');
  const [fgColor, setFgColor] = useState('#0b1220');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [transparentBg, setTransparentBg] = useState(false);
  const [gradientOn, setGradientOn] = useState(false);
  const [gradientType, setGradientType] = useState<GradientType>('linear');
  const [gradientColor2, setGradientColor2] = useState('#7c3aed');
  const [gradientRotation, setGradientRotation] = useState(0);
  const [logoOn, setLogoOn] = useState(true);
  const [logoSrc, setLogoSrc] = useState<string>(CHATMIZE_LOGO);
  const [logoIsDefault, setLogoIsDefault] = useState(true);
  const [logoSize, setLogoSize] = useState(0.4);
  const [logoMargin, setLogoMargin] = useState(8);
  const [ecc, setEcc] = useState<'M' | 'Q' | 'H'>('Q');

  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(
    prefillNonce > 0 && prefillUrl ? prefillLabel || prefillUrl : null
  );

  const previewRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prefill from a cloaked link row in the cloaker tab
  useEffect(() => {
    if (prefillNonce > 0 && prefillUrl) {
      setContentType('link');
      setLinkUrl(prefillUrl);
      setPrefilledFrom(prefillLabel || prefillUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillNonce]);

  // ---- payload builders ----
  const payload = useMemo(() => {
    switch (contentType) {
      case 'link': {
        const t = linkUrl.trim();
        if (!t) return '';
        return t.startsWith('http://') || t.startsWith('https://') ? t : `https://${t}`;
      }
      case 'text':
        return plainText.trim();
      case 'email': {
        const to = emailTo.trim();
        if (!to) return '';
        const params = new URLSearchParams();
        if (emailSubject.trim()) params.set('subject', emailSubject.trim());
        if (emailBody.trim()) params.set('body', emailBody.trim());
        const qs = params.toString();
        return `mailto:${to}${qs ? `?${qs}` : ''}`;
      }
      case 'phone':
        return phoneNum.trim() ? `tel:${phoneNum.trim()}` : '';
      case 'sms':
        return smsNum.trim() ? `SMSTO:${smsNum.trim()}:${smsMsg.trim()}` : '';
      case 'wifi': {
        if (!wifiSsid.trim()) return '';
        const enc = wifiEnc === 'nopass' ? 'nopass' : wifiEnc;
        return `WIFI:T:${enc};S:${escapeWifi(wifiSsid.trim())};P:${escapeWifi(wifiPass)};H:${wifiHidden ? 'true' : 'false'};;`;
      }
      case 'vcard': {
        if (!vcFirst.trim() && !vcLast.trim() && !vcPhone.trim() && !vcEmail.trim()) return '';
        const lines = [
          'BEGIN:VCARD',
          'VERSION:3.0',
          `N:${vcLast.trim()};${vcFirst.trim()};;;`,
          `FN:${[vcFirst.trim(), vcLast.trim()].filter(Boolean).join(' ')}`,
        ];
        if (vcOrg.trim()) lines.push(`ORG:${vcOrg.trim()}`);
        if (vcPhone.trim()) lines.push(`TEL;TYPE=CELL:${vcPhone.trim()}`);
        if (vcEmail.trim()) lines.push(`EMAIL:${vcEmail.trim()}`);
        if (vcUrl.trim()) lines.push(`URL:${vcUrl.trim()}`);
        lines.push('END:VCARD');
        return lines.join('\n');
      }
    }
  }, [contentType, linkUrl, plainText, emailTo, emailSubject, emailBody, phoneNum, smsNum, smsMsg, wifiSsid, wifiPass, wifiEnc, wifiHidden, vcFirst, vcLast, vcOrg, vcPhone, vcEmail, vcUrl]);

  // Scanability guard: a logo covering the center needs enough error correction.
  const effectiveEcc: ErrorCorrectionLevel = logoOn && ecc === 'M' ? 'Q' : ecc;

  const qrOptions: Options = useMemo(() => {
    const gradient = gradientOn
      ? {
          type: gradientType,
          rotation: (gradientRotation * Math.PI) / 180,
          colorStops: [
            { offset: 0, color: fgColor },
            { offset: 1, color: gradientColor2 },
          ],
        }
      : undefined;
    return {
      width: PREVIEW_SIZE,
      height: PREVIEW_SIZE,
      type: 'canvas' as DrawType,
      data: payload,
      image: logoOn && logoSrc ? logoSrc : undefined,
      margin: 16,
      qrOptions: {
        typeNumber: 0,
        mode: 'Byte',
        errorCorrectionLevel: effectiveEcc,
      },
      imageOptions: {
        hideBackgroundDots: true,
        imageSize: logoSize,
        margin: logoMargin,
        crossOrigin: 'anonymous',
      },
      dotsOptions: {
        color: fgColor,
        type: dotsType,
        ...(gradient ? { gradient } : {}),
      },
      backgroundOptions: {
        color: transparentBg ? 'rgba(0,0,0,0)' : bgColor,
      },
      cornersSquareOptions: {
        color: fgColor,
        type: cornerSquareType,
        ...(gradient ? { gradient } : {}),
      },
      cornersDotOptions: {
        color: fgColor,
        type: cornerDotType,
        ...(gradient ? { gradient } : {}),
      },
    };
  }, [payload, logoOn, logoSrc, logoSize, logoMargin, effectiveEcc, fgColor, bgColor, transparentBg, dotsType, cornerSquareType, cornerDotType, gradientOn, gradientType, gradientColor2, gradientRotation]);

  // Live preview: create once, update on every option change.
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    if (!payload) {
      el.innerHTML = '';
      qrRef.current = null;
      return;
    }
    if (!qrRef.current) {
      qrRef.current = new QRCodeStyling(qrOptions);
      qrRef.current.append(el);
    } else {
      qrRef.current.update(qrOptions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrOptions]);

  const applyPreset = (p: StylePreset) => {
    setDotsType(p.dots);
    setCornerSquareType(p.cornerSquare);
    setCornerDotType(p.cornerDot);
    setFgColor(p.fg);
    setBgColor(p.bg);
    setTransparentBg(false);
    setGradientOn(p.gradient);
    setGradientColor2(p.gradientColor2);
    if (p.logo) {
      setLogoOn(true);
      setLogoSrc(CHATMIZE_LOGO);
      setLogoIsDefault(true);
    } else {
      setLogoOn(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setLogoSrc(reader.result as string);
      setLogoIsDefault(false);
      setLogoOn(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCopy = () => {
    if (!payload) return;
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async (size: number, ext: 'png' | 'svg') => {
    if (!qrRef.current || !payload || downloading) return;
    const key = `${ext}-${size}`;
    setDownloading(key);
    try {
      qrRef.current.update({ width: size, height: size });
      await qrRef.current.download({
        name: `${slugifyForFilename(payload)}-${size}px`,
        extension: ext,
      });
    } catch {
      // fall through; preview stays usable
    } finally {
      qrRef.current.update({ width: PREVIEW_SIZE, height: PREVIEW_SIZE });
      setDownloading(null);
    }
  };

  const openHref =
    contentType === 'link' && payload ? payload : '';

  const renderContentFields = () => {
    switch (contentType) {
      case 'link':
        return (
          <div className="space-y-1.5">
            <label className={labelCls}>Destination URL</label>
            <div className="flex items-center px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus-within:border-violet-500/60 transition-colors">
              <Link2 className="w-4 h-4 text-slate-500 mr-2 flex-shrink-0" />
              <input
                data-no-emoji
                type="text"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://send.chat/your-workspace/your-offer"
                className="flex-1 bg-transparent focus:outline-none text-violet-300 font-mono font-semibold placeholder:text-slate-600"
              />
            </div>
            <span className="text-[11px] text-slate-500">Tip: use a send.chat cloaked link so scans are tracked.</span>
          </div>
        );
      case 'text':
        return (
          <div className="space-y-1.5">
            <label className={labelCls}>Text</label>
            <textarea
              value={plainText}
              onChange={(e) => setPlainText(e.target.value)}
              placeholder="Coupon code, message, anything plain text..."
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>
        );
      case 'email':
        return (
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Email address</label>
              <input data-no-emoji type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="hello@business.com" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Subject (optional)</label>
              <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Subject line" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Message (optional)</label>
              <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} placeholder="Prefilled message body" rows={2} className={`${inputCls} resize-none`} />
            </div>
          </div>
        );
      case 'phone':
        return (
          <div className="space-y-1.5">
            <label className={labelCls}>Phone number</label>
            <input data-no-emoji type="tel" value={phoneNum} onChange={(e) => setPhoneNum(e.target.value)} placeholder="+1 555 123 4567" className={inputCls} />
            <span className="text-[11px] text-slate-500">Scanning starts a call to this number.</span>
          </div>
        );
      case 'sms':
        return (
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Phone number</label>
              <input data-no-emoji type="tel" value={smsNum} onChange={(e) => setSmsNum(e.target.value)} placeholder="+1 555 123 4567" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Prefilled message (optional)</label>
              <textarea value={smsMsg} onChange={(e) => setSmsMsg(e.target.value)} placeholder="Hi! I scanned your code..." rows={2} className={`${inputCls} resize-none`} />
            </div>
          </div>
        );
      case 'wifi':
        return (
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Network name (SSID)</label>
              <input data-no-emoji type="text" value={wifiSsid} onChange={(e) => setWifiSsid(e.target.value)} placeholder="CoffeeShop_WiFi" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelCls}>Password</label>
                <input data-no-emoji type="text" value={wifiPass} onChange={(e) => setWifiPass(e.target.value)} placeholder="password" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Security</label>
                <select value={wifiEnc} onChange={(e) => setWifiEnc(e.target.value as 'WPA' | 'WEP' | 'nopass')} className={`${inputCls} cursor-pointer`}>
                  <option value="WPA">WPA / WPA2</option>
                  <option value="WEP">WEP</option>
                  <option value="nopass">None (open)</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input type="checkbox" checked={wifiHidden} onChange={(e) => setWifiHidden(e.target.checked)} className="w-4 h-4 accent-violet-500 cursor-pointer" />
              Hidden network
            </label>
          </div>
        );
      case 'vcard':
        return (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>First name</label>
              <input type="text" value={vcFirst} onChange={(e) => setVcFirst(e.target.value)} placeholder="Karl" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Last name</label>
              <input type="text" value={vcLast} onChange={(e) => setVcLast(e.target.value)} placeholder="Schuckert" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Company</label>
              <input type="text" value={vcOrg} onChange={(e) => setVcOrg(e.target.value)} placeholder="ChatMize" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Phone</label>
              <input data-no-emoji type="tel" value={vcPhone} onChange={(e) => setVcPhone(e.target.value)} placeholder="+1 555 123 4567" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Email</label>
              <input data-no-emoji type="email" value={vcEmail} onChange={(e) => setVcEmail(e.target.value)} placeholder="hello@business.com" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Website</label>
              <input data-no-emoji type="text" value={vcUrl} onChange={(e) => setVcUrl(e.target.value)} placeholder="https://..." className={inputCls} />
            </div>
          </div>
        );
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
            Design a branded QR code like the pros. Pick what it encodes, style it, drop in a logo,
            then download it for print or screen.
          </p>
          {prefilledFrom && (
            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-[11px] font-semibold">
              <Sparkles className="w-3 h-3" />
              <span className="truncate max-w-[320px]">Loaded from: {prefilledFrom}</span>
            </div>
          )}
        </div>

        {/* Content type tabs */}
        <div className="space-y-1.5">
          <label className={labelCls}>What should it do when scanned?</label>
          <div className="flex flex-wrap gap-2">
            {CONTENT_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setContentType(t.value)}
                className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  contentType === t.value
                    ? 'bg-violet-500/15 border-violet-500/50 text-violet-300 shadow-sm'
                    : 'bg-slate-950 border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {renderContentFields()}

        {/* One-tap style presets */}
        <div className="space-y-1.5">
          <label className={sectionTitleCls}><Palette className="w-3.5 h-3.5 text-violet-400" /> Quick Styles</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {STYLE_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset(p)}
                title={p.hint}
                className="p-2.5 rounded-xl border bg-slate-950 border-white/10 hover:border-violet-500/50 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-1 mb-1.5">
                  <span
                    className="w-5 h-5 rounded-md border border-white/20"
                    style={{
                      background: p.gradient
                        ? `linear-gradient(135deg, ${p.fg}, ${p.gradientColor2})`
                        : p.fg,
                    }}
                  />
                  {p.logo && <BadgeCheck className="w-3.5 h-3.5 text-violet-400" />}
                </div>
                <div className="text-xs font-bold text-white group-hover:text-violet-300">{p.name}</div>
                <div className="text-[10px] text-slate-500 leading-tight mt-0.5">{p.hint}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Dot style */}
        <div className="space-y-1.5">
          <label className={sectionTitleCls}><Shapes className="w-3.5 h-3.5 text-violet-400" /> Dot Style</label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {DOT_STYLES.map((d) => (
              <button
                key={d.value}
                onClick={() => setDotsType(d.value)}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  dotsType === d.value
                    ? 'bg-violet-500/15 border-violet-500/50 shadow-sm'
                    : 'bg-slate-950 border-white/10 hover:border-white/25'
                }`}
              >
                <span className="w-6 h-6" style={{ background: fgColor, ...d.swatch }} />
                <span className={`text-[11px] font-bold ${dotsType === d.value ? 'text-violet-300' : 'text-slate-300'}`}>{d.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Eyes */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={sectionTitleCls}><Frame className="w-3.5 h-3.5 text-violet-400" /> Eye Frame</label>
            <div className="grid grid-cols-3 gap-2">
              {CORNER_SQUARE_STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setCornerSquareType(s.value)}
                  className={`p-2 rounded-xl border transition-all cursor-pointer ${
                    cornerSquareType === s.value
                      ? 'bg-violet-500/15 border-violet-500/50'
                      : 'bg-slate-950 border-white/10 hover:border-white/25'
                  }`}
                >
                  <div
                    className="w-7 h-7 mx-auto border-[5px]"
                    style={{
                      borderColor: fgColor,
                      borderRadius: s.value === 'square' ? 2 : s.value === 'dot' ? '50%' : '35%',
                    }}
                  />
                  <div className={`text-[10px] font-bold text-center mt-1 ${cornerSquareType === s.value ? 'text-violet-300' : 'text-slate-400'}`}>{s.label}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={sectionTitleCls}><Frame className="w-3.5 h-3.5 text-violet-400" /> Eye Center</label>
            <div className="grid grid-cols-2 gap-2">
              {CORNER_DOT_STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setCornerDotType(s.value)}
                  className={`p-2 rounded-xl border transition-all cursor-pointer ${
                    cornerDotType === s.value
                      ? 'bg-violet-500/15 border-violet-500/50'
                      : 'bg-slate-950 border-white/10 hover:border-white/25'
                  }`}
                >
                  <div
                    className="w-5 h-5 mx-auto"
                    style={{ background: fgColor, borderRadius: s.value === 'square' ? 2 : '50%' }}
                  />
                  <div className={`text-[10px] font-bold text-center mt-1 ${cornerDotType === s.value ? 'text-violet-300' : 'text-slate-400'}`}>{s.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Colors */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className={labelCls}>Code color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {FG_SWATCHES.map((c) => (
                <button
                  key={c}
                  onClick={() => setFgColor(c)}
                  title={c}
                  className={`w-8 h-8 rounded-lg border-2 transition-all cursor-pointer ${fgColor === c ? 'border-violet-400 scale-110' : 'border-white/15 hover:scale-105'}`}
                  style={{ background: c }}
                />
              ))}
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                <input
                  type="color"
                  value={fgColor}
                  onChange={(e) => setFgColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-white/15 p-0.5"
                />
                Custom
              </label>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Background</label>
            <div className="flex items-center gap-2 flex-wrap">
              {BG_SWATCHES.map((c) => (
                <button
                  key={c}
                  onClick={() => { setBgColor(c); setTransparentBg(false); }}
                  title={c}
                  className={`w-8 h-8 rounded-lg border-2 transition-all cursor-pointer ${!transparentBg && bgColor === c ? 'border-violet-400 scale-110' : 'border-white/15 hover:scale-105'}`}
                  style={{ background: c }}
                />
              ))}
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => { setBgColor(e.target.value); setTransparentBg(false); }}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-white/15 p-0.5"
                />
                Custom
              </label>
              <button
                onClick={() => setTransparentBg(!transparentBg)}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                  transparentBg ? 'bg-violet-500/15 border-violet-500/50 text-violet-300' : 'bg-slate-950 border-white/10 text-slate-400 hover:border-white/25'
                }`}
              >
                Transparent
              </button>
            </div>
          </div>

          {/* Gradient */}
          <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer select-none">
              <span className="text-xs font-bold text-slate-300">Color gradient fade</span>
              <button
                onClick={() => setGradientOn(!gradientOn)}
                className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer ${gradientOn ? 'bg-violet-500' : 'bg-slate-700'}`}
                style={{ height: 22 }}
              >
                <span
                  className="absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white transition-all"
                  style={{ left: gradientOn ? 20 : 2 }}
                />
              </button>
            </label>
            {gradientOn && (
              <div className="grid grid-cols-2 gap-3 items-end">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400">Fade to</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={gradientColor2}
                      onChange={(e) => setGradientColor2(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-white/15 p-0.5"
                    />
                    <span className="text-[11px] font-mono text-slate-400">{gradientColor2}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400">Style</label>
                  <div className="flex gap-2">
                    {(['linear', 'radial'] as GradientType[]).map((g) => (
                      <button
                        key={g}
                        onClick={() => setGradientType(g)}
                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold capitalize transition-all cursor-pointer ${
                          gradientType === g ? 'bg-violet-500/15 border-violet-500/50 text-violet-300' : 'bg-slate-900 border-white/10 text-slate-400 hover:border-white/25'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                {gradientType === 'linear' && (
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[11px] font-bold text-slate-400">Direction: {gradientRotation}°</label>
                    <input
                      type="range" min={0} max={360} value={gradientRotation}
                      onChange={(e) => setGradientRotation(Number(e.target.value))}
                      className="w-full accent-violet-500 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            )}
            <p className="text-[10px] text-slate-500">Keep contrast high between code and background so phones scan fast.</p>
          </div>
        </div>

        {/* Logo */}
        <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-3">
          <label className="flex items-center justify-between cursor-pointer select-none">
            <span className="text-xs font-bold text-slate-300">Logo in the center</span>
            <button
              onClick={() => setLogoOn(!logoOn)}
              className="w-10 rounded-full transition-colors relative cursor-pointer bg-violet-500"
              style={{ height: 22, background: logoOn ? undefined : '#334155' }}
            >
              <span
                className="absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white transition-all"
                style={{ left: logoOn ? 20 : 2 }}
              />
            </button>
          </label>
          {logoOn && (
            <>
              <div className="flex items-center gap-3">
                {logoSrc && (
                  <img src={logoSrc} alt="Logo" className="w-12 h-12 rounded-xl object-contain bg-white/5 border border-white/10 p-1" />
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setLogoSrc(CHATMIZE_LOGO); setLogoIsDefault(true); }}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                      logoIsDefault ? 'bg-violet-500/15 border-violet-500/50 text-violet-300' : 'bg-slate-900 border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    Use ChatMize logo
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-lg border bg-slate-900 border-white/10 text-slate-300 hover:border-white/25 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <ImagePlus className="w-3.5 h-3.5" /> Upload logo
                  </button>
                  {!logoIsDefault && (
                    <button
                      onClick={() => { setLogoSrc(CHATMIZE_LOGO); setLogoIsDefault(true); }}
                      title="Back to ChatMize logo"
                      className="px-2.5 py-1.5 rounded-lg border bg-slate-900 border-white/10 text-slate-400 hover:border-white/25 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Reset
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400">Logo size: {Math.round(logoSize * 100)}%</label>
                  <input
                    type="range" min={0.2} max={0.5} step={0.05} value={logoSize}
                    onChange={(e) => setLogoSize(Number(e.target.value))}
                    className="w-full accent-violet-500 cursor-pointer"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400">Padding: {logoMargin}px</label>
                  <input
                    type="range" min={0} max={20} step={1} value={logoMargin}
                    onChange={(e) => setLogoMargin(Number(e.target.value))}
                    className="w-full accent-violet-500 cursor-pointer"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500">
                Size is capped at 50% and error correction auto-bumps to Quartile with a logo, so codes keep scanning.
              </p>
            </>
          )}
        </div>

        {/* Error correction */}
        <div className="space-y-1.5">
          <label className={labelCls}>Error Correction</label>
          <div className="grid grid-cols-3 gap-2">
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
                <div className={`text-xs font-bold ${ecc === opt.value ? 'text-violet-300' : 'text-white'}`}>{opt.label}</div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{opt.hint}</div>
              </button>
            ))}
          </div>
          {logoOn && ecc === 'M' && (
            <p className="text-[11px] text-amber-300/90">Auto-bumped to Quartile while a logo is on, so the code still scans.</p>
          )}
        </div>
      </div>

      {/* Preview + actions (5 cols) */}
      <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4">
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <QrCode className="w-4 h-4 text-violet-400" />
            <span>Live Preview</span>
          </h3>

          <div className="flex flex-col items-center justify-center p-6 bg-slate-950/80 border border-white/10 rounded-2xl">
            {payload ? (
              <>
                <div
                  className="rounded-xl border border-violet-500/30 shadow-lg shadow-violet-500/10 overflow-hidden"
                  style={{ background: transparentBg ? 'repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 50% / 24px 24px' : bgColor, padding: 12 }}
                >
                  <div ref={previewRef} className="[&>canvas]:!w-56 [&>canvas]:!h-56 [&>svg]:w-56 [&>svg]:h-56" />
                </div>
                <span className="text-[11px] text-slate-400 mt-3">Scan with your camera to test it instantly</span>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-white/15 flex items-center justify-center text-slate-600 mb-3">
                  <QrCode className="w-8 h-8" />
                </div>
                <p className="text-xs text-slate-500 max-w-[220px]">
                  Fill in the content on the left and your styled QR code appears here, live.
                </p>
              </div>
            )}
          </div>

          {payload && (
            <div className="p-3 rounded-xl bg-slate-950 border border-white/5 flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-violet-300 truncate">{payload}</span>
              <button
                onClick={handleCopy}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
                title="Copy encoded content"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}

          <div className="space-y-2">
            <label className={labelCls}>Download</label>
            <div className="grid grid-cols-3 gap-2">
              {[512, 1024, 2048].map((s) => (
                <button
                  key={s}
                  onClick={() => handleDownload(s, 'png')}
                  disabled={!payload || downloading !== null}
                  className="py-2.5 px-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-violet-500/20"
                >
                  {downloading === `png-${s}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>PNG {s}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => handleDownload(2048, 'svg')}
              disabled={!payload || downloading !== null}
              className="w-full py-2.5 px-3 rounded-xl bg-white/5 text-white border border-white/10 text-xs font-bold flex items-center justify-center gap-2 transition-all hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {downloading === 'svg-2048' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-violet-400" />}
              <span>Download SVG (vector, infinite scale)</span>
            </button>
            {openHref && (
              <a
                href={openHref}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-3 rounded-xl bg-white/5 text-white border border-white/10 text-xs font-bold flex items-center justify-center gap-2 transition-all hover:bg-white/10 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4 text-violet-400" />
                <span>Test Open Link</span>
              </a>
            )}
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
            <li>Logos are safe up to 50% size. Error correction auto-bumps to Quartile when a logo is on.</li>
            <li>Dark code on a light background scans fastest. Fancy gradients look great on screens, but test before big print runs.</li>
            <li>Use <span className="text-white font-semibold">2048px PNG</span> or <span className="text-white font-semibold">SVG</span> for anything printed.</li>
            <li>Leave quiet space around the code on flyers and always test with two different phones.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
