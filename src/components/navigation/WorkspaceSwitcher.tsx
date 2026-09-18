import React, { useState, useRef, useEffect } from 'react';
import { 
  Building2, 
  ChevronDown, 
  Check, 
  Plus, 
  Facebook, 
  Instagram, 
  Phone, 
  Crown, 
  ExternalLink, 
  ShieldCheck, 
  Layers, 
  Sparkles,
  Smartphone,
  Globe,
  RefreshCw
} from 'lucide-react';
import { Workspace } from '../../types/workspace';
import { getMetaOAuthStatus } from '../../lib/meta';
import { getInstagramOAuthStatus } from '../../lib/instagram';

interface WorkspaceSwitcherProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
  onOpenCreateModal?: () => void;
  onNavigateToSuperAdmin?: () => void;
  onOpenPageSync?: () => void;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onOpenCreateModal,
  onNavigateToSuperAdmin,
  onOpenPageSync
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];

  // Show the connected channel's profile image as the workspace avatar:
  // the Meta anchor's Page picture first, then the IG-only profile picture.
  const [channelAvatarUrl, setChannelAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setChannelAvatarUrl(null);
    if (!activeWorkspace?.id) return;
    (async () => {
      try {
        const meta = await getMetaOAuthStatus(activeWorkspace.id);
        if (!cancelled && meta.connected && meta.pagePictureUrl) {
          setChannelAvatarUrl(meta.pagePictureUrl);
          return;
        }
      } catch { /* fall through to IG-only */ }
      try {
        const ig = await getInstagramOAuthStatus(activeWorkspace.id);
        if (!cancelled && ig.connected && ig.pictureUrl) {
          setChannelAvatarUrl(ig.pictureUrl);
        }
      } catch { /* keep fallback avatar */ }
    })();
    return () => { cancelled = true; };
  }, [activeWorkspace?.id]);

  const avatarFor = (wsId: string, fallback?: string) =>
    (wsId === activeWorkspace?.id && channelAvatarUrl) || fallback || null;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all cursor-pointer group"
      >
        {avatarFor(activeWorkspace.id, activeWorkspace?.avatarUrl) ? (
          <img 
            src={avatarFor(activeWorkspace.id, activeWorkspace?.avatarUrl)!} 
            alt={activeWorkspace.name} 
            className="w-7 h-7 rounded-lg object-cover border border-slate-700 flex-shrink-0 shadow-sm"
          />
        ) : (
          <div 
            className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs text-slate-950 flex-shrink-0 shadow-sm"
            style={{ backgroundColor: activeWorkspace?.color || '#00d2ff' }}
          >
            {activeWorkspace?.name.substring(0, 2).toUpperCase() || 'WS'}
          </div>
        )}

        <div className="min-w-0 pr-1 max-w-[110px] sm:max-w-[190px]">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-100 truncate block">
              {activeWorkspace?.name || 'Workspace'}
            </span>
            {activeWorkspace?.whitelabel.enabled && (
              <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />
            )}
          </div>
          {/* Active channel badges (only show connected) */}
          <div className="flex items-center gap-1 mt-0.5">
            {activeWorkspace?.connectedPage.pageName && (
              <span className="text-[10px] text-slate-400 truncate max-w-[80px]">
                {activeWorkspace.connectedPage.pageName}
              </span>
            )}
            {activeWorkspace?.connectedPage.pageId && (
              <span className="w-4 h-4 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0" title={`Facebook: ${activeWorkspace.connectedPage.pageName}`}>
                <Facebook className="w-2.5 h-2.5 text-blue-400" />
              </span>
            )}
            {activeWorkspace?.connectedPage.connectedIg?.connected && (
              <span className="w-4 h-4 rounded-full bg-pink-500/20 border border-pink-500/30 flex items-center justify-center flex-shrink-0" title={`Instagram: @${activeWorkspace.connectedPage.connectedIg.username}`}>
                <Instagram className="w-2.5 h-2.5 text-pink-400" />
              </span>
            )}
            {activeWorkspace?.connectedPage.connectedWhatsApp?.connected && (
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0" title={`WhatsApp: ${activeWorkspace.connectedPage.connectedWhatsApp.phoneNumber}`}>
                <Phone className="w-2.5 h-2.5 text-emerald-400" />
              </span>
            )}
            {activeWorkspace?.connectedSms?.connected && (
              <span className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0" title="SMS connected">
                <Smartphone className="w-2.5 h-2.5 text-amber-400" />
              </span>
            )}
            {activeWorkspace?.connectedStandaloneChat?.enabled && (
              <span className="w-4 h-4 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0" title="Web Chat connected">
                <Globe className="w-2.5 h-2.5 text-cyan-400" />
              </span>
            )}
          </div>
        </div>

        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 group-hover:text-slate-200 ${isOpen ? 'rotate-180 text-cyan-400' : ''}`} />
      </button>

      {/* Dropdown Menu (Meta Account & Linked Hierarchy) */}
      {isOpen && (
        <div className="absolute right-0 sm:left-0 mt-2 w-[calc(100vw-1.5rem)] max-w-sm sm:w-96 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl shadow-slate-950/80 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-2.5 pb-2 border-b border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">Karl Schuckert</span>
              <span className="text-[10px] text-slate-400">Meta Account Anchor &bull; {workspaces.filter(w => !w.deleted).length} Connected Workspaces</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold">
              Meta Sync Ready
            </span>
          </div>

          {/* Workspaces List with FB + IG hierarchy + SMS & Web Bot */}
          <div className="py-1.5 max-h-72 overflow-y-auto space-y-1">
            {workspaces.filter(ws => !ws.deleted).map((ws) => {
              const isCurrent = ws.id === activeWorkspaceId;
              const hasSms = Boolean(ws.connectedSms?.connected);
              const hasBot = Boolean(ws.connectedStandaloneChat?.enabled);

              return (
                <button
                  key={ws.id}
                  onClick={() => {
                    onSelectWorkspace(ws.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl transition-all flex flex-col gap-1.5 cursor-pointer ${
                    isCurrent
                      ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300'
                      : 'hover:bg-slate-800/80 text-slate-300 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {avatarFor(ws.id, ws.avatarUrl) ? (
                        <img 
                          src={avatarFor(ws.id, ws.avatarUrl)!} 
                          alt={ws.name} 
                          className="w-7 h-7 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                        />
                      ) : (
                        <div 
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] text-slate-950 flex-shrink-0"
                          style={{ backgroundColor: ws.color }}
                        >
                          {ws.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold truncate block">{ws.name}</span>
                          {ws.whitelabel.enabled && (
                            <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-mono">WL</span>
                          )}
                        </div>
                        {ws.connectedPage.pageName && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-400">
                            <Facebook className="w-2.5 h-2.5 text-blue-400" />
                            <span className="truncate">{ws.connectedPage.pageName}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {isCurrent && (
                        <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      )}
                    </div>
                  </div>

                  {/* Indented Instagram & WhatsApp + SMS & Chatbot */}
                  <div className="pl-9 flex items-center gap-1.5 flex-wrap text-[10px]">
                    {ws.connectedPage.connectedIg?.username && (
                      <span className="px-1.5 py-0.5 rounded bg-pink-500/15 text-pink-300 border border-pink-500/25 flex items-center gap-1">
                        <Instagram className="w-2.5 h-2.5" />
                        <span>{ws.connectedPage.connectedIg.username}</span>
                      </span>
                    )}

                    {ws.connectedPage.connectedWhatsApp?.connected && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 flex items-center gap-1" title={`WhatsApp: ${ws.connectedPage.connectedWhatsApp.phoneNumber}`}>
                        <Phone className="w-2.5 h-2.5" />
                        <span>{ws.connectedPage.connectedWhatsApp.phoneNumber || 'WA'}</span>
                      </span>
                    )}

                    {hasSms && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25 flex items-center gap-1">
                        <Smartphone className="w-2.5 h-2.5" />
                        <span>SMS</span>
                      </span>
                    )}

                    {hasBot && (
                      <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5" />
                        <span>Web Bot</span>
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bottom Actions */}
          <div className="p-1.5 pt-2 border-t border-slate-800 space-y-1">
            {onOpenPageSync && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenPageSync();
                }}
                className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                <span>Facebook Page Sync</span>
              </button>
            )}

            {onOpenCreateModal && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenCreateModal();
                }}
                className="w-full py-1.5 px-2.5 rounded-lg hover:bg-slate-800 text-cyan-400 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Connect New Workspace Asset</span>
              </button>
            )}

            {onNavigateToSuperAdmin && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onNavigateToSuperAdmin();
                }}
                className="w-full py-1 px-2.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[11px] flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  Architecture Kanban
                </span>
                <span className="text-[10px] text-indigo-400 font-mono">Roadmap &rarr;</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
