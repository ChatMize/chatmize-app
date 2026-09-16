import React, { useState } from 'react';
import { Check, MessageSquare, Instagram, Phone, ArrowRight, ArrowLeft, Unplug } from 'lucide-react';
import { WorkspaceSilo } from '../../types/workspace';

interface ConnectStepProps {
  workspace: WorkspaceSilo;
  onUpdate: (ws: WorkspaceSilo) => void;
  onNext: () => void;
  onBack: () => void;
}

/**
 * v1 account connection: the user claims their Facebook Page, Instagram
 * username, and WhatsApp number. These records live on the workspace and
 * the Meta OAuth flow will upgrade them to real tokens once the Meta app
 * ships (see outstanding Meta integration work).
 */
export const ConnectStep: React.FC<ConnectStepProps> = ({ workspace, onUpdate, onNext, onBack }) => {
  const page = workspace.connectedPage || ({} as WorkspaceSilo['connectedPage']);
  const [pageName, setPageName] = useState(page?.pageName || '');
  const [pageId, setPageId] = useState(page?.pageId || '');
  const [igUsername, setIgUsername] = useState(page?.connectedIg?.username?.replace('@', '') || '');
  const [waNumber, setWaNumber] = useState(page?.connectedWhatsApp?.phoneNumber || '');
  const [editing, setEditing] = useState<'messenger' | 'instagram' | 'whatsapp' | null>(null);

  const messengerConnected = Boolean(page?.pageId);
  const instagramConnected = Boolean(page?.connectedIg?.connected);
  const whatsappConnected = Boolean(page?.connectedWhatsApp?.connected);
  const connectedCount = [messengerConnected, instagramConnected, whatsappConnected].filter(Boolean).length;

  const saveMessenger = () => {
    if (!pageId.trim()) return;
    onUpdate({
      ...workspace,
      connectedPage: {
        ...page,
        pageId: pageId.trim(),
        pageName: pageName.trim() || pageId.trim(),
        pageCategory: page?.pageCategory || 'Business',
        connectedAt: page?.connectedAt || new Date().toISOString(),
      },
    });
    setEditing(null);
  };

  const saveInstagram = () => {
    if (!igUsername.trim()) return;
    onUpdate({
      ...workspace,
      connectedPage: {
        ...page,
        connectedIg: {
          username: igUsername.trim().startsWith('@') ? igUsername.trim() : `@${igUsername.trim()}`,
          igId: page?.connectedIg?.igId || '',
          followersCount: page?.connectedIg?.followersCount || 0,
          connected: true,
          status: 'active',
        },
      },
    });
    setEditing(null);
  };

  const saveWhatsapp = () => {
    if (!waNumber.trim()) return;
    onUpdate({
      ...workspace,
      connectedPage: {
        ...page,
        connectedWhatsApp: {
          phoneNumber: waNumber.trim(),
          wabaId: page?.connectedWhatsApp?.wabaId || '',
          verified: false,
          connected: true,
          status: 'active',
        },
      },
    });
    setEditing(null);
  };

  const disconnect = (which: 'messenger' | 'instagram' | 'whatsapp') => {
    if (which === 'messenger') {
      onUpdate({ ...workspace, connectedPage: { ...page, pageId: '', pageName: '' } });
    } else if (which === 'instagram') {
      onUpdate({ ...workspace, connectedPage: { ...page, connectedIg: undefined } });
    } else {
      onUpdate({ ...workspace, connectedPage: { ...page, connectedWhatsApp: undefined } });
    }
  };

  const inputCls =
    'w-full bg-slate-800/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50';

  const renderCard = (
    which: 'messenger' | 'instagram' | 'whatsapp',
    icon: React.ReactNode,
    title: string,
    description: string,
    connected: boolean,
    accountLabel: string,
  ) => (
    <div className={`rounded-3xl border p-5 transition-all ${connected ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/10 bg-slate-900/60'}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-2xl bg-white/5">{icon}</span>
          <div>
            <h4 className="text-sm font-bold text-white">{title}</h4>
            <p className="text-[11px] text-slate-500">{description}</p>
          </div>
        </div>
        {connected ? (
          <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-1 rounded-full">
            <Check className="w-3 h-3" /> Connected
          </span>
        ) : (
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 bg-white/5 border border-white/10 px-2 py-1 rounded-full">
            Not connected
          </span>
        )}
      </div>

      {connected ? (
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-slate-300 font-semibold">{accountLabel}</p>
          <button
            type="button"
            onClick={() => disconnect(which)}
            className="text-[11px] text-slate-500 hover:text-red-400 flex items-center gap-1 cursor-pointer"
          >
            <Unplug className="w-3 h-3" /> Disconnect
          </button>
        </div>
      ) : editing === which ? (
        <div className="mt-3 space-y-2">
          {which === 'messenger' && (
            <>
              <input className={inputCls} value={pageName} onChange={(e) => setPageName(e.target.value)} placeholder="Facebook Page name" />
              <input className={inputCls} value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="Facebook Page ID" />
              <button type="button" onClick={saveMessenger} disabled={!pageId.trim()} className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold cursor-pointer">
                Connect Page
              </button>
            </>
          )}
          {which === 'instagram' && (
            <>
              <input className={inputCls} value={igUsername} onChange={(e) => setIgUsername(e.target.value)} placeholder="Instagram username (without @)" />
              <button type="button" onClick={saveInstagram} disabled={!igUsername.trim()} className="w-full py-2 bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold cursor-pointer">
                Connect Instagram
              </button>
            </>
          )}
          {which === 'whatsapp' && (
            <>
              <input className={inputCls} value={waNumber} onChange={(e) => setWaNumber(e.target.value)} placeholder="WhatsApp Business number (+1 ...)" />
              <button type="button" onClick={saveWhatsapp} disabled={!waNumber.trim()} className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold cursor-pointer">
                Connect WhatsApp
              </button>
            </>
          )}
          <button type="button" onClick={() => setEditing(null)} className="w-full text-[11px] text-slate-500 hover:text-slate-300 cursor-pointer">
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(which)}
          className="mt-3 w-full py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold cursor-pointer"
        >
          Connect {title.split(' ')[0]}
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-black text-white mb-1">Connect your accounts</h3>
        <p className="text-xs text-slate-400">
          Link the channels where your audience talks to you. The more you connect now, the faster your automation goes live.
          ({connectedCount} of 3 connected)
        </p>
      </div>

      <div className="space-y-3">
        {renderCard(
          'messenger',
          <MessageSquare className="w-5 h-5 text-blue-400" />,
          'Facebook Messenger',
          'Your Facebook Page is the anchor for all Meta messaging.',
          messengerConnected,
          page?.pageName || '',
        )}
        {renderCard(
          'instagram',
          <Instagram className="w-5 h-5 text-pink-400" />,
          'Instagram',
          'Automate DMs, story replies, and comment triggers.',
          instagramConnected,
          page?.connectedIg?.username || '',
        )}
        {renderCard(
          'whatsapp',
          <Phone className="w-5 h-5 text-emerald-400" />,
          'WhatsApp',
          'Reach customers on the world\u2019s most-used chat app.',
          whatsappConnected,
          page?.connectedWhatsApp?.phoneNumber || '',
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-3">
          {connectedCount === 0 && (
            <span className="text-[11px] text-slate-500">You can connect these later in Settings.</span>
          )}
          <button
            type="button"
            onClick={onNext}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-500/20"
          >
            <span>{connectedCount > 0 ? 'Continue' : 'Skip for now'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
