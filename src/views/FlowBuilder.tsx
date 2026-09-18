import { 
  ArrowLeft,
  ArrowRight, 
  Bot, 
  Check, 
  ChevronDown, 
  ChevronLeft,
  ChevronRight, 
  ChevronUp,
  Clock, 
  Copy, 
  ExternalLink, 
  Eye, 
  FileText, 
  FolderPlus, 
  Globe, 
  Image as ImageIcon, 
  Layers, 
  Link2,
  Maximize2, 
  MessageCircle, 
  MessageSquare, 
  MessageSquareText,
  Minus, 
  MoreHorizontal,
  MousePointer2, 
  Move, 
  Pencil, 
  Play, 
  Plus, 
  Radio, 
  RefreshCw, 
  Send, 
  Settings, 
  Share2, 
  Sparkles, 
  Tag, 
  Trash2, 
  Unlink,
  User, 
  UserCheck, 
  Workflow, 
  X, 
  Zap, 
  ZoomIn, 
  ZoomOut,
  BellRing,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  Instagram,
  Smartphone,
  Layout,
  Webhook,
  QrCode,
  Power,
  Sliders,
  Search,
  BookOpen,
  Hash
} from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { EmojiPickerButton, useEmojiTarget, useEmojiTargetMap } from '../components/emoji';
import { 
  getActiveConnectedIntegrations, 
  INTEGRATION_ACTION_TEMPLATES, 
  INTEGRATION_PLATFORM_DATA,
  IntegrationApp 
} from '../data/integrations';
import { saveContact, setContactVariable, saveRecurringNotificationToken, saveOtnToken } from '../lib/firebase';
import { PersonalizationPickerButton, usePersonalizationTarget, usePersonalizationTargetMap } from '../components/personalization';
import { 
  MetaMessageTag, 
  validateMessageTagCompliance, 
  TriggerRuleType, 
  OutsideRuleType, 
  MetaRecurringFrequency,
  FlowTrigger,
  TriggerChannel,
  TriggerType,
  TriggerTemplate,
  TRIGGER_CATALOG
} from '../types/metaMessaging';
import { MetaPolicyModal } from '../components/MetaPolicyModal';
import { TriggerSelectorModal } from '../components/TriggerSelectorModal';
import { ImageUpload } from '../components/ImageUpload';
import { loadBotMapData, saveBotMapData } from '../utils/botMapStorage';

export type MessageComponentType = 
  | 'text' 
  | 'image' 
  | 'card' 
  | 'gallery' 
  | 'typing'
  | 'recurring_notification_optin'
  | 'one_time_notification_optin'
  | 'whatsapp_template';

export interface CardItem {
  id: string;
  imageUrl?: string;
  title: string;
  subtitle?: string;
  buttonLabel?: string;
  buttonUrl?: string;
}

export interface MessageComponent {
  id: string;
  type: MessageComponentType;
  text?: string;
  imageUrl?: string;
  imageCaption?: string;
  cardTitle?: string;
  cardSubtitle?: string;
  cardImageUrl?: string;
  cardButtonLabel?: string;
  cardButtonUrl?: string;
  galleryCards?: CardItem[];
  delaySeconds?: number;
  // Meta Recurring Notifications & OTN fields
  rnTopic?: string;
  rnFrequency?: 'daily' | 'weekly' | 'monthly';
  rnTitle?: string;
  rnButtonText?: string;
  otnTopic?: string;
  otnButtonText?: string;
  // WhatsApp Template fields
  waTemplateName?: string;
  waCategory?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  waHeader?: string;
  waBody?: string;
  waVariables?: string[];
}

export interface FlowNode {
  id: string;
  type: 'trigger' | 'action' | 'message' | 'ai' | 'delay' | 'condition';
  title: string;
  content?: string;
  
  // Omnichannel Entry Points & Triggers (Starting Step)
  triggers?: FlowTrigger[];
  
  // Starting Trigger Rules (Connected specifically to node.type === 'trigger')
  triggerRuleType?: TriggerRuleType;
  triggerKeywords?: string[];
  triggerAdCampaignId?: string;
  triggerAdName?: string;
  triggerPostUrl?: string;
  triggerCommentReply?: string;
  triggerReferralCode?: string;
  policyWindowHours?: number; // default 24
  allowedChannels?: ('messenger' | 'instagram' | 'whatsapp')[];
  autoRenewOnReply?: boolean;

  // Outside 24-Hour Rules (Only when node goes outside normal rules)
  isPost24h?: boolean;
  outsideRuleType?: OutsideRuleType;
  messageTag?: MetaMessageTag;
  otnTopic?: string;
  otnTokenId?: string;
  rnFrequency?: MetaRecurringFrequency;
  rnTopic?: string;
  waTemplateName?: string;
  sponsoredCampaignName?: string;

  components?: MessageComponent[];
  buttons?: string[];
  quickReplies?: string[];
  actionTags?: string[];
  // SMS action (sent via the workspace's provisioned Twilio number; requires opt-in)
  smsMessage?: string;
  smsCollectOptIn?: boolean;
  delayText?: string;
  delayHours?: number;
  conditionText?: string;
  x: number;
  y: number;
  iconType: 'workflow' | 'message' | 'bot' | 'tag' | 'clock';
}

export interface FlowConnection {
  id: string;
  sourceNodeId: string;
  sourceHandleId?: string; // 'output' or 'btn-0', etc.
  targetNodeId: string;
  color?: string;
  dashed?: boolean;
}

export interface Outside24hCheckResult {
  isOutside: boolean;
  reason?: OutsideRuleType | 'delay' | 'manual' | 'tag' | 'otn' | 'rn' | 'wa' | 'sponsored';
  delayNodeTitle?: string;
  delayText?: string;
}

// Helper to determine if a node operates outside Meta's standard 24-hour window
export function checkNodeOutside24h(
  nodeId: string, 
  nodes: FlowNode[], 
  connections: FlowConnection[]
): Outside24hCheckResult {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return { isOutside: false };
  if (node.type === 'trigger') return { isOutside: false };

  // 1. If manually flagged as post-24h or has explicit outside rule settings
  if (node.isPost24h) {
    return { isOutside: true, reason: 'manual' };
  }
  if (node.outsideRuleType && node.outsideRuleType !== 'tag') {
    return { isOutside: true, reason: node.outsideRuleType };
  }
  if (node.outsideRuleType === 'tag' && node.messageTag && node.messageTag !== 'NONE') {
    return { isOutside: true, reason: 'tag' };
  }
  if (node.messageTag && node.messageTag !== 'NONE') {
    return { isOutside: true, reason: 'tag' };
  }
  if (node.otnTopic) {
    return { isOutside: true, reason: 'otn' };
  }
  if (node.rnTopic) {
    return { isOutside: true, reason: 'rn' };
  }

  // 2. Trace backwards through incoming connections to see if downstream of a delay >= 24h
  const visited = new Set<string>();
  const queue: string[] = [nodeId];

  while (queue.length > 0) {
    const currId = queue.shift()!;
    if (visited.has(currId)) continue;
    visited.add(currId);

    const incoming = connections.filter(c => c.targetNodeId === currId);
    for (const conn of incoming) {
      const srcNode = nodes.find(n => n.id === conn.sourceNodeId);
      if (!srcNode) continue;

      if (srcNode.type === 'delay') {
        const dText = (srcNode.delayText || srcNode.content || '').toLowerCase();
        const is24hOrMore = 
          dText.includes('day') || 
          dText.includes('week') || 
          dText.includes('month') || 
          dText.includes('post-24h') ||
          dText.includes('24h') ||
          dText.includes('48h') ||
          dText.includes('72h') ||
          (srcNode.delayHours !== undefined && srcNode.delayHours >= 24);

        if (is24hOrMore) {
          return {
            isOutside: true,
            reason: 'delay',
            delayNodeTitle: srcNode.title,
            delayText: srcNode.delayText || srcNode.content
          };
        }
      }
      queue.push(srcNode.id);
    }
  }

  return { isOutside: false };
}

const EMPTY_HANDLES_ARRAY: string[] = [];
const DEFAULT_OUTSIDE_INFO: { isOutside: boolean; reason?: 'delay' | 'tag' | 'otn' | 'rn'; delayNodeTitle?: string; delayText?: string } = { isOutside: false };

export function FlowBuilder({ 
  onNavigateToIntegrations,
  onNavigateToDocs,
  onBackToBotList,
  activeBotId = 'bot-1',
  activeBotTitle,
  onUpdateBotTitle
}: { 
  onNavigateToIntegrations?: () => void;
  onNavigateToDocs?: (docId?: string) => void;
  onBackToBotList?: () => void;
  activeBotId?: string;
  activeBotTitle?: string;
  onUpdateBotTitle?: (title: string) => void;
} = {}) {
  const [aiMode, setAiMode] = useState<'manual' | 'copilot' | 'auto'>('manual');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isLive, setIsLive] = useState<boolean>(() => {
    return loadBotMapData(activeBotId, activeBotTitle).isLive;
  });
  const [flowTitle, setFlowTitle] = useState<string>(activeBotTitle || '(Ad) Build-A-Bot Invite');
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);

  // Dynamic Nodes loaded per active bot map
  const [nodes, setNodes] = useState<FlowNode[]>(() => {
    return loadBotMapData(activeBotId, activeBotTitle).nodes;
  });

  // Dynamic Flow Connections (Piping) loaded per active bot map
  const [connections, setConnections] = useState<FlowConnection[]>(() => {
    return loadBotMapData(activeBotId, activeBotTitle).connections;
  });

  // Whenever activeBotId changes (e.g. creating a new bot or picking from Bot List), load its own canvas
  useEffect(() => {
    const loaded = loadBotMapData(activeBotId, activeBotTitle);
    setNodes(loaded.nodes);
    setConnections(loaded.connections);
    setIsLive(loaded.isLive);
    setSelectedNodeId(null);
    if (activeBotTitle) {
      setFlowTitle(activeBotTitle);
    }
  }, [activeBotId, activeBotTitle]);

  const [showAddMenu, setShowAddMenu] = useState<boolean>(false);
  const [showLiveToast, setShowLiveToast] = useState<boolean>(false);
  const [showSimulator, setShowSimulator] = useState<boolean>(false);
  const [showMetaPolicyModal, setShowMetaPolicyModal] = useState<boolean>(false);
  const [showTriggerModal, setShowTriggerModal] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerAutoSave = () => {
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveStatus('saved');
      saveBotMapData(activeBotId, { nodes, connections, isLive, flowTitle });
    }, 400);
  };

  // Persist current bot map updates to its own storage slot
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    saveBotMapData(activeBotId, { nodes, connections, isLive, flowTitle });
  }, [nodes, connections, isLive, flowTitle, activeBotId]);

  // Live dragging pipe state (interactive curve slide-out mechanic)
  const [draggingPipe, setDraggingPipe] = useState<{
    sourceNodeId: string;
    sourceHandleId: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    color: string;
  } | null>(null);
  const draggingPipeRef = useRef<{
    sourceNodeId: string;
    sourceHandleId: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    color: string;
  } | null>(null);

  const [hoveredTargetNodeId, setHoveredTargetNodeId] = useState<string | null>(null);
  const hoveredTargetNodeIdRef = useRef<string | null>(null);
  const suppressCanvasClickRef = useRef<boolean>(false);
  const [hoveredPipeId, setHoveredPipeId] = useState<string | null>(null);
  const [selectedPipeId, setSelectedPipeId] = useState<string | null>(null);

  // Next Step Popover Menu (anchored at release coordinates)
  const [nextStepMenu, setNextStepMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    sourceNodeId: string;
    sourceHandleId: string;
    color: string;
  } | null>(null);

  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const panOffsetRef = useRef(panOffset);
  panOffsetRef.current = panOffset;
  const zoomLevelRef = useRef(zoomLevel);
  zoomLevelRef.current = zoomLevel;
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartPos = useRef<{ x: number; y: number; moved: boolean }>({ x: 0, y: 0, moved: false });

  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const draggingNodeRef = useRef(draggingNode);
  draggingNodeRef.current = draggingNode;
  const dragStartPos = useRef<{ clientX: number; clientY: number; moved: boolean }>({ clientX: 0, clientY: 0, moved: false });
  const nodeDragRef = useRef<{
    nodeId: string;
    startClientX: number;
    startClientY: number;
    startNodeX: number;
    startNodeY: number;
  } | null>(null);

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasContentRef = useRef<HTMLDivElement>(null);
  const editorDrawerRef = useRef<HTMLDivElement>(null);
  const [cachedEditorNode, setCachedEditorNode] = useState<FlowNode | null>(null);

  // Fast O(1) node lookup map
  const nodeMap = useMemo(() => {
    const map = new Map<string, FlowNode>();
    for (let i = 0; i < nodes.length; i++) {
      map.set(nodes[i].id, nodes[i]);
    }
    return map;
  }, [nodes]);

  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) : undefined;

  // Memoized map of connected output handle IDs per node (zero garbage collection during drag)
  const connectedHandlesMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (let i = 0; i < connections.length; i++) {
      const c = connections[i];
      if (!map[c.sourceNodeId]) {
        map[c.sourceNodeId] = [];
      }
      map[c.sourceNodeId].push(c.sourceHandleId || 'output');
    }
    return map;
  }, [connections]);

  // Topology key that ONLY changes when graph connectivity, node rules, or delays change (ignores x/y changes during drag)
  const topologyKey = useMemo(() => {
    let key = '';
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      key += `${n.id}:${n.type}:${n.delayHours ?? ''}:${n.delayText ?? ''}:${n.messageTag ?? ''}:${n.outsideRuleType ?? ''}:${n.rnTopic ?? ''}:${n.otnTopic ?? ''}|`;
    }
    key += '#';
    for (let i = 0; i < connections.length; i++) {
      const c = connections[i];
      key += `${c.sourceNodeId}->${c.targetNodeId}|`;
    }
    return key;
  }, [nodes, connections]);

  // Precalculated outside 24h compliance statuses (0 BFS traversals during drag/pan)
  const outsideInfoMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof checkNodeOutside24h>> = {};
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.type !== 'trigger') {
        map[n.id] = checkNodeOutside24h(n.id, nodes, connections);
      } else {
        map[n.id] = DEFAULT_OUTSIDE_INFO;
      }
    }
    return map;
  }, [topologyKey]);

  // Update cached copy of the selected node for smooth slide-in / slide-out animations
  useEffect(() => {
    if (selectedNodeId) {
      const found = nodeMap.get(selectedNodeId);
      if (found) {
        setCachedEditorNode(prev => {
          if (!prev || prev.id !== found.id) return found;
          // Prevent re-rendering editor if only x/y coordinates changed during drag
          if (prev === found) return prev;
          if (
            prev.title === found.title &&
            prev.content === found.content &&
            prev.type === found.type &&
            prev.components === found.components &&
            prev.buttons === found.buttons &&
            prev.triggers === found.triggers &&
            prev.delayHours === found.delayHours &&
            prev.delayText === found.delayText &&
            prev.messageTag === found.messageTag &&
            prev.outsideRuleType === found.outsideRuleType
          ) {
            return prev;
          }
          return found;
        });
      }
    }
  }, [selectedNodeId, nodeMap]);

  // Click outside sidebar editor: slide back in anytime! Only opens when clicking inside a node.
  useEffect(() => {
    if (!selectedNodeId) return;

    const handleGlobalPointerDownOutside = (e: PointerEvent | MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // 1. If clicked inside the editor drawer, keep it open
      if (editorDrawerRef.current && editorDrawerRef.current.contains(target)) {
        return;
      }

      // 2. If clicked inside any node on the canvas, let the node's handler open/switch that node
      if (target.closest('[data-flow-node]')) {
        return;
      }

      // 3. If clicked inside a popup modal (e.g. Phone Simulator) or dropdowns, do not interfere
      if (target.closest('[data-modal]')) {
        return;
      }

      // 4. Clicked outside anywhere else: slide editor drawer back in!
      setSelectedNodeId(null);
      setSelectedPipeId(null);
    };

    document.addEventListener('pointerdown', handleGlobalPointerDownOutside);
    return () => {
      document.removeEventListener('pointerdown', handleGlobalPointerDownOutside);
    };
  }, [selectedNodeId]);

  // Convert browser clientX / clientY to canvas coordinates precisely
  const getCanvasCoords = (clientX: number, clientY: number) => {
    const safeZoom = (zoomLevelRef.current && zoomLevelRef.current > 0) ? zoomLevelRef.current : 1;
    const currentPan = panOffsetRef.current || { x: 0, y: 0 };
    if (!canvasContainerRef.current) {
      return {
        x: (clientX - currentPan.x) / safeZoom,
        y: (clientY - currentPan.y) / safeZoom,
      };
    }
    const rect = canvasContainerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - currentPan.x) / safeZoom,
      y: (clientY - rect.top - currentPan.y) / safeZoom,
    };
  };

  // Cached pin relative positions for zero-reflow rendering
  const pinOffsetsRef = useRef<Record<string, { x: number; y: number }>>({});
  const [, setPinRenderTick] = useState(0);
  const pinRenderBatchRef = useRef(false);

  const registerPinOffset = useCallback((pinId: string, x: number, y: number) => {
    const prev = pinOffsetsRef.current[pinId];
    if (!prev || Math.abs(prev.x - x) > 0.75 || Math.abs(prev.y - y) > 0.75) {
      pinOffsetsRef.current[pinId] = { x, y };
      if (!pinRenderBatchRef.current) {
        pinRenderBatchRef.current = true;
        queueMicrotask(() => {
          pinRenderBatchRef.current = false;
          setPinRenderTick(t => (t + 1) % 10000);
        });
      }
    }
  }, []);

  // Handle position calculators - high-performance cached relative offsets with DOM fallback
  const getHandlePoint = (node: FlowNode, type: 'in' | 'out', handleId: string = 'output') => {
    const pinId = type === 'in' ? `pin-in-${node.id}` : `pin-out-${node.id}-${handleId}`;

    // 1. FAST PATH: Return cached relative offset (pure O(1) arithmetic, zero reflow / DOM reads)
    const cached = pinOffsetsRef.current[pinId];
    if (cached) {
      return {
        x: Math.round(node.x + cached.x),
        y: Math.round(node.y + cached.y),
      };
    }

    // 2. Query DOM if not yet cached, then cache in pinOffsetsRef
    if (typeof document !== 'undefined') {
      const pinEl = document.getElementById(pinId);
      if (pinEl) {
        const nodeEl = document.querySelector(`[data-flow-node="${node.id}"]`) as HTMLElement | null;
        if (nodeEl) {
          const nodeRect = nodeEl.getBoundingClientRect();
          const pinRect = pinEl.getBoundingClientRect();
          const scale = (nodeRect.width > 0 && nodeEl.offsetWidth > 0)
            ? (nodeRect.width / nodeEl.offsetWidth)
            : ((zoomLevelRef.current && zoomLevelRef.current > 0) ? zoomLevelRef.current : 1);

          const relX = (pinRect.left + pinRect.width / 2 - nodeRect.left) / scale;
          const relY = (pinRect.top + pinRect.height / 2 - nodeRect.top) / scale;

          pinOffsetsRef.current[pinId] = { x: relX, y: relY };
          return {
            x: Math.round(node.x + relX),
            y: Math.round(node.y + relY),
          };
        }
      }
    }

    // 3. Mathematical fallback based on node content & button index
    const width = node.type === 'message' ? 290 : node.type === 'trigger' ? 320 : 250;
    if (type === 'in') {
      return { x: node.x, y: node.y + 46 };
    }
    if (handleId && handleId.startsWith('btn-')) {
      const idx = parseInt(handleId.replace('btn-', ''), 10) || 0;
      let estimatedY = 46;
      if (node.content) {
        estimatedY += Math.max(50, Math.ceil(node.content.length / 30) * 22 + 16);
      }
      if (node.components && node.components.length > 0) {
        node.components.forEach(c => {
          if (c.type === 'image' || c.type === 'card' || c.type === 'gallery') estimatedY += 160;
          else if (c.type === 'typing') estimatedY += 44;
          else if (c.type === 'text') estimatedY += 48;
          else if (c.type === 'recurring_notification_optin' || c.type === 'one_time_notification_optin') estimatedY += 120;
          else if (c.type === 'whatsapp_template') estimatedY += 100;
          else estimatedY += 40;
        });
      }
      estimatedY += 16 + (idx * 44) + 20;
      return { x: node.x + width, y: node.y + estimatedY };
    }
    return { x: node.x + width, y: node.y + 46 };
  };

  const getBezierMidpoint = (s: { x: number; y: number }, t: { x: number; y: number }, dx: number) => {
    const p1x = s.x + dx;
    const p1y = s.y;
    const p2x = t.x - dx;
    const p2y = t.y;
    const midX = 0.125 * s.x + 0.375 * p1x + 0.375 * p2x + 0.125 * t.x;
    const midY = 0.125 * s.y + 0.375 * p1y + 0.375 * p2y + 0.125 * t.y;
    return { x: Math.round(midX), y: Math.round(midY) };
  };

  // Start pulling out a pipe
  const handleStartConnect = (
    e: React.MouseEvent,
    sourceNodeId: string,
    sourceHandleId: string = 'output',
    defaultColor?: string
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setNextStepMenu(null);

    const sourceNode = nodes.find(n => n.id === sourceNodeId);
    if (!sourceNode) return;

    const startPt = getHandlePoint(sourceNode, 'out', sourceHandleId);
    const mousePos = getCanvasCoords(e.clientX, e.clientY);

    const color = defaultColor || (
      sourceNode.type === 'trigger' ? '#10b981' :
      sourceNode.type === 'action' ? '#fb923c' :
      sourceNode.type === 'ai' ? '#06b6d4' :
      sourceNode.type === 'delay' ? '#a855f7' :
      '#3b82f6'
    );

    const pipeData = {
      sourceNodeId,
      sourceHandleId,
      startX: startPt.x,
      startY: startPt.y,
      currentX: Math.round(mousePos.x),
      currentY: Math.round(mousePos.y),
      color,
    };

    draggingPipeRef.current = pipeData;
    setDraggingPipe(pipeData);
  };

  // Keyboard shortcut to delete selected pipe
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPipeId) {
        setConnections(prev => prev.filter(c => c.id !== selectedPipeId));
        setSelectedPipeId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPipeId]);

  // Synchronized refs for smooth gesture handling and non-stale event listeners
  const isPanningRef = useRef(isPanning);
  isPanningRef.current = isPanning;
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const handleMouseMoveRef = useRef<((e: MouseEvent) => void) | null>(null);
  const handleCanvasMouseUpRef = useRef<((e?: MouseEvent) => void) | null>(null);

  // Global mouse move & up safety for smooth panning, node dragging, and pipe release
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isPanningRef.current || draggingNodeRef.current || draggingPipeRef.current) {
        if (handleMouseMoveRef.current) {
          handleMouseMoveRef.current(e);
        }
      }
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (handleCanvasMouseUpRef.current) {
        handleCanvasMouseUpRef.current(e);
      }
      nodeDragRef.current = null;
      setIsPanning(false);
      setDraggingNode(null);
      draggingNodeRef.current = null;
    };

    const handleWindowBlur = () => {
      nodeDragRef.current = null;
      setIsPanning(false);
      setDraggingNode(null);
      draggingNodeRef.current = null;
      setDraggingPipe(null);
      draggingPipeRef.current = null;
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  // Trackpad zoom and pan state refs for high-frequency batching via requestAnimationFrame
  const targetZoomRef = useRef(zoomLevel);
  const targetPanRef = useRef({ ...panOffset });
  const wheelRafRef = useRef<number | null>(null);
  const cachedRectRef = useRef<{ left: number; top: number; time: number } | null>(null);

  // Sync target refs when zoomLevel or panOffset change externally (e.g. from buttons or reset)
  useEffect(() => {
    if (Number.isFinite(zoomLevel)) {
      targetZoomRef.current = zoomLevel;
    }
  }, [zoomLevel]);
  useEffect(() => {
    if (panOffset && Number.isFinite(panOffset.x) && Number.isFinite(panOffset.y)) {
      targetPanRef.current = panOffset;
    }
  }, [panOffset]);

  // Robust Native Wheel & Trackpad Gesture listener with non-passive { passive: false }
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      // PREVENT DEFAULT is critical: Prevents browser from hijacking trackpad pinch into page zoom or locking iframe
      e.preventDefault();
      e.stopPropagation();

      const isPinchOrZoom = e.ctrlKey || e.metaKey;

      // Throttle getBoundingClientRect to avoid forced reflow / layout thrashing on every wheel event
      const now = performance.now();
      if (!cachedRectRef.current || now - cachedRectRef.current.time > 300) {
        const rect = container.getBoundingClientRect();
        cachedRectRef.current = { left: rect.left, top: rect.top, time: now };
      }
      const rectLeft = cachedRectRef.current.left;
      const rectTop = cachedRectRef.current.top;

      const cursorX = e.clientX - rectLeft;
      const cursorY = e.clientY - rectTop;

      const currentPan = {
        x: Number.isFinite(targetPanRef.current?.x) ? targetPanRef.current.x : 0,
        y: Number.isFinite(targetPanRef.current?.y) ? targetPanRef.current.y : 0,
      };

      if (isPinchOrZoom) {
        // macOS trackpad pinch-to-zoom OR Ctrl + mouse wheel
        // Smooth exponential zoom factor based on deltaY
        const zoomSensitivity = 0.005;
        const clampedDelta = Math.max(-80, Math.min(80, Number.isFinite(e.deltaY) ? e.deltaY : 0));
        const factor = Math.exp(-clampedDelta * zoomSensitivity);

        const currentZoom = Number.isFinite(targetZoomRef.current) && targetZoomRef.current > 0 ? targetZoomRef.current : 1;
        const nextZoom = Math.min(2.5, Math.max(0.25, Number((currentZoom * factor).toFixed(3))));
        const actualRatio = currentZoom > 0 ? nextZoom / currentZoom : 1;

        // Anchor zoom directly at the mouse/trackpad pointer location with safe bounds
        let nextPanX = Math.round(cursorX - (cursorX - currentPan.x) * actualRatio);
        let nextPanY = Math.round(cursorY - (cursorY - currentPan.y) * actualRatio);

        // Clamp pan bounds so it never shoots off into Infinity or causes GPU freeze
        nextPanX = Math.max(-6000, Math.min(6000, Number.isFinite(nextPanX) ? nextPanX : currentPan.x));
        nextPanY = Math.max(-6000, Math.min(6000, Number.isFinite(nextPanY) ? nextPanY : currentPan.y));

        targetZoomRef.current = nextZoom;
        targetPanRef.current = { x: nextPanX, y: nextPanY };
      } else {
        // Trackpad 2-finger pan OR regular mouse wheel scroll
        const dx = Number.isFinite(e.deltaX) ? Math.max(-150, Math.min(150, e.deltaX)) : 0;
        const dy = Number.isFinite(e.deltaY) ? Math.max(-150, Math.min(150, e.deltaY)) : 0;
        
        targetPanRef.current = {
          x: Math.max(-6000, Math.min(6000, currentPan.x - Math.round(dx))),
          y: Math.max(-6000, Math.min(6000, currentPan.y - Math.round(dy))),
        };
      }

      // Schedule update on requestAnimationFrame to guarantee silky 60/120fps and avoid event flood
      if (wheelRafRef.current === null) {
        wheelRafRef.current = requestAnimationFrame(() => {
          wheelRafRef.current = null;
          const safeZoom = Number.isFinite(targetZoomRef.current) ? targetZoomRef.current : 1;
          const safePan = {
            x: Number.isFinite(targetPanRef.current?.x) ? targetPanRef.current.x : 0,
            y: Number.isFinite(targetPanRef.current?.y) ? targetPanRef.current.y : 0,
          };
          setZoomLevel(safeZoom);
          setPanOffset(safePan);
        });
      }
    };

    // Safari/WebKit gesture prevention for trackpad pinch
    const handleGesture = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    container.addEventListener('gesturestart', handleGesture, { passive: false });
    container.addEventListener('gesturechange', handleGesture, { passive: false });
    container.addEventListener('gestureend', handleGesture, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
      container.removeEventListener('gesturestart', handleGesture);
      container.removeEventListener('gesturechange', handleGesture);
      container.removeEventListener('gestureend', handleGesture);
      if (wheelRafRef.current !== null) {
        cancelAnimationFrame(wheelRafRef.current);
        wheelRafRef.current = null;
      }
    };
  }, []);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Only primary left button starts canvas pan
    if (e.button !== 0) return;
    setIsPanning(true);
    panStartPos.current = {
      x: e.clientX - panOffset.x,
      y: e.clientY - panOffset.y,
      moved: false,
    };
  };

  const handleNodeMouseDown = (e: React.MouseEvent, id: string, nodeX: number, nodeY: number) => {
    if (e.button !== 0) return; // Only primary mouse button
    e.stopPropagation();

    // Prevent dragging if clicking interactive controls (buttons, inputs, toggles, etc.)
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button, input, textarea, select, a, [data-interactive]')) {
      return;
    }

    // Preserve the exact click anchor point relative to the node
    nodeDragRef.current = {
      nodeId: id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startNodeX: nodeX,
      startNodeY: nodeY,
    };
    dragStartPos.current = { clientX: e.clientX, clientY: e.clientY, moved: false };
    setDraggingNode(id);
    draggingNodeRef.current = id;
  };

  const handleNodeMouseUp = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (draggingPipeRef.current || draggingPipe) {
      handleCanvasMouseUp(e);
      return;
    }
    if (!dragStartPos.current.moved) {
      setSelectedNodeId(id);
    }
    nodeDragRef.current = null;
    setDraggingNode(null);
    draggingNodeRef.current = null;
  };

  const mouseMoveRafRef = useRef<number | null>(null);
  const pendingMousePosRef = useRef<{ clientX: number; clientY: number } | null>(null);

  const processPendingMouseMove = () => {
    mouseMoveRafRef.current = null;
    if (!pendingMousePosRef.current) return;
    const { clientX, clientY } = pendingMousePosRef.current;

    const activePipe = draggingPipeRef.current || draggingPipe;
    if (activePipe) {
      const { x: canvasPointerX, y: canvasPointerY } = getCanvasCoords(clientX, clientY);
      const roundedX = Math.round(canvasPointerX);
      const roundedY = Math.round(canvasPointerY);

      const updatedPipe = {
        ...activePipe,
        currentX: roundedX,
        currentY: roundedY,
      };
      draggingPipeRef.current = updatedPipe;
      setDraggingPipe(updatedPipe);

      // Check for proximity to input handles of other nodes (generous 52px snap radius)
      let foundTarget: string | null = null;
      for (const n of nodesRef.current) {
        if (n.id === activePipe.sourceNodeId) continue;
        if (n.type === 'trigger') continue; // trigger doesn't have an input pin
        const inPt = getHandlePoint(n, 'in');
        const dist = Math.hypot(canvasPointerX - inPt.x, canvasPointerY - inPt.y);
        if (dist < 52) {
          foundTarget = n.id;
          break;
        }
      }
      if (hoveredTargetNodeIdRef.current !== foundTarget) {
        hoveredTargetNodeIdRef.current = foundTarget;
        setHoveredTargetNodeId(foundTarget);
      }
    } else if (nodeDragRef.current && draggingNodeRef.current) {
      const drag = nodeDragRef.current;
      const clientDist = Math.hypot(clientX - drag.startClientX, clientY - drag.startClientY);
      if (clientDist > 3) {
        dragStartPos.current.moved = true;
      }
      if (!dragStartPos.current.moved) return;

      const safeZoom = (zoomLevelRef.current && zoomLevelRef.current > 0) ? zoomLevelRef.current : 1;
      const deltaX = (clientX - drag.startClientX) / safeZoom;
      const deltaY = (clientY - drag.startClientY) / safeZoom;

      const newX = Math.round(drag.startNodeX + deltaX);
      const newY = Math.round(drag.startNodeY + deltaY);

      const targetId = drag.nodeId;
      setNodes(prevNodes => prevNodes.map(node => {
        if (node.id === targetId) {
          const clampedX = Math.max(10, newX);
          const clampedY = Math.max(10, newY);
          if (node.x === clampedX && node.y === clampedY) return node;
          return {
            ...node,
            x: clampedX,
            y: clampedY,
          };
        }
        return node;
      }));
    } else if (isPanningRef.current) {
      const dist = Math.hypot(clientX - (panStartPos.current.x + panOffsetRef.current.x), clientY - (panStartPos.current.y + panOffsetRef.current.y));
      if (dist > 3) {
        panStartPos.current.moved = true;
      }
      const newPanX = Math.round(clientX - panStartPos.current.x);
      const newPanY = Math.round(clientY - panStartPos.current.y);
      panOffsetRef.current = { x: newPanX, y: newPanY };

      if (canvasContentRef.current) {
        canvasContentRef.current.style.transform = `translate3d(${newPanX}px, ${newPanY}px, 0) scale(${zoomLevelRef.current})`;
      }
      if (canvasContainerRef.current) {
        canvasContainerRef.current.style.backgroundPosition = `${newPanX}px ${newPanY}px`;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent | MouseEvent) => {
    // Direct hardware GPU transform for canvas panning: 0ms latency, zero React re-renders during pan
    if (isPanningRef.current) {
      const dist = Math.hypot(e.clientX - (panStartPos.current.x + panOffsetRef.current.x), e.clientY - (panStartPos.current.y + panOffsetRef.current.y));
      if (dist > 3) {
        panStartPos.current.moved = true;
      }
      const newPanX = Math.round(e.clientX - panStartPos.current.x);
      const newPanY = Math.round(e.clientY - panStartPos.current.y);
      panOffsetRef.current = { x: newPanX, y: newPanY };

      if (canvasContentRef.current) {
        canvasContentRef.current.style.transform = `translate3d(${newPanX}px, ${newPanY}px, 0) scale(${zoomLevelRef.current})`;
      }
      if (canvasContainerRef.current) {
        canvasContainerRef.current.style.backgroundPosition = `${newPanX}px ${newPanY}px`;
      }
      return;
    }

    pendingMousePosRef.current = { clientX: e.clientX, clientY: e.clientY };
    if (mouseMoveRafRef.current === null) {
      mouseMoveRafRef.current = requestAnimationFrame(processPendingMouseMove);
    }
  };
  handleMouseMoveRef.current = handleMouseMove;

  const handleCanvasMouseUp = (e?: React.MouseEvent | MouseEvent) => {
    if (mouseMoveRafRef.current !== null) {
      cancelAnimationFrame(mouseMoveRafRef.current);
      mouseMoveRafRef.current = null;
    }
    pendingMousePosRef.current = null;
    nodeDragRef.current = null;
    setIsPanning(false);
    setDraggingNode(null);
    draggingNodeRef.current = null;

    if (panStartPos.current.moved) {
      setPanOffset({ ...panOffsetRef.current });
      panStartPos.current.moved = false;
    }

    const activePipe = draggingPipeRef.current || draggingPipe;
    if (activePipe) {
      // Suppress the canvas click event that immediately follows mouseup on drag release
      suppressCanvasClickRef.current = true;
      setTimeout(() => {
        suppressCanvasClickRef.current = false;
      }, 350);

      let curX = activePipe.currentX;
      let curY = activePipe.currentY;
      if (e) {
        const coords = getCanvasCoords(e.clientX, e.clientY);
        curX = Math.round(coords.x);
        curY = Math.round(coords.y);
      }

      const { sourceNodeId, sourceHandleId, startX, startY, color } = activePipe;
      const dist = Math.hypot(curX - startX, curY - startY);
      const targetNodeId = hoveredTargetNodeIdRef.current || hoveredTargetNodeId;

      if (targetNodeId && targetNodeId !== sourceNodeId) {
        // Connected to an existing node!
        setConnections(prev => {
          const existing = prev.filter(c => !(c.sourceNodeId === sourceNodeId && c.sourceHandleId === sourceHandleId && c.targetNodeId === targetNodeId));
          return [
            ...existing,
            {
              id: `conn-${Date.now()}`,
              sourceNodeId,
              sourceHandleId,
              targetNodeId,
              color,
              dashed: sourceNodeId === 'trigger' && nodes.find(n => n.id === targetNodeId)?.type === 'ai',
            }
          ];
        });
        triggerAutoSave();
      } else {
        // Unclicked on empty canvas! Open "Choose Next Step" popover right under mouse cursor!
        const menuX = dist > 15 ? curX : Math.round(startX + 40);
        const menuY = dist > 15 ? Math.max(20, curY - 10) : Math.max(20, Math.round(startY - 20));

        setNextStepMenu({
          isOpen: true,
          x: menuX,
          y: menuY,
          sourceNodeId,
          sourceHandleId,
          color,
        });
      }

      setDraggingPipe(null);
      draggingPipeRef.current = null;
      setHoveredTargetNodeId(null);
      hoveredTargetNodeIdRef.current = null;
    } else {
      if (dragStartPos.current.moved || panStartPos.current.moved) {
        suppressCanvasClickRef.current = true;
        setTimeout(() => {
          suppressCanvasClickRef.current = false;
        }, 300);
      }
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    // If a drag/drop action just completed, ignore this click
    if (suppressCanvasClickRef.current) {
      suppressCanvasClickRef.current = false;
      return;
    }

    const target = e.target as HTMLElement | null;
    if (target && (
      target.closest('[data-flow-node]') || 
      target.closest('[data-editor-drawer]') ||
      target.closest('[data-next-step-menu]') ||
      target.closest('[data-modal]')
    )) {
      return;
    }
    setSelectedNodeId(null);
    setSelectedPipeId(null);
    setShowAddMenu(false);
    setNextStepMenu(null);
  };

  // Next step selection from popover menu
  const handleSelectNextStep = (type: 'message' | 'action' | 'ai' | 'delay' | 'condition') => {
    if (!nextStepMenu) return;

    const { x, y, sourceNodeId, sourceHandleId, color } = nextStepMenu;
    const newId = `node-${Date.now()}`;

    let newNode: FlowNode;
    if (type === 'message') {
      newNode = {
        id: newId,
        type: 'message',
        title: `Step ${nodes.filter(n => n.type === 'message').length + 1}: Bot Reply`,
        content: 'Hey {{first_name}}! Thanks for confirming. What would you like to explore next?',
        buttons: ['Continue →'],
        quickReplies: ['Learn More', 'Speak to Agent'],
        x: Math.max(20, x),
        y: Math.max(20, y - 20),
        iconType: 'message',
      };
    } else if (type === 'action') {
      newNode = {
        id: newId,
        type: 'action',
        title: 'Action: Tag Contact',
        actionTags: ['AddTag: Active Lead', 'SubscribeToSequence: Nurture Series'],
        content: 'AddTag: Active Lead\nSubscribeToSequence: Nurture Series',
        x: Math.max(20, x),
        y: Math.max(20, y - 20),
        iconType: 'tag',
      };
    } else if (type === 'ai') {
      newNode = {
        id: newId,
        type: 'ai',
        title: 'AI Smart Assistant Step',
        content: 'AI automatically processes contact response and dynamically tailors next question.',
        x: Math.max(20, x),
        y: Math.max(20, y - 20),
        iconType: 'bot',
      };
    } else if (type === 'delay') {
      newNode = {
        id: newId,
        type: 'delay',
        title: 'Smart Delay Timer',
        delayText: 'Wait 1 hour before next message',
        content: 'Wait 1 hour before next step',
        x: Math.max(20, x),
        y: Math.max(20, y - 20),
        iconType: 'clock',
      };
    } else {
      newNode = {
        id: newId,
        type: 'condition',
        title: 'Condition: Tag Filter',
        conditionText: 'Contact has tag "Evergreen BAB"',
        content: 'Condition: Check if contact has tag "Evergreen BAB"',
        buttons: ['Yes (Match)', 'No (Otherwise)'],
        x: Math.max(20, x),
        y: Math.max(20, y - 20),
        iconType: 'workflow',
      };
    }

    setNodes(prev => [...prev, newNode]);

    // Establish pipe connection to new node!
    setConnections(prev => [
      ...prev,
      {
        id: `conn-${Date.now()}`,
        sourceNodeId,
        sourceHandleId,
        targetNodeId: newId,
        color,
      }
    ]);

    setNextStepMenu(null);
    setSelectedNodeId(null);
    triggerAutoSave();
  };

  const handleDeleteConnection = (connId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setConnections(prev => prev.filter(c => c.id !== connId));
    if (selectedPipeId === connId) {
      setSelectedPipeId(null);
    }
  };

  const updateSelectedNode = (updates: Partial<FlowNode>) => {
    if (!selectedNodeId) return;
    triggerAutoSave();
    setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, ...updates } : n));
  };

  const handleAddTrigger = (template: TriggerTemplate) => {
    triggerAutoSave();
    // Target the selected trigger node, or the first trigger node in the flow
    const triggerNode = (selectedNodeId && nodes.find(n => n.id === selectedNodeId && n.type === 'trigger')) 
      || nodes.find(n => n.type === 'trigger');

    if (!triggerNode) {
      setShowTriggerModal(false);
      return;
    }

    const newTrigger: FlowTrigger = {
      id: `trig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: template.type,
      channel: template.channel,
      title: template.title,
      enabled: true,
      description: template.description,
      keywords: template.defaultConfig?.keywords || ['START', 'BOT'],
      matchRule: template.defaultConfig?.matchRule || 'contains',
      keywordMode: template.defaultConfig?.keywordMode || 'keywords',
      adPayloadKeyword: template.defaultConfig?.adPayloadKeyword || (template.defaultConfig?.keywords ? template.defaultConfig.keywords[0] : 'START'),
      ...template.defaultConfig
    };

    setNodes(prev => prev.map(n => {
      if (n.id === triggerNode.id) {
        const existing = n.triggers || [];
        return {
          ...n,
          triggers: [...existing, newTrigger]
        };
      }
      return n;
    }));

    setShowTriggerModal(false);
  };

  const handleToggleTrigger = (triggerId: string) => {
    triggerAutoSave();
    setNodes(prev => prev.map(n => {
      if (n.type === 'trigger' && n.triggers) {
        return {
          ...n,
          triggers: n.triggers.map(t => t.id === triggerId ? { ...t, enabled: !t.enabled } : t)
        };
      }
      return n;
    }));
  };

  const deleteSelectedNode = (id: string) => {
    triggerAutoSave();
    setNodes(prev => prev.filter(n => n.id !== id));
    setConnections(prev => prev.filter(c => c.sourceNodeId !== id && c.targetNodeId !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const toggleLiveStatus = () => {
    const nextState = !isLive;
    setIsLive(nextState);
    setShowLiveToast(true);
    setTimeout(() => {
      setShowLiveToast(false);
    }, 3800);
  };

  const handleAddBotStep = (type: 'message' | 'ai' | 'action' | 'delay' | 'rn_optin' | 'otn_optin' | 'wa_template') => {
    setShowAddMenu(false);
    triggerAutoSave();
    const newId = `node-${Date.now()}`;
    const nextX = 420 + ((nodes.length % 3) * 60);
    const nextY = 220 + ((nodes.length % 4) * 80);

    let newNode: FlowNode;
    if (type === 'message') {
      newNode = {
        id: newId,
        type: 'message',
        title: `Step ${nodes.filter(n => n.type === 'message').length + 1}: Bot Reply`,
        content: 'Hey {{first_name}}! Here is the info you requested. Click below to continue! 👇',
        buttons: ['Continue →'],
        quickReplies: ['Yes', 'No'],
        x: nextX,
        y: nextY,
        iconType: 'message'
      };
    } else if (type === 'rn_optin') {
      newNode = {
        id: newId,
        type: 'message',
        title: `Step ${nodes.filter(n => n.type === 'message').length + 1}: Recurring Notification Opt-In`,
        content: 'Want insider deals, VIP alerts, and weekly drops delivered right here?',
        components: [
          {
            id: `comp-rn-${Date.now()}`,
            type: 'recurring_notification_optin',
            rnTopic: 'VIP Weekly Drops & Deals',
            rnFrequency: 'weekly',
            rnTitle: 'Get VIP Weekly Drops & Flash Sale Alerts',
            rnButtonText: 'Get Updates',
          }
        ],
        buttons: ['Maybe Later'],
        quickReplies: ['Frequency Info', 'Privacy Policy'],
        x: nextX,
        y: nextY,
        iconType: 'message'
      };
    } else if (type === 'otn_optin') {
      newNode = {
        id: newId,
        type: 'message',
        title: `Step ${nodes.filter(n => n.type === 'message').length + 1}: One-Time Notification (OTN)`,
        content: 'This item or webinar is currently full. Would you like a one-time ping when space opens up?',
        components: [
          {
            id: `comp-otn-${Date.now()}`,
            type: 'one_time_notification_optin',
            otnTopic: 'Back in Stock / VIP Replay',
            otnButtonText: 'Notify Me',
          }
        ],
        buttons: ['Browse Catalog'],
        quickReplies: ['Notify Me', 'Skip'],
        x: nextX,
        y: nextY,
        iconType: 'message'
      };
    } else if (type === 'wa_template') {
      newNode = {
        id: newId,
        type: 'message',
        title: `Step ${nodes.filter(n => n.type === 'message').length + 1}: WhatsApp Utility Template`,
        content: '',
        messageTag: 'POST_PURCHASE_UPDATE',
        components: [
          {
            id: `comp-wa-${Date.now()}`,
            type: 'whatsapp_template',
            waTemplateName: 'order_status_update_v1',
            waCategory: 'UTILITY',
            waHeader: 'Order Confirmation #{{1}}',
            waBody: 'Hi {{2}}, your order #{{1}} is confirmed and preparing for shipment. Tap below to track real-time delivery.',
            waVariables: ['12049', 'Alex']
          }
        ],
        buttons: ['Track Order 📦'],
        quickReplies: ['Change Address', 'Customer Support'],
        x: nextX,
        y: nextY,
        iconType: 'message'
      };
    } else if (type === 'ai') {
      newNode = {
        id: newId,
        type: 'ai',
        title: 'AI Knowledge Base Agent',
        content: 'Gemini AI automatically handles answers to FAQs and routes qualified leads.',
        x: nextX,
        y: nextY,
        iconType: 'bot'
      };
    } else if (type === 'action') {
      newNode = {
        id: newId,
        type: 'action',
        title: 'CRM Action: Tag & Notify',
        actionTags: ['AddTag: Interested Lead', 'SendNotification: Admin'],
        content: 'AddTag: Interested Lead\nSendNotification: Admin',
        x: nextX,
        y: nextY,
        iconType: 'tag'
      };
    } else {
      newNode = {
        id: newId,
        type: 'delay',
        title: 'Smart Delay',
        delayText: 'Wait 15 minutes before next step',
        content: 'Wait 15 minutes before sending follow-up message',
        x: nextX,
        y: nextY,
        iconType: 'clock'
      };
    }

    setNodes(prev => [...prev, newNode]);
  };

  /* ------------------------------------------------------------------ */
  /* Canvas toolbar pieces (extracted so the header can lay them out     */
  /* responsively: one row on xl screens, two rows below).               */
  /* ------------------------------------------------------------------ */
  const renderModeSwitcher = () => (
    <div className="hidden sm:flex items-center bg-slate-900/90 border border-white/10 p-0.5 sm:p-1 rounded-xl shadow-inner flex-shrink-0">
      <ModeButton
        active={aiMode === 'manual'}
        onClick={() => setAiMode('manual')}
        icon={<MousePointer2 className="w-3.5 h-3.5" />}
        label="Flow Canvas"
        shortLabel="Canvas"
      />
      <ModeButton
        active={aiMode === 'copilot'}
        onClick={() => setAiMode('copilot')}
        icon={<Sparkles className="w-3.5 h-3.5 text-cyan-400" />}
        label="AI Copilot"
        shortLabel="Copilot"
      />
      <ModeButton
        active={aiMode === 'auto'}
        onClick={() => setAiMode('auto')}
        icon={<Bot className="w-3.5 h-3.5 text-blue-400" />}
        label="Auto-Build"
        shortLabel="Auto"
      />
    </div>
  );

  const renderAutoSave = () => (
    <div
      className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-slate-900/90 border border-white/10 text-[10px] sm:text-xs shadow-sm transition-all flex-shrink-0"
      title="All changes save automatically to Firestore in real time"
    >
      {saveStatus === 'saving' ? (
        <>
          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-cyan-400 animate-ping flex-shrink-0" />
          <span className="text-cyan-400 font-medium text-[10px] sm:text-xs hidden lg:inline whitespace-nowrap">Saving...</span>
        </>
      ) : (
        <>
          <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="text-emerald-400 font-semibold text-[10px] sm:text-xs hidden lg:inline whitespace-nowrap">Auto-saved</span>
        </>
      )}
    </div>
  );

  const renderZoomControls = () => (
    <div className="hidden sm:flex bg-slate-900/90 border border-white/10 p-0.5 sm:p-1 rounded-xl items-center gap-0.5 text-slate-300 flex-shrink-0">
      <button
        onClick={() => setZoomLevel(prev => Math.max(0.25, Number((prev - 0.1).toFixed(2))))}
        className="p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white cursor-pointer"
        title="Zoom Out"
      >
        <Minus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => {
          setZoomLevel(1);
          setPanOffset({ x: 0, y: 0 });
        }}
        className="text-[10px] sm:text-xs font-mono px-1 sm:px-1.5 font-semibold text-slate-300 hover:text-cyan-300 min-w-[28px] sm:min-w-[34px] text-center select-none transition-colors cursor-pointer"
        title="Click to reset to 100%"
      >
        {Math.round(zoomLevel * 100)}%
      </button>
      <button
        onClick={() => setZoomLevel(prev => Math.min(2.5, Number((prev + 0.1).toFixed(2))))}
        className="p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white cursor-pointer"
        title="Zoom In"
      >
        <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
      </button>
      <div className="w-px h-3 sm:h-3.5 bg-white/10 mx-0.5" />
      <button
        onClick={() => {
          setZoomLevel(1);
          setPanOffset({ x: 0, y: 0 });
        }}
        className="p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white inline-flex cursor-pointer"
        title="Reset View & Recenter (100%)"
      >
        <Maximize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
      </button>
    </div>
  );

  const renderAuditButton = () => (
    <button
      onClick={() => setShowMetaPolicyModal(true)}
      className="px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:text-blue-200 rounded-xl text-[10px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all shadow-sm cursor-pointer flex-shrink-0 whitespace-nowrap"
      title="Scan Flow for Meta 24-Hour Messaging Policy, Message Tags & Opt-In Permissions"
    >
      <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-400 flex-shrink-0" />
      <span className="hidden md:inline">24h Policy Audit</span>
      <span className="hidden xs:inline md:hidden">Audit</span>
    </button>
  );

  const renderTestButton = () => (
    <button
      onClick={() => setShowSimulator(true)}
      className="px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white rounded-xl text-[10px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all shadow-sm cursor-pointer flex-shrink-0 whitespace-nowrap"
      title="Interactive Phone Preview Simulator"
    >
      <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400 fill-cyan-400 flex-shrink-0" />
      <span className="hidden md:inline">Test Flow</span>
      <span className="hidden xs:inline md:hidden">Test</span>
    </button>
  );

  return (
    <div className="flex-1 w-full h-full relative overflow-hidden bg-[#080d1a] flex flex-col select-none">
      
      {/* Canvas Top Bar Header — responsive: single row on xl screens, tools wrap to a second row below */}
      <div className="bg-slate-950/90 backdrop-blur-xl border-b border-white/10 z-30 flex-shrink-0 shadow-xl w-full min-w-0">
      {/* Row 1: identity + primary actions */}
      <div className="h-14 px-2 sm:px-3 lg:px-4 flex items-center justify-between gap-1 sm:gap-2 w-full min-w-0">
        
        {/* Left: Flow Name, Status Badge & Mobile Mode Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-shrink">
          {onBackToBotList && (
            <button
              onClick={onBackToBotList}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 hover:border-cyan-500/30 text-xs font-bold transition-all cursor-pointer flex-shrink-0"
              title="Return to Bot List"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Bot List</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
              <Workflow className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            
            {isEditingTitle ? (
              <input 
                type="text" 
                value={flowTitle} 
                onChange={(e) => {
                  setFlowTitle(e.target.value);
                  onUpdateBotTitle?.(e.target.value);
                }}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                autoFocus
                className="bg-slate-900 border border-blue-500 rounded-lg px-2 py-0.5 sm:py-1 text-xs sm:text-sm font-bold text-white outline-none w-24 xs:w-32 sm:w-44 max-w-[200px]"
              />
            ) : (
              <div 
                onClick={() => setIsEditingTitle(true)}
                className="flex items-center gap-1 sm:gap-1.5 group cursor-pointer hover:bg-white/5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg transition-colors min-w-0"
                title="Click to rename flow"
              >
                <span className="font-bold text-xs sm:text-sm text-white truncate max-w-[75px] xs:max-w-[110px] sm:max-w-[150px] md:max-w-[190px] lg:max-w-[250px] xl:max-w-[320px]">
                  {flowTitle}
                </span>
                <Pencil className="w-3 h-3 text-slate-500 group-hover:text-slate-300 flex-shrink-0" />
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-white/10 mx-0.5 hidden md:block flex-shrink-0" />

          {/* Status Badge */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isLive ? (
              <span className="flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="hidden xl:inline">Live on 3 Channels</span>
                <span className="xl:hidden">Live</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-slate-800 text-slate-400 border border-white/10 whitespace-nowrap">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-400" />
                <span>Draft</span>
              </span>
            )}
          </div>

          {/* Mobile-only compact mode toggle button (< sm viewports) */}
          <div className="sm:hidden flex-shrink-0">
            <button
              onClick={() => {
                if (aiMode === 'manual') setAiMode('copilot');
                else if (aiMode === 'copilot') setAiMode('auto');
                else setAiMode('manual');
              }}
              className={`p-1.5 rounded-xl border text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                aiMode === 'manual'
                  ? 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
                  : aiMode === 'copilot'
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                  : 'bg-blue-500/20 border-blue-500/40 text-blue-300'
              }`}
              title={`Mode: ${aiMode === 'manual' ? 'Canvas' : aiMode === 'copilot' ? 'AI Copilot' : 'Auto-Build'} (Tap to switch)`}
            >
              {aiMode === 'manual' && <MousePointer2 className="w-3.5 h-3.5" />}
              {aiMode === 'copilot' && <Sparkles className="w-3.5 h-3.5 text-cyan-400" />}
              {aiMode === 'auto' && <Bot className="w-3.5 h-3.5 text-blue-400" />}
            </button>
          </div>
        </div>

        {/* Right: tools inline on xl, primary actions on every screen */}
        <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-shrink-0">
          <div className="hidden xl:flex items-center gap-1.5 md:gap-2 flex-shrink-0">
            {renderModeSwitcher()}
            {renderAutoSave()}
            {renderZoomControls()}
            {renderAuditButton()}
          </div>

          {renderTestButton()}

          {/* + Add Bot Component Dropdown */}
          <div className="relative flex-shrink-0">
            <button 
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="px-2 sm:px-2.5 md:px-3.5 py-1 sm:py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-[10px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all shadow-lg shadow-blue-500/20 cursor-pointer whitespace-nowrap"
              title="Add Bot Component"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="hidden md:inline">Add Bot</span>
              <span className="hidden xs:inline md:hidden">Add</span>
              <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-70 flex-shrink-0" />
            </button>

            {/* Dropdown Menu for + Add Bot */}
            {showAddMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-white/15 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 divide-y divide-white/5">
                <div className="space-y-0.5 pb-1">
                  <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Standard Steps (24h Window)
                  </div>
                  <button 
                    onClick={() => handleAddBotStep('message')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white hover:bg-blue-600/20 rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">Bot Message Step</div>
                      <div className="text-[10px] text-slate-400">Response with buttons & cards</div>
                    </div>
                  </button>
                  <button 
                    onClick={() => handleAddBotStep('ai')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white hover:bg-cyan-600/20 rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <Bot className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">AI Assistant Agent</div>
                      <div className="text-[10px] text-slate-400">Smart FAQ & intent answering</div>
                    </div>
                  </button>
                  <button 
                    onClick={() => handleAddBotStep('action')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white hover:bg-amber-600/20 rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <Tag className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">Action & Tags</div>
                      <div className="text-[10px] text-slate-400">CRM tag, subscribe sequence</div>
                    </div>
                  </button>
                  <button 
                    onClick={() => handleAddBotStep('delay')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white hover:bg-purple-600/20 rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <Clock className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">Smart Delay</div>
                      <div className="text-[10px] text-slate-400">Wait minutes/hours before step</div>
                    </div>
                  </button>
                </div>

                {/* Meta Compliant Post-24h Permissions */}
                <div className="space-y-0.5 pt-1.5">
                  <div className="px-3 py-1 text-[10px] uppercase font-bold text-cyan-400 tracking-wider flex items-center justify-between">
                    <span>Meta Post-24h APIs</span>
                    <span className="text-[9px] font-mono text-slate-400">Permissions</span>
                  </div>
                  <button 
                    onClick={() => handleAddBotStep('rn_optin')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white hover:bg-cyan-600/20 rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <BellRing className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <div>
                      <div className="font-semibold flex items-center gap-1.5">
                        <span>Recurring Notification</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">RN API</span>
                      </div>
                      <div className="text-[10px] text-slate-400">Collect opt-in for marketing outside 24h</div>
                    </div>
                  </button>
                  <button 
                    onClick={() => handleAddBotStep('otn_optin')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white hover:bg-purple-600/20 rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <Zap className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <div>
                      <div className="font-semibold flex items-center gap-1.5">
                        <span>One-Time Notification</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">OTN</span>
                      </div>
                      <div className="text-[10px] text-slate-400">Ask permission for single re-engagement</div>
                    </div>
                  </button>
                  <button 
                    onClick={() => handleAddBotStep('wa_template')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white hover:bg-emerald-600/20 rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <div>
                      <div className="font-semibold flex items-center gap-1.5">
                        <span>WhatsApp Template</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">Official</span>
                      </div>
                      <div className="text-[10px] text-slate-400">Utility or marketing template</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* + Go Live overlay button */}
          <button 
            onClick={toggleLiveStatus}
            className={`px-2 sm:px-2.5 md:px-3.5 py-1 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all shadow-lg cursor-pointer flex-shrink-0 whitespace-nowrap ${
              isLive 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/30' 
                : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/20'
            }`}
            title={isLive ? "Flow is Live (click to pause)" : "Click to publish and Go Live"}
          >
            {isLive ? (
              <>
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white animate-ping flex-shrink-0" />
                <span className="hidden md:inline">Live Active</span>
                <span className="md:hidden">Live</span>
              </>
            ) : (
              <>
                <Radio className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                <span className="hidden md:inline">+ Go Live</span>
                <span className="md:hidden">Live</span>
              </>
            )}
          </button>
        </div>
      </div>
      {/* Row 2: tools move here on screens below xl so nothing gets cut off */}
      <div className="xl:hidden flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 pb-2 overflow-x-auto min-w-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {renderModeSwitcher()}
        {renderAutoSave()}
        {renderZoomControls()}
        {renderAuditButton()}
      </div>
      </div>

      {/* Live Toast Banner */}
      {showLiveToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-slate-900 border border-emerald-500/40 text-white px-5 py-2.5 rounded-2xl shadow-2xl z-50 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className={`w-3 h-3 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-xs font-medium">
            {isLive 
              ? '🚀 Flow is now LIVE! Actively listening on Instagram, Messenger & WhatsApp.' 
              : '⏸️ Flow set to Draft mode. Bot responses paused for editing.'}
          </span>
          <button onClick={() => setShowLiveToast(false)} className="text-slate-400 hover:text-white ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Canvas Workspace Area (Full Pan & Zoom support) */}
      <div 
        ref={canvasContainerRef}
        className={`flex-1 w-full h-full relative overflow-hidden select-none ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`} 
        style={{ 
          touchAction: 'none',
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.09) 1.5px, transparent 0)', 
          backgroundSize: '28px 28px',
          backgroundPosition: `${panOffset.x}px ${panOffset.y}px`,
          backgroundColor: '#080d1a'
        }} 
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onClick={handleCanvasClick}
      >
        <div 
          ref={canvasContentRef}
          className="w-full h-full relative transform-gpu origin-top-left"
          style={{ 
            transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomLevel})`,
            transformOrigin: '0 0',
            willChange: isPanning || draggingNode ? 'transform' : 'auto'
          }}
        >
          {/* Connecting Bezier Lines */}
          <svg className="absolute top-0 left-0 w-[8000px] h-[8000px] pointer-events-none z-0 overflow-visible">
            <defs>
              <filter id="pipe-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#38bdf8" floodOpacity="0.7"/>
              </filter>
            </defs>

            {/* Render established dynamic connections */}
            {connections.map((c) => {
              const sNode = nodeMap.get(c.sourceNodeId);
              const tNode = nodeMap.get(c.targetNodeId);
              if (!sNode || !tNode) return null;

              const startPt = getHandlePoint(sNode, 'out', c.sourceHandleId);
              const endPt = getHandlePoint(tNode, 'in');
              const dx = Math.max(50, Math.min(220, Math.abs(endPt.x - startPt.x) * 0.55));
              const pathD = `M ${startPt.x} ${startPt.y} C ${startPt.x + dx} ${startPt.y}, ${endPt.x - dx} ${endPt.y}, ${endPt.x} ${endPt.y}`;
              const isHovered = hoveredPipeId === c.id;
              const isSelected = selectedPipeId === c.id;
              const strokeColor = c.color || '#3b82f6';

              return (
                <g key={c.id} className="group">
                  {/* Invisible wide hit area for easy hover & selection */}
                  <path 
                    d={pathD}
                    fill="none" 
                    stroke="transparent" 
                    strokeWidth="24"
                    style={{ pointerEvents: 'stroke' }}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredPipeId(c.id)}
                    onMouseLeave={() => setHoveredPipeId(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPipeId(c.id);
                    }}
                  />

                  {/* Glow backdrop when hovered or selected */}
                  {(isHovered || isSelected) && (
                    <path 
                      d={pathD}
                      fill="none" 
                      stroke={strokeColor} 
                      strokeWidth="8"
                      strokeOpacity="0.3"
                    />
                  )}

                  {/* Main connection line */}
                  <path 
                    d={pathD}
                    fill="none" 
                    stroke={strokeColor} 
                    strokeWidth={isSelected || isHovered ? "3.5" : "2.5"} 
                    strokeDasharray={c.dashed ? "6,6" : undefined}
                    filter={isSelected ? "url(#pipe-glow)" : undefined}
                  />

                  {/* Start anchor dot */}
                  <circle cx={startPt.x} cy={startPt.y} r="3.5" fill={strokeColor} />
                  {/* End anchor dot */}
                  <circle cx={endPt.x} cy={endPt.y} r="3.5" fill={strokeColor} />
                </g>
              );
            })}

            {/* Active dragging pipe (rubberband sliding out) */}
            {draggingPipe && (() => {
              const targetPt = hoveredTargetNodeId 
                ? getHandlePoint(nodes.find(n => n.id === hoveredTargetNodeId)!, 'in')
                : { x: draggingPipe.currentX, y: draggingPipe.currentY };
              const dx = Math.max(50, Math.min(220, Math.abs(targetPt.x - draggingPipe.startX) * 0.55));
              const d = `M ${draggingPipe.startX} ${draggingPipe.startY} C ${draggingPipe.startX + dx} ${draggingPipe.startY}, ${targetPt.x - dx} ${targetPt.y}, ${targetPt.x} ${targetPt.y}`;
              
              return (
                <g>
                  {/* Ambient Glow */}
                  <path 
                    d={d}
                    fill="none" 
                    stroke={draggingPipe.color} 
                    strokeWidth="8"
                    strokeOpacity="0.25"
                  />
                  {/* Animated Dashed Line */}
                  <path 
                    d={d}
                    fill="none" 
                    stroke={draggingPipe.color} 
                    strokeWidth="3"
                    strokeDasharray="8,6"
                    className="animate-flow-dash"
                  />
                  {/* Origin pin circle */}
                  <circle cx={draggingPipe.startX} cy={draggingPipe.startY} r="4" fill={draggingPipe.color} />
                  {/* Destination tip with radar ping */}
                  <circle 
                    cx={targetPt.x} 
                    cy={targetPt.y} 
                    r="5" 
                    fill={draggingPipe.color} 
                    stroke="#ffffff" 
                    strokeWidth="2" 
                  />
                  <circle 
                    cx={targetPt.x} 
                    cy={targetPt.y} 
                    r="12" 
                    fill="none" 
                    stroke={draggingPipe.color} 
                    strokeWidth="1.5" 
                    className="animate-ping opacity-60" 
                  />
                </g>
              );
            })()}

            {/* Live rubberband line connecting origin pin to the open Next Step menu */}
            {nextStepMenu && (() => {
              const sNode = nodes.find(n => n.id === nextStepMenu.sourceNodeId);
              if (!sNode) return null;
              const startPt = getHandlePoint(sNode, 'out', nextStepMenu.sourceHandleId);
              const targetPt = { x: nextStepMenu.x, y: nextStepMenu.y + 24 };
              const dx = Math.max(40, Math.min(180, Math.abs(targetPt.x - startPt.x) * 0.5));
              const d = `M ${startPt.x} ${startPt.y} C ${startPt.x + dx} ${startPt.y}, ${targetPt.x - dx} ${targetPt.y}, ${targetPt.x} ${targetPt.y}`;
              return (
                <g>
                  <path 
                    d={d}
                    fill="none" 
                    stroke={nextStepMenu.color || '#3b82f6'} 
                    strokeWidth="3" 
                    strokeDasharray="6,4" 
                    className="animate-flow-dash" 
                  />
                  <circle cx={startPt.x} cy={startPt.y} r="4" fill={nextStepMenu.color || '#3b82f6'} />
                  <circle cx={targetPt.x} cy={targetPt.y} r="4.5" fill={nextStepMenu.color || '#3b82f6'} stroke="#ffffff" strokeWidth="2" />
                </g>
              );
            })()}
          </svg>

          {/* Interactive Midpoint Delete Pill for Hovered / Selected Pipe */}
          {connections.map((c) => {
            const sNode = nodes.find(n => n.id === c.sourceNodeId);
            const tNode = nodes.find(n => n.id === c.targetNodeId);
            if (!sNode || !tNode) return null;

            const startPt = getHandlePoint(sNode, 'out', c.sourceHandleId);
            const endPt = getHandlePoint(tNode, 'in');
            const dx = Math.max(50, Math.min(220, Math.abs(endPt.x - startPt.x) * 0.55));
            const mid = getBezierMidpoint(startPt, endPt, dx);
            const isHovered = hoveredPipeId === c.id;
            const isSelected = selectedPipeId === c.id;

            if (!isHovered && !isSelected) return null;

            return (
              <div 
                key={`ctrl-${c.id}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-30 flex items-center gap-1.5 bg-slate-900/95 border border-white/20 rounded-full px-2.5 py-1 shadow-2xl backdrop-blur-md"
                style={{ left: mid.x, top: mid.y }}
                onMouseEnter={() => setHoveredPipeId(c.id)}
                onMouseLeave={() => setHoveredPipeId(null)}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Link2 className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] font-bold text-slate-300">Piping</span>
                <button
                  onClick={(e) => handleDeleteConnection(c.id, e)}
                  className="p-1 text-rose-400 hover:text-white hover:bg-rose-500/30 rounded-full transition-colors"
                  title="Disconnect / Remove Pipe"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {/* Live Dragging Tip Helper Pill */}
          {draggingPipe && (
            <div 
              className="absolute pointer-events-none z-30 -translate-y-8 bg-slate-900/95 border border-blue-500/50 text-white text-[11px] font-medium px-3 py-1.5 rounded-xl shadow-2xl whitespace-nowrap flex items-center gap-1.5"
              style={{ 
                left: draggingPipe.currentX + 18, 
                top: draggingPipe.currentY 
              }}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>{hoveredTargetNodeId ? 'Release to connect step' : 'Release to choose next step'}</span>
            </div>
          )}

          {/* "Next Step" Popup Menu (Anchored at pipe drop location) */}
          {nextStepMenu && (
            <div 
              data-next-step-menu="true"
              className="absolute z-40 bg-slate-900/95 border border-white/20 rounded-2xl p-2.5 shadow-2xl backdrop-blur-xl w-64 animate-in fade-in zoom-in-95 duration-150"
              style={{ left: nextStepMenu.x, top: nextStepMenu.y }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-2 pb-2 mb-1.5 border-b border-white/10">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Choose Next Step</span>
                </div>
                <button 
                  onClick={() => setNextStepMenu(null)}
                  className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1">
                <button 
                  onClick={() => handleSelectNextStep('message')}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-blue-600/20 group transition-all cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-blue-300">Send Message</div>
                    <div className="text-[10px] text-slate-400">Text, buttons & quick replies</div>
                  </div>
                </button>

                <button 
                  onClick={() => handleSelectNextStep('action')}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-amber-600/20 group transition-all cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-amber-300">Perform Action</div>
                    <div className="text-[10px] text-slate-400">Add tags, subscribe sequence</div>
                  </div>
                </button>

                <button 
                  onClick={() => handleSelectNextStep('ai')}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-cyan-600/20 group transition-all cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-cyan-300">AI Assistant Step</div>
                    <div className="text-[10px] text-slate-400">Antigravity AI agent answer</div>
                  </div>
                </button>

                <button 
                  onClick={() => handleSelectNextStep('delay')}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-purple-600/20 group transition-all cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-purple-300">Smart Delay</div>
                    <div className="text-[10px] text-slate-400">Wait minutes/hours before step</div>
                  </div>
                </button>

                <button 
                  onClick={() => handleSelectNextStep('condition')}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-emerald-600/20 group transition-all cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                    <Workflow className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-emerald-300">Condition</div>
                    <div className="text-[10px] text-slate-400">Split path based on tag/data</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Flow Nodes on Canvas */}
          {nodes.map(node => (
            <div 
              key={node.id}
              data-flow-node={node.id}
              className="absolute select-none z-10 cursor-move"
              style={{ left: node.x, top: node.y }}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id, node.x, node.y)}
              onMouseUp={(e) => handleNodeMouseUp(e, node.id)}
              onClick={(e) => {
                e.stopPropagation();
                if (dragStartPos.current.moved) return;
                setSelectedNodeId(node.id);
              }}
            >
              <NodeCard 
                node={node}
                selected={selectedNodeId === node.id}
                onSelect={() => setSelectedNodeId(node.id)}
                onStartConnect={(e, handleId, defaultColor) => handleStartConnect(e, node.id, handleId, defaultColor)}
                isTargetHovered={hoveredTargetNodeId === node.id}
                connectedOutputHandles={connectedHandlesMap[node.id] || EMPTY_HANDLES_ARRAY}
                outsideInfo={outsideInfoMap[node.id] || DEFAULT_OUTSIDE_INFO}
                onRegisterPin={registerPinOffset}
                nodes={nodes}
                connections={connections}
                onOpenTriggerModal={() => {
                  setSelectedNodeId(node.id);
                  setShowTriggerModal(true);
                }}
                onToggleTrigger={handleToggleTrigger}
              />
            </div>
          ))}
        </div>

        {/* Floating Quick Action Dock on Canvas */}
        <div 
          className="absolute bottom-3 sm:bottom-6 left-2 sm:left-6 z-20 flex items-center gap-1 sm:gap-1.5 bg-slate-900/95 backdrop-blur-xl border border-white/10 p-1 sm:p-1.5 rounded-2xl shadow-2xl max-w-[calc(100vw-16px)] overflow-x-auto no-scrollbar"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => handleAddBotStep('message')}
            className="px-2 sm:px-3 py-1 sm:py-1.5 hover:bg-white/10 rounded-xl text-[11px] sm:text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1 sm:gap-1.5 transition-colors whitespace-nowrap"
            title="Add new Bot Message"
          >
            <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-400 flex-shrink-0" />
            <span>Message</span>
          </button>
          <button 
            onClick={() => handleAddBotStep('action')}
            className="px-2 sm:px-3 py-1 sm:py-1.5 hover:bg-white/10 rounded-xl text-[11px] sm:text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1 sm:gap-1.5 transition-colors whitespace-nowrap"
            title="Add new Action Tag"
          >
            <Tag className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 flex-shrink-0" />
            <span>Action</span>
          </button>
          <button 
            onClick={() => handleAddBotStep('ai')}
            className="px-2 sm:px-3 py-1 sm:py-1.5 hover:bg-white/10 rounded-xl text-[11px] sm:text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1 sm:gap-1.5 transition-colors whitespace-nowrap"
            title="Add AI Fallback Agent"
          >
            <Bot className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400 flex-shrink-0" />
            <span>AI Agent</span>
          </button>
          <div className="w-px h-3.5 sm:h-4 bg-white/10 mx-0.5" />
          <button 
            onClick={() => {
              setPanOffset({ x: 0, y: 0 });
              setZoomLevel(1);
            }}
            className="px-2 sm:px-2.5 py-1 sm:py-1.5 hover:bg-white/10 rounded-xl text-[11px] sm:text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1 sm:gap-1.5 transition-colors whitespace-nowrap"
            title="Recenter view and reset zoom"
          >
            <Move className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 flex-shrink-0" />
            <span className="hidden sm:inline">Recenter</span>
          </button>
          <div className="w-px h-3.5 sm:h-4 bg-white/10 mx-0.5" />
          <button 
            onClick={toggleLiveStatus}
            className="px-2 sm:px-3 py-1 sm:py-1.5 hover:bg-white/10 rounded-xl text-[11px] sm:text-xs font-semibold text-emerald-400 flex items-center gap-1 sm:gap-1.5 transition-colors whitespace-nowrap"
            title="Toggle Live"
          >
            <Radio className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
            <span>{isLive ? 'Pause' : '+ Go Live'}</span>
          </button>
        </div>
      </div>

      {/* Left Drawer for AI Copilot or Auto Build */}
      {aiMode !== 'manual' && (
        <div className="absolute top-16 left-2 sm:left-4 bottom-4 w-[calc(100vw-16px)] sm:w-80 max-w-[calc(100vw-16px)] bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-4 sm:p-5 flex flex-col pointer-events-auto z-20 shadow-2xl transition-all duration-300">
          {aiMode === 'copilot' && (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold flex items-center gap-2 text-cyan-400 text-sm">
                  <Sparkles className="w-4 h-4" /> ChatMize Copilot
                </h3>
                <button onClick={() => setAiMode('manual')} className="text-slate-400 hover:text-white text-xs">Close</button>
              </div>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Ask Gemini to suggest next steps, write persuasive message copy, or add conditional branches.
              </p>
              
              <div className="flex-1 border border-white/10 rounded-2xl bg-slate-950/60 p-3 mb-3 overflow-y-auto space-y-2.5 text-xs">
                <div className="bg-cyan-500/10 text-cyan-100 p-3 rounded-2xl rounded-tl-none border border-cyan-500/20 leading-relaxed">
                  I reviewed your <span className="font-semibold text-white">Step 1</span> welcome message. Would you like me to generate a 15-minute reminder sequence if they don't click the "Yes I Am" button?
                </div>
              </div>

              <div className="relative">
                <input 
                  type="text" 
                  placeholder="e.g. Add 24h follow-up step..." 
                  className="w-full bg-slate-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-500 transition-colors pr-10" 
                />
                <button className="absolute right-2 top-2 p-1.5 bg-cyan-500 hover:bg-cyan-400 rounded-lg text-white transition-colors">
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {aiMode === 'auto' && (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold flex items-center gap-2 text-blue-400 text-sm">
                  <Bot className="w-4 h-4" /> AI Auto-Build
                </h3>
                <button onClick={() => setAiMode('manual')} className="text-slate-400 hover:text-white text-xs">Close</button>
              </div>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Describe your entire campaign goal or funnel, and AI will construct the full multi-node journey automatically.
              </p>
              
              <textarea 
                placeholder="e.g. Build an automated webinar registration with VIP upsell and instant calendar booking..." 
                className="w-full h-32 bg-slate-950 border border-white/20 rounded-2xl p-3.5 text-xs text-white outline-none focus:border-blue-500 transition-colors mb-4 resize-none leading-relaxed"
              />

              <button className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all">
                <Sparkles className="w-4 h-4" /> Generate Full Flow
              </button>
            </div>
          )}
        </div>
      )}

      {/* Right Sliding Inspector Drawer (Anchored below the top bar so buttons never get covered) */}
      <div 
        ref={editorDrawerRef}
        data-editor-drawer="true"
        className={`absolute right-0 top-14 bottom-0 w-full sm:w-[420px] max-w-full sm:max-w-[90vw] bg-slate-950/95 backdrop-blur-2xl border-l border-white/10 p-3.5 sm:p-5 flex flex-col transition-transform duration-150 ease-out z-40 shadow-2xl ${
          selectedNodeId ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {(selectedNode || cachedEditorNode) && (
          <NodeEditor 
            node={(selectedNode || cachedEditorNode)!} 
            nodes={nodes}
            connections={connections}
            outsideInfo={outsideInfoMap[(selectedNode || cachedEditorNode)!.id] || DEFAULT_OUTSIDE_INFO}
            onDeleteConnection={handleDeleteConnection}
            onStartConnect={(e, handleId, defaultColor) => handleStartConnect(e, (selectedNode || cachedEditorNode)!.id, handleId, defaultColor)}
            onUpdate={updateSelectedNode}
            onUpdateNode={(nodeId, updates) => {
              setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...updates } : n));
            }}
            onDelete={() => deleteSelectedNode((selectedNode || cachedEditorNode)!.id)}
            onClose={() => setSelectedNodeId(null)} 
            onNavigateToIntegrations={onNavigateToIntegrations}
            onNavigateToDocs={onNavigateToDocs}
            onOpenTriggerModal={() => setShowTriggerModal(true)}
            onToggleTrigger={handleToggleTrigger}
          />
        )}
      </div>

      {/* Interactive Mobile Phone Simulator Modal */}
      {showSimulator && (
        <div data-modal="true">
          <PhoneSimulator 
            nodes={nodes}
            connections={connections}
            onClose={() => setShowSimulator(false)}
          />
        </div>
      )}

      {/* Trigger Selector Modal for Omnichannel Entry Points */}
      {showTriggerModal && (
        <TriggerSelectorModal
          isOpen={showTriggerModal}
          onClose={() => setShowTriggerModal(false)}
          onSelectTrigger={handleAddTrigger}
          onOpenGuide={(guideId) => {
            setShowTriggerModal(false);
            if (onNavigateToDocs) onNavigateToDocs(guideId);
          }}
        />
      )}

      {/* Meta 24-Hour Messaging Policy Audit Modal */}
      {showMetaPolicyModal && (
        <MetaPolicyModal 
          onClose={() => setShowMetaPolicyModal(false)}
          nodes={nodes}
          connections={connections}
          onApplyFix={(nodeId, updates) => {
            setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...updates } : n));
          }}
        />
      )}
    </div>
  );
}

function ModeButton({ 
  active, 
  onClick, 
  icon, 
  label, 
  shortLabel 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string; 
  shortLabel?: string;
}) {
  return (
    <button 
      onClick={onClick}
      title={label}
      className={`px-1.5 sm:px-2 lg:px-2.5 py-1 rounded-lg flex items-center gap-1 sm:gap-1.5 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
        active 
          ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm' 
          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
      }`}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="hidden xl:inline">{label}</span>
      {shortLabel && <span className="hidden sm:inline xl:hidden">{shortLabel}</span>}
    </button>
  );
}

interface NodeCardProps {
  node: FlowNode;
  selected: boolean;
  onSelect: () => void;
  onStartConnect: (e: React.MouseEvent, handleId: string, defaultColor?: string) => void;
  isTargetHovered?: boolean;
  connectedOutputHandles?: string[];
  outsideInfo?: { isOutside: boolean; reason?: 'delay' | 'tag' | 'otn' | 'rn'; delayNodeTitle?: string; delayText?: string };
  onRegisterPin?: (pinId: string, x: number, y: number) => void;
  nodes?: FlowNode[];
  connections?: FlowConnection[];
  onOpenTriggerModal?: () => void;
  onToggleTrigger?: (triggerId: string) => void;
}

const NodeCard = React.memo(function NodeCard({ 
  node, 
  selected, 
  onSelect, 
  onStartConnect, 
  isTargetHovered,
  connectedOutputHandles = EMPTY_HANDLES_ARRAY,
  outsideInfo: propOutsideInfo,
  onRegisterPin,
  nodes = [],
  connections = [],
  onOpenTriggerModal,
  onToggleTrigger
}: NodeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isMessage = node.type === 'message';
  const isTrigger = node.type === 'trigger';
  const isAction = node.type === 'action';
  const isAi = node.type === 'ai';
  const isDelay = node.type === 'delay';
  const isCondition = node.type === 'condition';

  const outsideInfo = propOutsideInfo || (!isTrigger ? checkNodeOutside24h(node.id, nodes, connections) : DEFAULT_OUTSIDE_INFO);

  const widthClass = isMessage ? 'w-[290px]' : isTrigger ? 'w-[320px]' : 'w-[250px]';

  // Measure and register pin positions relative to card root for zero-reflow rendering
  useEffect(() => {
    const cardEl = cardRef.current;
    if (!cardEl || !onRegisterPin) return;

    const measureAndRegisterPins = () => {
      if (!cardEl || !cardEl.isConnected) return;
      const cardRect = cardEl.getBoundingClientRect();
      const scale = cardRect.width > 0 && cardEl.offsetWidth > 0 
        ? (cardRect.width / cardEl.offsetWidth) 
        : 1;

      const inPin = cardEl.querySelector(`#pin-in-${node.id}`) as HTMLElement | null;
      if (inPin) {
        const pinRect = inPin.getBoundingClientRect();
        const relX = (pinRect.left + pinRect.width / 2 - cardRect.left) / scale;
        const relY = (pinRect.top + pinRect.height / 2 - cardRect.top) / scale;
        onRegisterPin(`pin-in-${node.id}`, Math.round(relX), Math.round(relY));
      }

      const outPin = cardEl.querySelector(`#pin-out-${node.id}-output`) as HTMLElement | null;
      if (outPin) {
        const pinRect = outPin.getBoundingClientRect();
        const relX = (pinRect.left + pinRect.width / 2 - cardRect.left) / scale;
        const relY = (pinRect.top + pinRect.height / 2 - cardRect.top) / scale;
        onRegisterPin(`pin-out-${node.id}-output`, Math.round(relX), Math.round(relY));
      }

      if (node.buttons && node.buttons.length > 0) {
        node.buttons.forEach((_, idx) => {
          const btnPin = cardEl.querySelector(`#pin-out-${node.id}-btn-${idx}`) as HTMLElement | null;
          if (btnPin) {
            const pinRect = btnPin.getBoundingClientRect();
            const relX = (pinRect.left + pinRect.width / 2 - cardRect.left) / scale;
            const relY = (pinRect.top + pinRect.height / 2 - cardRect.top) / scale;
            onRegisterPin(`pin-out-${node.id}-btn-${idx}`, Math.round(relX), Math.round(relY));
          }
        });
      }
    };

    measureAndRegisterPins();
    const rafId = requestAnimationFrame(measureAndRegisterPins);

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureAndRegisterPins) : null;
    if (ro && cardEl) {
      ro.observe(cardEl);
    }

    return () => {
      cancelAnimationFrame(rafId);
      if (ro) ro.disconnect();
    };
  }, [node.id, node.buttons, node.components, node.content, node.type, node.triggers, isMessage, isTrigger, onRegisterPin]);

  const headerBg = isTrigger
    ? 'bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-300'
    : isAction
    ? 'bg-amber-500/15 border-b border-amber-500/30 text-amber-300'
    : isAi
    ? 'bg-cyan-500/15 border-b border-cyan-500/30 text-cyan-300'
    : isDelay
    ? 'bg-purple-500/15 border-b border-purple-500/30 text-purple-300'
    : isCondition
    ? 'bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-300'
    : 'bg-blue-500/15 border-b border-blue-500/30 text-blue-300';

  const badgeBorder = isTrigger
    ? 'border-emerald-500'
    : isAction
    ? 'border-amber-500'
    : isAi
    ? 'border-cyan-500'
    : isDelay
    ? 'border-purple-500'
    : isCondition
    ? 'border-emerald-500'
    : 'border-blue-500';

  const isOutputConnected = connectedOutputHandles.includes('output');

  return (
    <div 
      ref={cardRef}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={`bg-slate-900/90 rounded-2xl ${widthClass} shadow-2xl overflow-visible relative transition-colors duration-75 cursor-pointer border-2 ${
        selected 
          ? `${badgeBorder} ring-4 ring-blue-500/20 shadow-blue-500/10` 
          : 'border-white/10 hover:border-white/30'
      }`}
    >
      {/* Starting Point vertical tab (physically anchored to left edge) */}
      {isTrigger && (
        <div className="absolute right-full top-3 -mr-[2px] flex items-center pointer-events-none z-20">
          <div className="bg-emerald-500 text-slate-950 font-black text-[9px] tracking-widest px-1.5 py-3 rounded-l-lg uppercase shadow-lg shadow-emerald-500/25 border-l border-t border-b border-emerald-400 select-none whitespace-nowrap flex items-center justify-center">
            <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
              Starting Point
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`px-4 py-3 rounded-t-[14px] flex items-center justify-between ${headerBg}`}>
        <div className="flex items-center gap-2 overflow-hidden">
          {isTrigger && <Workflow className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
          {isAction && <Tag className="w-4 h-4 text-amber-400 flex-shrink-0" />}
          {isAi && <Bot className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
          {isDelay && <Clock className="w-4 h-4 text-purple-400 flex-shrink-0" />}
          {isCondition && <Workflow className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
          {isMessage && <MessageSquare className="w-4 h-4 text-blue-400 flex-shrink-0" />}
          <span className="font-bold text-xs truncate text-white">{node.title}</span>
        </div>
        <div className="w-2 h-2 rounded-full bg-current opacity-70"></div>
      </div>

      {/* Outside 24h Rules Badge (Rendered ONLY if node is outside 24h rules) */}
      {!isTrigger && outsideInfo.isOutside && (
        <div className="mx-3 mt-2.5">
          {(node.outsideRuleType === 'tag' || (node.messageTag && node.messageTag !== 'NONE')) ? (
            <div className="px-2.5 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1.5 font-bold text-purple-300 truncate">
                <Tag className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                <span className="truncate">Outside 24h Tag: {node.messageTag || 'CONFIRMED_EVENT_UPDATE'}</span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-200 font-bold ml-1 flex-shrink-0">
                Post-24h
              </span>
            </div>
          ) : (node.outsideRuleType === 'otn' || node.otnTopic) ? (
            <div className="px-2.5 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1.5 font-bold text-cyan-300 truncate">
                <BellRing className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                <span className="truncate">Outside 24h OTN: {node.otnTopic || 'One-Time Token'}</span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/30 text-cyan-200 font-bold ml-1 flex-shrink-0">
                OTN
              </span>
            </div>
          ) : (node.outsideRuleType === 'recurring_notification' || node.rnTopic) ? (
            <div className="px-2.5 py-1.5 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1.5 font-bold text-blue-300 truncate">
                <RefreshCw className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <span className="truncate">Outside 24h RN: {node.rnTopic || 'Subscribed'}</span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/30 text-blue-200 font-bold ml-1 flex-shrink-0">
                RN
              </span>
            </div>
          ) : node.outsideRuleType === 'whatsapp_template' ? (
            <div className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1.5 font-bold text-emerald-300 truncate">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span className="truncate">Outside 24h WA Template</span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-200 font-bold ml-1 flex-shrink-0">
                WA
              </span>
            </div>
          ) : (
            <div className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-between text-[10px] animate-pulse">
              <div className="flex items-center gap-1.5 font-bold text-amber-300 truncate">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span className="truncate">Rule Setup Needed (Outside 24h)</span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-200 font-bold ml-1 flex-shrink-0">
                Setup
              </span>
            </div>
          )}
        </div>
      )}

      {/* Body Content */}
      <div className="p-4 space-y-3">
        {isTrigger && (
          <div className="space-y-2.5">
            {/* Meta 24-Hour Messaging Rules Engine Container */}
            <div className="bg-emerald-950/50 border border-emerald-500/30 rounded-xl p-2.5 space-y-1.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Meta 24h Window Rule</span>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  ACTIVE
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                Interactions through any active trigger below open the standard 24h window. Connected steps have full promotional freedom.
              </p>
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-300/80 pt-1 border-t border-emerald-500/20">
                <span>Channels: Messenger • IG • WhatsApp</span>
              </div>
            </div>

            {/* List of Attached Triggers / Entry Points */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>Entry Points ({(node.triggers || []).filter(t => t.enabled).length}/{(node.triggers || []).length || 1} active)</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenTriggerModal) onOpenTriggerModal();
                  }}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 hover:underline font-semibold cursor-pointer"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>Add</span>
                </button>
              </div>

              <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-0.5 no-scrollbar">
                {(node.triggers && node.triggers.length > 0) ? (
                  node.triggers.map((trig) => (
                    <div 
                      key={trig.id}
                      className={`p-2 rounded-xl border transition-all text-left flex items-center justify-between gap-2 ${
                        trig.enabled 
                          ? 'bg-slate-950/80 border-white/10 hover:border-white/20 shadow-sm' 
                          : 'bg-slate-950/40 border-white/5 opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs ${
                          trig.channel === 'instagram' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' :
                          trig.channel === 'whatsapp' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          trig.channel === 'web' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                          trig.channel === 'integrations' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}>
                          {trig.channel === 'instagram' ? <Instagram className="w-3 h-3" /> :
                           trig.channel === 'whatsapp' ? <Smartphone className="w-3 h-3" /> :
                           trig.channel === 'web' ? <Layout className="w-3 h-3" /> :
                           trig.channel === 'integrations' ? <Webhook className="w-3 h-3" /> :
                           <MessageCircle className="w-3 h-3" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-xs font-semibold text-white truncate">{trig.title}</span>
                            {trig.keywordMode === 'any' ? (
                              <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex-shrink-0">
                                ANY
                              </span>
                            ) : trig.matchRule ? (
                              <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30 uppercase flex-shrink-0">
                                {trig.matchRule}
                              </span>
                            ) : null}
                          </div>

                          {trig.keywordMode === 'any' ? (
                            <div className="text-[9px] text-amber-300/90 font-mono truncate flex items-center gap-1 mt-0.5">
                              <span>⚡ Any interaction</span>
                            </div>
                          ) : (trig.keywords && trig.keywords.length > 0) ? (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {trig.keywords.slice(0, 3).map((kw, i) => (
                                <span key={i} className="text-[8px] font-mono px-1 py-0.2 rounded bg-blue-500/15 text-blue-200 border border-blue-500/30 font-semibold truncate max-w-[80px]">
                                  #{kw}
                                </span>
                              ))}
                              {trig.keywords.length > 3 && (
                                <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-white/10 text-slate-300 font-semibold">
                                  +{trig.keywords.length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="text-[9px] text-slate-400 truncate font-mono mt-0.5">
                              {trig.postTitle 
                                ? `Post: ${trig.postTitle}`
                                : trig.adCampaignName 
                                ? `Ad: ${trig.adCampaignName}`
                                : trig.refPayload 
                                ? `Ref: ${trig.refPayload}`
                                : trig.widgetHeadline
                                ? `Popup: ${trig.widgetHeadline}`
                                : trig.webhookSource || 'Inbound Opt-in'}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Active Toggle Switch */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onToggleTrigger) onToggleTrigger(trig.id);
                        }}
                        className={`w-6 h-3.5 rounded-full p-0.5 transition-colors flex-shrink-0 cursor-pointer flex items-center ${
                          trig.enabled ? 'bg-emerald-500 justify-end' : 'bg-slate-700 justify-start'
                        }`}
                        title={trig.enabled ? 'Trigger is Active (Click to pause)' : 'Trigger is Paused (Click to activate)'}
                      >
                        <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="bg-slate-950/60 border border-white/10 rounded-xl p-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Trigger Rule</span>
                      <span className="text-[9px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                        {node.triggerRuleType === 'inbound_dm' ? 'Inbound DM' : node.triggerRuleType === 'comment_reply' ? 'Post Comment' : node.triggerRuleType === 'website_chat' ? 'Web Chat' : node.triggerRuleType === 'referral_link' ? 'm.me Link' : 'FB/IG Ad Click'}
                      </span>
                    </div>
                    <div className="text-xs text-white font-medium truncate">
                      {node.triggerRuleType === 'inbound_dm' 
                        ? `Keywords: ${(node.triggerKeywords || ['START', 'BOT']).join(', ')}`
                        : (node.triggerAdName || node.triggerAdCampaignId || 'Build-A-Bot Live CTM Ad Campaign #4102')}
                    </div>
                  </div>
                )}
              </div>

              {/* Dashed Add Trigger button right on card */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onOpenTriggerModal) onOpenTriggerModal();
                }}
                className="w-full py-1.5 border border-dashed border-white/20 hover:border-cyan-500/50 hover:bg-cyan-500/10 text-slate-300 hover:text-cyan-300 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <Plus className="w-3 h-3 text-cyan-400" />
                <span>+ Add Trigger / Entry Point</span>
              </button>
            </div>
          </div>
        )}

        {isAction && node.actionTags && (
          <div className="space-y-1.5">
            {node.actionTags.map((tag, i) => (
              <div key={i} className="text-xs font-mono bg-amber-500/10 text-amber-200 px-2.5 py-1 rounded-lg border border-amber-500/20 flex items-center gap-2">
                <Tag className="w-3 h-3 text-amber-400" />
                <span className="truncate">{tag}</span>
              </div>
            ))}
          </div>
        )}

        {isAction && node.smsMessage && (
          <div className="text-xs bg-amber-500/10 text-amber-100 px-2.5 py-1.5 rounded-lg border border-amber-500/20 flex items-start gap-2 mt-1.5">
            <MessageSquareText className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <span className="line-clamp-2">SMS: {node.smsMessage}</span>
          </div>
        )}
        {isAction && node.smsCollectOptIn && (
          <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 mt-1.5">
            Collects SMS opt-in
          </div>
        )}

        {isDelay && (
          <div className="text-xs text-purple-200 bg-purple-500/10 border border-purple-500/20 p-2.5 rounded-xl flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <span>{node.delayText || node.content}</span>
          </div>
        )}

        {isCondition && (
          <div className="space-y-2">
            <div className="text-xs text-emerald-200 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl flex items-center gap-2">
              <Workflow className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{node.conditionText || 'Match condition'}</span>
            </div>
          </div>
        )}

        {!isTrigger && !isDelay && !isCondition && node.content && (
          <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-4 bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
            {node.content.split(/(\{\{[^}]+\}\})/).map((part, idx) => {
              if (part.startsWith('{{') && part.endsWith('}}')) {
                return (
                  <span key={idx} className="bg-blue-600 text-white font-semibold px-1.5 py-0.5 rounded text-[11px] mx-0.5 inline-block">
                    {part.replace(/[{}]/g, '')}
                  </span>
                );
              }
              return part;
            })}
          </div>
        )}

        {/* Dynamic Components Block (Text, Image, Card, Gallery, Typing) */}
        {node.components && node.components.length > 0 && (
          <div className="space-y-2.5 pt-1">
            {node.components.map((comp, cIdx) => {
              if (comp.type === 'typing') {
                return (
                  <div key={comp.id || cIdx} className="bg-slate-950/70 border border-cyan-500/30 rounded-xl px-3 py-2 flex items-center justify-between shadow-inner">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-cyan-500/10 px-2 py-1 rounded-md border border-cyan-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-[11px] font-semibold text-cyan-200">Typing Delay</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30">
                      {comp.delaySeconds || 3}s
                    </span>
                  </div>
                );
              }

              if (comp.type === 'image') {
                return (
                  <div key={comp.id || cIdx} className="rounded-xl overflow-hidden border border-emerald-500/30 bg-slate-950/60 group/img relative">
                    {comp.imageUrl ? (
                      <img 
                        src={comp.imageUrl} 
                        alt={comp.imageCaption || 'Attachment'} 
                        className="w-full h-28 object-cover group-hover/img:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-20 bg-slate-800/80 flex items-center justify-center gap-2 text-slate-400 text-xs">
                        <ImageIcon className="w-4 h-4 text-emerald-400" />
                        <span>No image set</span>
                      </div>
                    )}
                    {comp.imageCaption && (
                      <div className="p-2 text-[11px] text-slate-300 bg-slate-900/95 border-t border-white/5 truncate">
                        {comp.imageCaption}
                      </div>
                    )}
                  </div>
                );
              }

              if (comp.type === 'card') {
                return (
                  <div key={comp.id || cIdx} className="rounded-xl overflow-hidden border border-purple-500/30 bg-slate-950/70 shadow-md">
                    {comp.cardImageUrl && (
                      <img 
                        src={comp.cardImageUrl} 
                        alt={comp.cardTitle || 'Card image'} 
                        className="w-full h-24 object-cover"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="p-2.5 space-y-1">
                      <div className="text-xs font-bold text-white truncate">{comp.cardTitle || 'Card Title'}</div>
                      {comp.cardSubtitle && (
                        <div className="text-[11px] text-slate-400 line-clamp-2 leading-tight">{comp.cardSubtitle}</div>
                      )}
                      {comp.cardButtonLabel && (
                        <div className="mt-2 py-1.5 px-3 bg-purple-500/20 border border-purple-500/40 text-purple-300 rounded-lg text-center text-[11px] font-bold">
                          {comp.cardButtonLabel}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              if (comp.type === 'gallery') {
                return (
                  <div key={comp.id || cIdx} className="rounded-xl border border-amber-500/30 bg-slate-950/70 p-2 space-y-2 shadow-md">
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-300">
                      <div className="flex items-center gap-1.5">
                        <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
                        <span>Carousel Gallery</span>
                      </div>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono border border-amber-500/30">
                        {(comp.galleryCards?.length || 0)} Cards
                      </span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {(comp.galleryCards || []).map((card, idx) => (
                        <div key={card.id || idx} className="w-36 flex-shrink-0 bg-slate-900 border border-white/10 rounded-lg overflow-hidden">
                          {card.imageUrl ? (
                            <img src={card.imageUrl} alt={card.title} className="w-full h-16 object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-14 bg-slate-800 flex items-center justify-center text-slate-500 text-[10px]">No image</div>
                          )}
                          <div className="p-1.5 space-y-0.5">
                            <div className="text-[10px] font-bold text-white truncate">{card.title || 'Card Title'}</div>
                            {card.subtitle && <div className="text-[9px] text-slate-400 truncate">{card.subtitle}</div>}
                            {card.buttonLabel && (
                              <div className="mt-1 text-[9px] font-bold text-amber-300 bg-amber-500/20 py-0.5 text-center rounded border border-amber-500/30 truncate">
                                {card.buttonLabel}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              if (comp.type === 'text') {
                return (
                  <div key={comp.id || cIdx} className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-950/40 p-2.5 rounded-xl border border-blue-500/20">
                    {comp.text ? (
                      comp.text.split(/(\{\{[^}]+\}\})/).map((part, idx) => {
                        if (part.startsWith('{{') && part.endsWith('}}')) {
                          return (
                            <span key={idx} className="bg-blue-600 text-white font-semibold px-1.5 py-0.5 rounded text-[11px] mx-0.5 inline-block">
                              {part.replace(/[{}]/g, '')}
                            </span>
                          );
                        }
                        return part;
                      })
                    ) : (
                      <span className="text-slate-500 italic">Empty text block</span>
                    )}
                  </div>
                );
              }

              if (comp.type === 'recurring_notification_optin') {
                return (
                  <div key={comp.id || cIdx} className="rounded-xl overflow-hidden border border-cyan-500/40 bg-gradient-to-br from-cyan-950/40 to-slate-950/80 p-3 space-y-2 shadow-lg shadow-cyan-950/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-cyan-300 font-bold text-[11px]">
                        <BellRing className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Recurring Notification</span>
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded uppercase border border-cyan-500/30">
                        {comp.rnFrequency || 'weekly'}
                      </span>
                    </div>
                    <p className="text-xs text-white font-semibold leading-snug">{comp.rnTitle || 'Get Updates & Alerts'}</p>
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      Topic: <span className="text-cyan-300">{comp.rnTopic || 'VIP Offers'}</span>
                    </div>
                    <div className="w-full py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 text-xs font-bold text-center border border-cyan-500/40 transition-colors">
                      🔔 {comp.rnButtonText || 'Get Updates'}
                    </div>
                  </div>
                );
              }

              if (comp.type === 'one_time_notification_optin') {
                return (
                  <div key={comp.id || cIdx} className="rounded-xl overflow-hidden border border-purple-500/40 bg-gradient-to-br from-purple-950/40 to-slate-950/80 p-3 space-y-2 shadow-lg shadow-purple-950/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-purple-300 font-bold text-[11px]">
                        <Zap className="w-3.5 h-3.5 text-purple-400" />
                        <span>One-Time Notification (OTN)</span>
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">
                        1 Post-24h Ping
                      </span>
                    </div>
                    <div className="text-xs text-white font-semibold">{comp.otnTopic || 'Back in Stock Alert'}</div>
                    <div className="w-full py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 text-xs font-bold text-center border border-purple-500/40 transition-colors">
                      ⚡ {comp.otnButtonText || 'Notify Me'}
                    </div>
                  </div>
                );
              }

              if (comp.type === 'whatsapp_template') {
                return (
                  <div key={comp.id || cIdx} className="rounded-xl overflow-hidden border border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 to-slate-950/80 p-3 space-y-1.5 shadow-lg shadow-emerald-950/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-[11px]">
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>WhatsApp Template</span>
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded uppercase border border-emerald-500/30">
                        {comp.waCategory || 'UTILITY'}
                      </span>
                    </div>
                    {comp.waHeader && (
                      <div className="text-xs text-white font-bold">{comp.waHeader}</div>
                    )}
                    <div className="text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {comp.waBody || 'Template body content'}
                    </div>
                    <div className="text-[9px] text-emerald-400/80 font-mono pt-1">
                      Template: {comp.waTemplateName || 'order_status_v1'}
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        )}

        {/* Buttons (with individual output connection handles) */}
        {node.buttons && node.buttons.length > 0 && (
          <div className="space-y-2 pt-1">
            {node.buttons.map((btn, idx) => {
              const isBtnConnected = connectedOutputHandles.includes(`btn-${idx}`);
              return (
                <div key={idx} className="relative group">
                  <div className="py-2 px-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-center text-xs font-bold text-blue-300 group-hover:bg-blue-500/20 group-hover:border-blue-400 transition-colors shadow-sm">
                    {btn}
                  </div>
                  {/* Connector Pin on right of button */}
                  <button 
                    id={`pin-out-${node.id}-btn-${idx}`}
                    type="button"
                    onMouseDown={(e) => onStartConnect(e, `btn-${idx}`, '#3b82f6')}
                    className={`absolute -right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full transition-all shadow-md cursor-crosshair z-20 flex items-center justify-center ${
                      isBtnConnected
                        ? 'bg-blue-500 border-2 border-white scale-110'
                        : 'bg-slate-800 border-2 border-blue-400 hover:bg-blue-500 hover:scale-125'
                    }`}
                    title="Drag to pull out pipe, or click to choose next step"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white opacity-80" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick Replies */}
        {node.quickReplies && node.quickReplies.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {node.quickReplies.map((qr, idx) => (
              <span key={idx} className="text-[11px] bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-white/10 font-medium">
                {qr}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Main Output Pin (Right edge) */}
      <button 
        id={`pin-out-${node.id}-output`}
        type="button"
        onMouseDown={(e) => onStartConnect(e, 'output')}
        className={`absolute -right-2.5 top-[36px] w-5 h-5 rounded-full transition-all shadow-lg cursor-crosshair z-20 flex items-center justify-center group/pin ${
          isOutputConnected
            ? isTrigger 
              ? 'bg-emerald-500 border-2 border-white scale-105' 
              : 'bg-blue-500 border-2 border-white scale-105'
            : 'bg-slate-800 border-2 border-white/70 hover:border-white hover:scale-125 hover:bg-blue-600'
        }`}
        title="Drag to pull out pipe, or click to choose next step"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white opacity-90 group-hover/pin:scale-125 transition-transform" />
      </button>

      {/* Input Pin (Left edge - for all except starting trigger) */}
      {!isTrigger && (
        <div 
          id={`pin-in-${node.id}`}
          className={`absolute -left-2.5 top-[36px] w-5 h-5 rounded-full transition-all shadow-lg z-20 flex items-center justify-center ${
            isTargetHovered
              ? 'bg-emerald-500 border-2 border-white ring-4 ring-emerald-400/50 scale-125 animate-pulse'
              : 'bg-slate-800 border-2 border-white/60 hover:border-white'
          }`}
          title="Target input pin (release pipe here to connect)"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  if (prev.selected !== next.selected) return false;
  if (prev.isTargetHovered !== next.isTargetHovered) return false;
  if (prev.outsideInfo?.isOutside !== next.outsideInfo?.isOutside) return false;
  if (prev.outsideInfo?.reason !== next.outsideInfo?.reason) return false;

  const prevHandles = prev.connectedOutputHandles || EMPTY_HANDLES_ARRAY;
  const nextHandles = next.connectedOutputHandles || EMPTY_HANDLES_ARRAY;
  if (prevHandles.length !== nextHandles.length) return false;
  for (let i = 0; i < prevHandles.length; i++) {
    if (prevHandles[i] !== nextHandles[i]) return false;
  }

  // Fast comparison of node data without triggering renders on x/y coordinate movement during drag
  const p = prev.node;
  const n = next.node;
  if (p.id !== n.id || p.type !== n.type || p.title !== n.title || p.content !== n.content) return false;
  if (p.delayHours !== n.delayHours || p.delayText !== n.delayText || p.messageTag !== n.messageTag || p.outsideRuleType !== n.outsideRuleType) return false;
  if (p.aiModel !== n.aiModel || p.aiSystemPrompt !== n.aiSystemPrompt) return false;
  if (p.actionType !== n.actionType || p.actionTag !== n.actionTag) return false;
  if (p.conditionType !== n.conditionType || p.conditionValue !== n.conditionValue) return false;
  if (p.buttons !== n.buttons && JSON.stringify(p.buttons) !== JSON.stringify(n.buttons)) return false;
  if (p.components !== n.components && JSON.stringify(p.components) !== JSON.stringify(n.components)) return false;
  if (p.triggers !== n.triggers && JSON.stringify(p.triggers) !== JSON.stringify(n.triggers)) return false;

  return true;
});

function NodeEditor({ 
  node, 
  nodes,
  connections,
  outsideInfo: propOutsideInfo,
  onDeleteConnection,
  onStartConnect,
  onUpdate, 
  onUpdateNode,
  onDelete, 
  onClose,
  onNavigateToIntegrations,
  onNavigateToDocs,
  onOpenTriggerModal,
  onToggleTrigger
}: { 
  node: FlowNode;
  nodes: FlowNode[];
  connections: FlowConnection[];
  outsideInfo?: { isOutside: boolean; reason?: 'delay' | 'tag' | 'otn' | 'rn'; delayNodeTitle?: string; delayText?: string };
  onDeleteConnection: (connId: string, e?: React.MouseEvent) => void;
  onStartConnect: (e: React.MouseEvent, handleId: string, defaultColor?: string) => void;
  onUpdate: (updates: Partial<FlowNode>) => void;
  onUpdateNode?: (nodeId: string, updates: Partial<FlowNode>) => void;
  onDelete: () => void;
  onClose: () => void;
  onNavigateToIntegrations?: () => void;
  onNavigateToDocs?: (docId?: string) => void;
  onOpenTriggerModal?: () => void;
  onToggleTrigger?: (triggerId: string) => void;
}) {
  const [newBtnText, setNewBtnText] = useState('');
  const [newTagText, setNewTagText] = useState('');
  const [newKeywordInput, setNewKeywordInput] = useState('');
  // Emoji picker targets for bot message authoring
  const msgTextEmoji = useEmojiTarget<HTMLTextAreaElement>();
  const smsEmoji = useEmojiTarget<HTMLTextAreaElement>();
  const btnEmoji = useEmojiTarget<HTMLInputElement>();
  const compEmoji = useEmojiTargetMap<HTMLTextAreaElement | HTMLInputElement>();
  const [activeIntegrations, setActiveIntegrations] = useState<IntegrationApp[]>(() => getActiveConnectedIntegrations());
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [customTagInput, setCustomTagInput] = useState<string>('');
  const [expandedTriggerId, setExpandedTriggerId] = useState<string | null>(null);
  const [copiedTriggerId, setCopiedTriggerId] = useState<string | null>(null);
  const [testedWebhookId, setTestedWebhookId] = useState<string | null>(null);
  const [newKeywordInputs, setNewKeywordInputs] = useState<Record<string, string>>({});
  const [testingTriggerId, setTestingTriggerId] = useState<string | null>(null);
  const [testInputText, setTestInputText] = useState<string>('');
  const [testSimResult, setTestSimResult] = useState<{
    matched: boolean;
    rule: string;
    details: string;
    windowOpened: boolean;
    nextStepTitle?: string;
  } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isTrigger = node.type === 'trigger';
  const isDelay = node.type === 'delay';
  const isMessage = node.type === 'message';
  const isAction = node.type === 'action';
  const isAi = node.type === 'ai';
  const isCondition = node.type === 'condition';
  const outsideInfo = propOutsideInfo || (!isTrigger ? checkNodeOutside24h(node.id, nodes, connections) : DEFAULT_OUTSIDE_INFO);

  useEffect(() => {
    const handleSync = () => {
      setActiveIntegrations(getActiveConnectedIntegrations());
    };
    window.addEventListener('chatmize_integrations_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('chatmize_integrations_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const connectionData = selectedConnectionId ? INTEGRATION_PLATFORM_DATA[selectedConnectionId] : null;
  const selectedApp = activeIntegrations.find(a => a.id === selectedConnectionId);
  const selectedListObj = connectionData?.lists.find(l => l.id === selectedListId);

  // Determine the effective tag (if supported and specified)
  const effectiveTag = selectedTag === '__custom__' 
    ? customTagInput.trim() 
    : (selectedTag && selectedTag !== 'none' ? selectedTag : '');

  // Formatted preview string
  const composedActionText = (() => {
    if (!selectedApp || !selectedListObj) return '';
    if (connectionData?.supportsTags && effectiveTag) {
      return `${selectedApp.name}: [${selectedListObj.name}] + Tag [${effectiveTag}]`;
    }
    return `${selectedApp.name}: [${selectedListObj.name}]`;
  })();

  const handleAddComposedAction = () => {
    if (!composedActionText) return;
    const currentTags = node.actionTags || [];
    onAutoUpdate({ actionTags: [...currentTags, composedActionText] });
    // Reset list and tag so user can configure the next action smoothly
    setSelectedListId('');
    setSelectedTag('');
    setCustomTagInput('');
  };

  // Updates persist immediately via FlowBuilder's auto-save engine
  const onAutoUpdate = (updates: Partial<FlowNode>) => {
    onUpdate(updates);
  };
  const msgPz = usePersonalizationTarget<HTMLTextAreaElement>();
  const compPz = usePersonalizationTargetMap<HTMLTextAreaElement>();

  const handleUpdateTrigger = (triggerId: string, updates: Partial<FlowTrigger>) => {
    const currentTriggers = node.triggers || [];
    const updated = currentTriggers.map(t => t.id === triggerId ? { ...t, ...updates } : t);
    onAutoUpdate({ triggers: updated });
  };

  const handleDeleteTrigger = (triggerId: string) => {
    const currentTriggers = node.triggers || [];
    const updated = currentTriggers.filter(t => t.id !== triggerId);
    onAutoUpdate({ triggers: updated });
    if (testingTriggerId === triggerId) {
      setTestingTriggerId(null);
      setTestSimResult(null);
    }
  };

  const handleAddKeywordsToTrigger = (triggerId: string, rawInput: string) => {
    if (!rawInput || !rawInput.trim()) return;
    const currentTrigger = (node.triggers || []).find(t => t.id === triggerId);
    const currentKws = currentTrigger?.keywords || [];
    
    // Split by comma, semicolon or whitespace
    const newKws = rawInput
      .split(/[,;\n]+/)
      .map(k => k.trim().toUpperCase())
      .filter(k => k.length > 0 && !currentKws.includes(k));
    
    if (newKws.length > 0) {
      const updatedKeywords = [...currentKws, ...newKws];
      const updates: Partial<FlowTrigger> = {
        keywords: updatedKeywords,
        keywordMode: 'keywords',
        ...(currentTrigger?.commentKeywords !== undefined || currentTrigger?.type === 'ig_comments' || currentTrigger?.type === 'fb_comments' || currentTrigger?.type === 'ig_live_comment'
          ? { commentKeywords: updatedKeywords, commentMatchRule: 'contains' }
          : {}),
        ...(currentTrigger?.adPayloadKeyword !== undefined || currentTrigger?.type === 'fb_ad' || currentTrigger?.type === 'ig_ad' || currentTrigger?.type === 'wa_ad'
          ? { adPayloadKeyword: updatedKeywords[0] }
          : {})
      };
      handleUpdateTrigger(triggerId, updates);
    }
    setNewKeywordInputs(prev => ({ ...prev, [triggerId]: '' }));
  };

  const handleAddPresetKeyword = (triggerId: string, keyword: string) => {
    const currentTrigger = (node.triggers || []).find(t => t.id === triggerId);
    const currentKws = currentTrigger?.keywords || [];
    const cleanKw = keyword.trim().toUpperCase();
    if (!currentKws.includes(cleanKw)) {
      const updatedKeywords = [...currentKws, cleanKw];
      const updates: Partial<FlowTrigger> = {
        keywords: updatedKeywords,
        keywordMode: 'keywords',
        ...(currentTrigger?.commentKeywords !== undefined || currentTrigger?.type === 'ig_comments' || currentTrigger?.type === 'fb_comments' || currentTrigger?.type === 'ig_live_comment'
          ? { commentKeywords: updatedKeywords, commentMatchRule: 'contains' }
          : {}),
        ...(currentTrigger?.adPayloadKeyword !== undefined || currentTrigger?.type === 'fb_ad' || currentTrigger?.type === 'ig_ad' || currentTrigger?.type === 'wa_ad'
          ? { adPayloadKeyword: updatedKeywords[0] }
          : {})
      };
      handleUpdateTrigger(triggerId, updates);
    }
  };

  const getSmartKeywordPresets = (type: string): string[] => {
    if (type === 'ig_comments' || type === 'fb_comments' || type === 'ig_live_comment') {
      return ['SEND', 'YES', 'VIP', 'LINK', 'GUIDE', 'INFO', 'PROMO'];
    }
    if (type === 'ig_story_mention' || type === 'ig_story_reply') {
      return ['VIP', 'REPLAY', 'LINK', 'DISCOUNT', 'YES', 'INFO', 'FREE'];
    }
    if (type === 'fb_ad' || type === 'ig_ad' || type === 'wa_ad') {
      return ['START', 'CLAIM', 'OFFER', 'GET_DEAL', 'LEARN_MORE', 'JOIN'];
    }
    if (type === 'fb_ref_url' || type === 'ig_ref_link' || type === 'wa_link' || type === 'fb_qr_code') {
      return ['JOIN', 'START', 'WORKSHOP', 'VIP', 'SIGNUP', 'REPLAY'];
    }
    if (type === 'web_modal' || type === 'web_bar' || type === 'web_slidein' || type === 'web_embed_form' || type === 'landing_page' || type === 'fb_customer_chat') {
      return ['OPTIN', 'START', 'DOWNLOAD', 'GUIDE', 'FREE', 'VIP'];
    }
    if (type === 'webhook' || type === 'shopify_trigger' || type === 'lead_form') {
      return ['CHECKOUT', 'NEW_LEAD', 'ORDER_PAID', 'ABANDONED', 'PURCHASE'];
    }
    return ['START', 'BOT', 'HELP', 'PRICING', 'VIP', 'JOIN', 'INFO'];
  };

  const runTriggerSimulator = (trig: FlowTrigger) => {
    const input = testInputText.trim();
    if (!input) return;

    let matched = false;
    let ruleDesc = '';
    let details = '';

    const nextConn = connections.find(c => c.sourceNodeId === node.id);
    const nextNode = nextConn ? nodes.find(n => n.id === nextConn.targetNodeId) : null;
    const nextTitle = nextNode ? nextNode.title : 'First message in flow';

    const isAnyMode = trig.keywordMode === 'any' || trig.commentMatchRule === 'any';

    const kws = (trig.keywords && trig.keywords.length > 0)
      ? trig.keywords
      : (trig.commentKeywords && trig.commentKeywords.length > 0)
      ? trig.commentKeywords
      : (trig.refPayload ? [trig.refPayload.toUpperCase()] : ['START', 'BOT']);

    const matchRule = trig.matchRule || 'contains';

    if (isAnyMode) {
      matched = true;
      ruleDesc = 'Any Inbound Interaction Mode';
      details = `Opt-in tool is configured to trigger on any interaction or comment! 24-hour window opened, routing to ${nextTitle}.`;
    } else if (matchRule === 'exact') {
      const found = kws.find(k => k.trim().toLowerCase() === input.toLowerCase());
      matched = !!found;
      ruleDesc = `Exact Match (${matched ? 'Matched ✅' : 'No Match ❌'})`;
      details = matched 
        ? `Exact keyword match found for "${found?.toUpperCase()}". 24-hour messaging window opened successfully!`
        : `Incoming interaction "${input}" does not match exact keywords: [${kws.join(', ')}].`;
    } else if (matchRule === 'starts_with') {
      const found = kws.find(k => input.toLowerCase().startsWith(k.trim().toLowerCase()));
      matched = !!found;
      ruleDesc = `Starts With Keyword (${matched ? 'Matched ✅' : 'No Match ❌'})`;
      details = matched
        ? `Incoming interaction starts with keyword "${found?.toUpperCase()}". 24-hour window opened successfully!`
        : `Incoming interaction "${input}" does not start with any required keyword: [${kws.join(', ')}].`;
    } else {
      // default: contains
      const found = kws.find(k => input.toLowerCase().includes(k.trim().toLowerCase()));
      matched = !!found;
      ruleDesc = `Contains Keyword (${matched ? 'Matched ✅' : 'No Match ❌'})`;
      details = matched
        ? `Matched keyword "${found?.toUpperCase()}" inside incoming interaction "${input}". Trigger fired and 24-hour window opened!`
        : `Incoming interaction "${input}" does not contain any of the required trigger keywords: [${kws.join(', ')}].`;
    }

    setTestSimResult({
      matched,
      rule: ruleDesc,
      details,
      windowOpened: matched,
      nextStepTitle: nextTitle
    });
  };

  const PRESET_IMAGES = [
    { label: 'Workshop', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80' },
    { label: 'AI Bot', url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&auto=format&fit=crop&q=80' },
    { label: 'Dashboard', url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80' },
    { label: 'Community', url: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600&auto=format&fit=crop&q=80' },
  ];

  const outboundConnections = connections.filter(c => c.sourceNodeId === node.id);
  const inboundConnections = connections.filter(c => c.targetNodeId === node.id);

  const handleAddButton = () => {
    if (!newBtnText.trim()) return;
    const currentButtons = node.buttons || [];
    onAutoUpdate({ buttons: [...currentButtons, newBtnText.trim()] });
    setNewBtnText('');
  };

  const handleRemoveButton = (index: number) => {
    if (!node.buttons) return;
    const updated = node.buttons.filter((_, i) => i !== index);
    onAutoUpdate({ buttons: updated });
  };

  const handleAddTag = () => {
    if (!newTagText.trim()) return;
    const currentTags = node.actionTags || [];
    onAutoUpdate({ actionTags: [...currentTags, newTagText.trim()] });
    setNewTagText('');
  };

  const handleRemoveTag = (index: number) => {
    if (!node.actionTags) return;
    const updated = node.actionTags.filter((_, i) => i !== index);
    onAutoUpdate({ actionTags: updated });
  };

  const handleAddComponent = (type: MessageComponentType) => {
    const currentComps = node.components || [];
    let newComp: MessageComponent;

    if (type === 'typing') {
      newComp = {
        id: `comp-${Date.now()}`,
        type: 'typing',
        delaySeconds: 3,
      };
    } else if (type === 'text') {
      newComp = {
        id: `comp-${Date.now()}`,
        type: 'text',
        text: 'Let us know what questions you have, {{first_name}}!',
      };
    } else if (type === 'image') {
      newComp = {
        id: `comp-${Date.now()}`,
        type: 'image',
        imageUrl: PRESET_IMAGES[0].url,
        imageCaption: 'Build-A-Bot Live Workshop flyer',
      };
    } else if (type === 'card') {
      newComp = {
        id: `comp-${Date.now()}`,
        type: 'card',
        cardTitle: 'VIP Masterclass Pass',
        cardSubtitle: 'Instant replay recordings + 5 ready-to-deploy bot blueprints.',
        cardImageUrl: PRESET_IMAGES[3].url,
        cardButtonLabel: 'Reserve VIP Spot',
        cardButtonUrl: 'https://chatmize.io/vip',
      };
    } else if (type === 'recurring_notification_optin') {
      newComp = {
        id: `comp-rn-${Date.now()}`,
        type: 'recurring_notification_optin',
        rnTopic: 'VIP Weekly Drops & Offers',
        rnFrequency: 'weekly',
        rnTitle: 'Get VIP Weekly Drops & Special Alerts',
        rnButtonText: 'Get Updates',
      };
    } else if (type === 'one_time_notification_optin') {
      newComp = {
        id: `comp-otn-${Date.now()}`,
        type: 'one_time_notification_optin',
        otnTopic: 'Back in Stock / VIP Replay',
        otnButtonText: 'Notify Me',
      };
    } else if (type === 'whatsapp_template') {
      newComp = {
        id: `comp-wa-${Date.now()}`,
        type: 'whatsapp_template',
        waTemplateName: 'order_status_update_v1',
        waCategory: 'UTILITY',
        waHeader: 'Order Confirmation #{{1}}',
        waBody: 'Hi {{2}}, your order #{{1}} is confirmed and on the way.',
        waVariables: ['10492', 'Alex'],
      };
    } else {
      // gallery
      newComp = {
        id: `comp-${Date.now()}`,
        type: 'gallery',
        galleryCards: [
          {
            id: `gcard-${Date.now()}-1`,
            title: 'Module 1: Funnels & DMs',
            subtitle: 'Attract warm prospects with automated triggers',
            imageUrl: PRESET_IMAGES[2].url,
            buttonLabel: 'Learn More',
          },
          {
            id: `gcard-${Date.now()}-2`,
            title: 'Module 2: AI Bot Setup',
            subtitle: 'Answer customer questions 24/7 automatically',
            imageUrl: PRESET_IMAGES[1].url,
            buttonLabel: 'Register Now',
          },
        ],
      };
    }

    onAutoUpdate({ components: [...currentComps, newComp] });

    // Smoothly scroll down so the user can immediately edit the newly added component
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    }, 60);
  };

  const handleUpdateComponent = (id: string, updates: Partial<MessageComponent>) => {
    const updated = (node.components || []).map(c => c.id === id ? { ...c, ...updates } : c);
    onAutoUpdate({ components: updated });
  };

  const handleRemoveComponent = (id: string) => {
    const updated = (node.components || []).filter(c => c.id !== id);
    onAutoUpdate({ components: updated });
  };

  const handleMoveComponent = (index: number, direction: 'up' | 'down') => {
    const list = [...(node.components || [])];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    onAutoUpdate({ components: list });
  };

  const handleAddGalleryCard = (compId: string) => {
    const comp = (node.components || []).find(c => c.id === compId);
    if (!comp) return;
    const cards = comp.galleryCards || [];
    const newCard: CardItem = {
      id: `gcard-${Date.now()}`,
      title: `Card ${cards.length + 1}`,
      subtitle: 'Exclusive training blueprint',
      imageUrl: PRESET_IMAGES[cards.length % PRESET_IMAGES.length].url,
      buttonLabel: 'Click Here',
    };
    handleUpdateComponent(compId, { galleryCards: [...cards, newCard] });
  };

  const handleUpdateGalleryCard = (compId: string, cardId: string, updates: Partial<CardItem>) => {
    const comp = (node.components || []).find(c => c.id === compId);
    if (!comp) return;
    const cards = (comp.galleryCards || []).map(cd => cd.id === cardId ? { ...cd, ...updates } : cd);
    handleUpdateComponent(compId, { galleryCards: cards });
  };

  const handleRemoveGalleryCard = (compId: string, cardId: string) => {
    const comp = (node.components || []).find(c => c.id === compId);
    if (!comp) return;
    const cards = (comp.galleryCards || []).filter(cd => cd.id !== cardId);
    handleUpdateComponent(compId, { galleryCards: cards });
  };

  return (
    <div className="flex flex-col h-full text-slate-200">
      
      {/* Header (Clean & compact, reserving slideout area for elements) */}
      <div className="flex justify-between items-center pb-3 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Settings className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <h3 className="font-bold text-white text-xs sm:text-sm uppercase tracking-wider truncate">
            {node.type === 'trigger' ? 'Edit Starting Step' : node.type === 'action' ? 'Edit Action Node' : node.type === 'delay' ? 'Edit Smart Delay' : node.type === 'ai' ? 'Edit AI Agent Step' : node.type === 'condition' ? 'Edit Condition Logic' : 'Edit Message Step'}
          </h3>
        </div>
        <button 
          onClick={onClose} 
          className="p-1.5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors flex-shrink-0"
          title="Close editor"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Settings Form */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto py-3.5 sm:py-5 space-y-4 sm:space-y-6 pr-1">
        
        {/* Node Title */}
        <div>
          <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Step Name</label>
          <input data-no-emoji 
            type="text" 
            value={node.title} 
            onChange={(e) => onAutoUpdate({ title: e.target.value })}
            className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* 1. STARTING STEP: Meta 24-Hour Rules Engine & Multi-Channel Entry Points */}
        {isTrigger && (
          <div className="space-y-4">
            {/* Meta 24-Hour Messaging Rules Engine Container */}
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 space-y-3.5 shadow-lg shadow-emerald-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span>Meta 24-Hour Messaging Rules Engine</span>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ACTIVE RULES
                </span>
              </div>
              
              <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                Rules are anchored to this starting point. When a contact interacts with any entry point below, Meta grants a standard 24-hour messaging window. All connected steps inherit this session automatically.
              </p>

              <div className="space-y-2 pt-1 border-t border-emerald-500/20">
                <label className="block text-[10px] font-bold uppercase text-emerald-300/90 tracking-wider">
                  Governed Channels
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-950/60 border border-emerald-500/20 rounded-xl p-2 text-center space-y-0.5">
                    <span className="text-xs">💬</span>
                    <div className="text-[11px] font-bold text-white">Messenger</div>
                    <div className="text-[9px] text-emerald-400 font-mono">24h Standard</div>
                  </div>
                  <div className="bg-slate-950/60 border border-emerald-500/20 rounded-xl p-2 text-center space-y-0.5">
                    <span className="text-xs">📸</span>
                    <div className="text-[11px] font-bold text-white">Instagram</div>
                    <div className="text-[9px] text-emerald-400 font-mono">24h Standard</div>
                  </div>
                  <div className="bg-slate-950/60 border border-emerald-500/20 rounded-xl p-2 text-center space-y-0.5">
                    <span className="text-xs">📱</span>
                    <div className="text-[11px] font-bold text-white">WhatsApp</div>
                    <div className="text-[9px] text-emerald-400 font-mono">24h Service</div>
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-emerald-500/20 flex items-center gap-2 text-[11px] text-emerald-200">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Every inbound DM or button click automatically renews the 24-hour window.</span>
              </div>
            </div>

            {/* Chatmize Omnichannel Growth & Entry Points Section */}
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <h4 className="text-sm font-bold text-white">Triggers & Entry Points</h4>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Chatmize Omnichannel Entry Points: Inbound DMs, Comments, Ads, Ref URLs, Webhooks
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenTriggerModal) onOpenTriggerModal();
                  }}
                  className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Trigger</span>
                </button>
              </div>

              {/* Triggers List */}
              {node.triggers && node.triggers.length > 0 ? (
                <div className="space-y-3">
                  {node.triggers.map((trig) => {
                    const isExpanded = expandedTriggerId === trig.id;
                    const channelBadgeColor = 
                      trig.channel === 'instagram' ? 'bg-pink-500/10 text-pink-400 border-pink-500/20' :
                      trig.channel === 'whatsapp' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      trig.channel === 'web' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                      trig.channel === 'integrations' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-blue-500/10 text-blue-400 border-blue-500/20';

                    return (
                      <div 
                        key={trig.id}
                        className={`border rounded-2xl transition-all overflow-hidden ${
                          trig.enabled
                            ? 'bg-slate-950/80 border-white/10 hover:border-white/20'
                            : 'bg-slate-950/40 border-white/5 opacity-60'
                        }`}
                      >
                        {/* Trigger Row Header */}
                        <div className="p-3 flex items-center justify-between gap-2.5">
                          <div 
                            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                            onClick={() => setExpandedTriggerId(isExpanded ? null : trig.id)}
                          >
                            <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-xs border ${channelBadgeColor}`}>
                              {trig.channel === 'instagram' ? <Instagram className="w-3.5 h-3.5" /> :
                               trig.channel === 'whatsapp' ? <Smartphone className="w-3.5 h-3.5" /> :
                               trig.channel === 'web' ? <Layout className="w-3.5 h-3.5" /> :
                               trig.channel === 'integrations' ? <Webhook className="w-3.5 h-3.5" /> :
                               <MessageCircle className="w-3.5 h-3.5" />}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white truncate">{trig.title}</span>
                                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase font-semibold ${channelBadgeColor}`}>
                                  {trig.channel}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {trig.keywords && trig.keywords.length > 0
                                  ? `Keywords: ${trig.keywords.join(', ')}`
                                  : trig.postTitle
                                  ? `Post: ${trig.postTitle}`
                                  : trig.adCampaignName
                                  ? `Ad: ${trig.adCampaignName}`
                                  : trig.refPayload
                                  ? `Ref: ${trig.refPayload}`
                                  : trig.widgetHeadline
                                  ? `Widget: ${trig.widgetHeadline}`
                                  : trig.webhookSource || trig.description || 'Entry trigger'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Guide Button */}
                            {onNavigateToDocs && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const guideKey = trig.type.startsWith('guide_') ? trig.type : `guide_${trig.type}`;
                                  onNavigateToDocs(guideKey);
                                }}
                                className="px-2 py-1 bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer border border-white/10"
                                title="Read complete guide for this trigger"
                              >
                                <BookOpen className="w-3 h-3 text-cyan-400" />
                                <span className="hidden sm:inline">Guide</span>
                              </button>
                            )}

                            {/* Test Simulator Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (testingTriggerId === trig.id) {
                                  setTestingTriggerId(null);
                                  setTestSimResult(null);
                                } else {
                                  setTestingTriggerId(trig.id);
                                  setTestSimResult(null);
                                  if (trig.keywords && trig.keywords.length > 0) {
                                    setTestInputText(`Hello, I want ${trig.keywords[0]} please`);
                                  } else if (trig.commentKeywords && trig.commentKeywords.length > 0) {
                                    setTestInputText(trig.commentKeywords[0]);
                                  } else if (trig.refPayload) {
                                    setTestInputText(trig.refPayload);
                                  } else {
                                    setTestInputText('test');
                                  }
                                }
                              }}
                              className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer border ${
                                testingTriggerId === trig.id 
                                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md shadow-amber-500/20' 
                                  : 'bg-white/5 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border-white/10'
                              }`}
                              title="Instant live trigger match simulation"
                            >
                              <Play className="w-3 h-3 text-amber-400 fill-amber-400" />
                              <span className="hidden sm:inline">Test</span>
                            </button>

                            {/* Enable/Disable Toggle */}
                            <button
                              type="button"
                              onClick={() => {
                                if (onToggleTrigger) onToggleTrigger(trig.id);
                                else handleUpdateTrigger(trig.id, { enabled: !trig.enabled });
                              }}
                              className={`w-7 h-4 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                                trig.enabled ? 'bg-emerald-500 justify-end' : 'bg-slate-700 justify-start'
                              }`}
                              title={trig.enabled ? 'Click to pause trigger' : 'Click to enable trigger'}
                            >
                              <div className="w-3 h-3 rounded-full bg-white shadow-sm" />
                            </button>

                            {/* Expand/Collapse Chevron */}
                            <button
                              type="button"
                              onClick={() => setExpandedTriggerId(isExpanded ? null : trig.id)}
                              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>

                            {/* Delete Trigger Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteTrigger(trig.id)}
                              className="p-1 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                              title="Delete this trigger"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Interactive Trigger Match Simulator Panel */}
                        {testingTriggerId === trig.id && (
                          <div className="p-3.5 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/20 border-t border-amber-500/30 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                <span className="text-xs font-bold text-amber-300">Live Trigger Simulator</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200 font-mono font-semibold">
                                  Instant Validation
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setTestingTriggerId(null);
                                  setTestSimResult(null);
                                }}
                                className="text-slate-400 hover:text-white text-xs cursor-pointer"
                              >
                                Close Test
                              </button>
                            </div>

                            <p className="text-[11px] text-slate-400">
                              Verify that an incoming subscriber interaction correctly fires this trigger and complies with Meta's 24-hour rule.
                            </p>

                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={testInputText}
                                onChange={(e) => setTestInputText(e.target.value)}
                                placeholder="Enter simulated subscriber message or comment..."
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    runTriggerSimulator(trig);
                                  }
                                }}
                                className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => runTriggerSimulator(trig)}
                                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all flex-shrink-0"
                              >
                                <Zap className="w-3.5 h-3.5 fill-slate-950" />
                                <span>Run Test</span>
                              </button>
                            </div>

                            {testSimResult && (
                              <div className={`p-3 rounded-xl border space-y-2 animate-in fade-in zoom-in-95 duration-150 ${
                                testSimResult.matched
                                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100'
                                  : 'bg-rose-950/40 border-rose-500/40 text-rose-100'
                              }`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 font-bold text-xs">
                                    {testSimResult.matched ? (
                                      <>
                                        <Check className="w-4 h-4 text-emerald-400" />
                                        <span className="text-emerald-300">Trigger Fired Successfully!</span>
                                      </>
                                    ) : (
                                      <>
                                        <X className="w-4 h-4 text-rose-400" />
                                        <span className="text-rose-300">No Trigger Match</span>
                                      </>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 border border-white/10">
                                    {testSimResult.rule}
                                  </span>
                                </div>

                                <p className="text-[11px] opacity-90 leading-relaxed">
                                  {testSimResult.details}
                                </p>

                                {testSimResult.matched && (
                                  <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                                    <span className="flex items-center gap-1 text-emerald-300 font-semibold">
                                      <Check className="w-3 h-3 text-emerald-400" />
                                      Meta 24-Hour Messaging Window: OPENED
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono">
                                      Next Node: {testSimResult.nextStepTitle}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Expanded Trigger Configuration Form */}
                        {isExpanded && (
                          <div className="p-3.5 pt-0 border-t border-white/5 space-y-3 mt-1 bg-slate-900/40">
                            {/* Trigger Title Input */}
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                Trigger Label
                              </label>
                              <input
                                type="text"
                                value={trig.title}
                                onChange={(e) => handleUpdateTrigger(trig.id, { title: e.target.value })}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                              />
                            </div>

                            {/* Universal Opt-In Trigger Keywords & Matching Rules */}
                            <div className="bg-slate-950/80 border border-blue-500/30 rounded-2xl p-3.5 space-y-3 shadow-inner">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Hash className="w-4 h-4 text-blue-400" />
                                  <span className="text-xs font-bold text-white">Trigger Keywords & Matching Rules</span>
                                </div>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold">
                                  {trig.keywordMode === 'any' ? 'ANY INTERACTION' : `${(trig.keywords || []).length} KEYWORDS`}
                                </span>
                              </div>

                              {/* Opt-In Triggering Mode: Specific Keywords vs Any Interaction */}
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                  Opt-In Triggering Mode
                                </label>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleUpdateTrigger(trig.id, { 
                                        keywordMode: 'keywords',
                                        commentMatchRule: 'contains'
                                      });
                                    }}
                                    className={`px-3 py-2 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                                      trig.keywordMode !== 'any' && trig.commentMatchRule !== 'any'
                                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-200 font-semibold shadow-sm'
                                        : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200'
                                    }`}
                                  >
                                    <span>Specific Keywords</span>
                                    {trig.keywordMode !== 'any' && trig.commentMatchRule !== 'any' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleUpdateTrigger(trig.id, { 
                                        keywordMode: 'any',
                                        commentMatchRule: 'any'
                                      });
                                    }}
                                    className={`px-3 py-2 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                                      trig.keywordMode === 'any' || trig.commentMatchRule === 'any'
                                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 font-semibold shadow-sm'
                                        : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200'
                                    }`}
                                  >
                                    <span>Any Interaction</span>
                                    {(trig.keywordMode === 'any' || trig.commentMatchRule === 'any') && <Check className="w-3.5 h-3.5 text-amber-400" />}
                                  </button>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  {trig.keywordMode === 'any' || trig.commentMatchRule === 'any'
                                    ? '⚡ Triggers immediately on any inbound message, comment, story mention, or link visit.'
                                    : '🎯 Triggers only when the incoming text or comment matches one of the keywords below.'}
                                </p>
                              </div>

                              {/* Matching Condition: Contains, Exact, Starts With */}
                              {trig.keywordMode !== 'any' && trig.commentMatchRule !== 'any' && (
                                <div className="space-y-3 pt-2 border-t border-white/5">
                                  <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                      Match Condition
                                    </label>
                                    <div className="grid grid-cols-3 gap-1.5 text-xs">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateTrigger(trig.id, { matchRule: 'contains' })}
                                        className={`px-2 py-1.5 rounded-xl border text-center cursor-pointer transition-all ${
                                          (trig.matchRule || 'contains') === 'contains'
                                            ? 'bg-blue-600/30 border-blue-500/60 text-blue-200 font-semibold shadow-sm'
                                            : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200'
                                        }`}
                                      >
                                        <div className="text-[11px] font-bold">Contains</div>
                                        <div className="text-[9px] text-slate-400 mt-0.5">Anywhere</div>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateTrigger(trig.id, { matchRule: 'exact' })}
                                        className={`px-2 py-1.5 rounded-xl border text-center cursor-pointer transition-all ${
                                          trig.matchRule === 'exact'
                                            ? 'bg-blue-600/30 border-blue-500/60 text-blue-200 font-semibold shadow-sm'
                                            : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200'
                                        }`}
                                      >
                                        <div className="text-[11px] font-bold">Exact Match</div>
                                        <div className="text-[9px] text-slate-400 mt-0.5">Whole message</div>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateTrigger(trig.id, { matchRule: 'starts_with' })}
                                        className={`px-2 py-1.5 rounded-xl border text-center cursor-pointer transition-all ${
                                          trig.matchRule === 'starts_with'
                                            ? 'bg-blue-600/30 border-blue-500/60 text-blue-200 font-semibold shadow-sm'
                                            : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200'
                                        }`}
                                      >
                                        <div className="text-[11px] font-bold">Starts With</div>
                                        <div className="text-[9px] text-slate-400 mt-0.5">First word</div>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Active Trigger Keywords Tags */}
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <label className="text-[10px] font-bold uppercase text-slate-400">
                                        Active Trigger Keywords
                                      </label>
                                      <span className="text-[10px] text-slate-500 font-mono">
                                        Case-insensitive
                                      </span>
                                    </div>

                                    {(trig.keywords && trig.keywords.length > 0) ? (
                                      <div className="flex flex-wrap gap-1.5 mb-2.5 max-h-32 overflow-y-auto p-2 bg-slate-900 rounded-xl border border-white/5">
                                        {trig.keywords.map((kw, kwIdx) => (
                                          <span 
                                            key={kwIdx} 
                                            className="bg-blue-500/20 text-blue-200 border border-blue-500/40 px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm group hover:border-blue-400 transition-colors"
                                          >
                                            <span>#{kw}</span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const updatedKws = (trig.keywords || []).filter((_, idx) => idx !== kwIdx);
                                                const updates: Partial<FlowTrigger> = {
                                                  keywords: updatedKws,
                                                  ...(trig.commentKeywords ? { commentKeywords: updatedKws } : {})
                                                };
                                                handleUpdateTrigger(trig.id, updates);
                                              }}
                                              className="text-blue-400 hover:text-red-400 cursor-pointer transition-colors"
                                              title="Remove keyword"
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="p-2.5 rounded-xl bg-slate-900 border border-dashed border-white/10 text-center text-xs text-slate-400 mb-2.5">
                                        No keywords set yet. Add keywords below or click suggestions.
                                      </div>
                                    )}

                                    {/* Add Keywords Input */}
                                    <div className="flex gap-2">
                                      <input data-no-emoji
                                        type="text"
                                        value={newKeywordInputs[trig.id] || ''}
                                        onChange={(e) => setNewKeywordInputs(prev => ({ ...prev, [trig.id]: e.target.value }))}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddKeywordsToTrigger(trig.id, newKeywordInputs[trig.id] || '');
                                          }
                                        }}
                                        placeholder="Add keyword or comma-separate (e.g. VIP, DEMO, START)..."
                                        className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 font-mono uppercase placeholder:normal-case placeholder:text-slate-500"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleAddKeywordsToTrigger(trig.id, newKeywordInputs[trig.id] || '')}
                                        className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md flex items-center gap-1"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Add</span>
                                      </button>
                                    </div>

                                    {/* Quick 1-Click Recommended Keyword Presets */}
                                    <div className="mt-2.5 pt-2 border-t border-white/5">
                                      <div className="text-[10px] text-slate-400 font-semibold mb-1.5 flex items-center gap-1">
                                        <Sparkles className="w-3 h-3 text-amber-400" />
                                        <span>Suggested Presets for this Tool (Click to Add):</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        {getSmartKeywordPresets(trig.type).map((preset) => {
                                          const isAlreadyAdded = (trig.keywords || []).includes(preset);
                                          return (
                                            <button
                                              key={preset}
                                              type="button"
                                              disabled={isAlreadyAdded}
                                              onClick={() => handleAddPresetKeyword(trig.id, preset)}
                                              className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                                                isAlreadyAdded
                                                  ? 'bg-white/5 text-slate-500 border-white/5 cursor-not-allowed'
                                                  : 'bg-slate-900 hover:bg-blue-500/20 text-slate-300 hover:text-blue-300 border-white/10 hover:border-blue-500/30'
                                              }`}
                                            >
                                              <span>{isAlreadyAdded ? '✓' : '+'}</span>
                                              <span>{preset}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Tool-Specific Companion Settings */}
                            {/* Post comments triggers (Instagram & Facebook) */}
                            {(trig.type === 'ig_comments' || trig.type === 'fb_comments' || trig.type === 'ig_live_comment') && (
                              <div className="space-y-2.5 p-3 rounded-2xl bg-slate-950/60 border border-white/10">
                                <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                  <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>Post & Comment Settings</span>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    Target Post or Reel URL
                                  </label>
                                  <input
                                    type="text"
                                    value={trig.postUrl || ''}
                                    onChange={(e) => handleUpdateTrigger(trig.id, { postUrl: e.target.value })}
                                    placeholder="https://instagram.com/p/C8x9qL1..."
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    Public Comment Auto-Reply (Optional)
                                  </label>
                                  <input
                                    type="text"
                                    value={trig.publicCommentReply || ''}
                                    onChange={(e) => handleUpdateTrigger(trig.id, { publicCommentReply: e.target.value })}
                                    placeholder="Check your DMs! Just sent you the link 🔥"
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                                  />
                                </div>
                              </div>
                            )}

                            {/* Story mentions & Story replies */}
                            {(trig.type === 'ig_story_mention' || trig.type === 'ig_story_reply') && (
                              <div className="space-y-2 p-3 rounded-2xl bg-slate-950/60 border border-pink-500/20 text-xs">
                                <div className="text-pink-300 font-semibold flex items-center gap-1.5">
                                  <Instagram className="w-3.5 h-3.5" />
                                  <span>Instagram Stories Trigger Integration</span>
                                </div>
                                <p className="text-[11px] text-slate-300 leading-relaxed">
                                  When a subscriber mentions @yourhandle in their Instagram Story or sends a direct reply to your active Story matching any of the keywords above, this bot map triggers instantly and opens the Meta 24-hour window.
                                </p>
                              </div>
                            )}

                            {/* Click-to-Messenger / Instagram Ads */}
                            {(trig.type === 'fb_ad' || trig.type === 'ig_ad' || trig.type === 'wa_ad') && (
                              <div className="space-y-2.5 p-3 rounded-2xl bg-slate-950/60 border border-white/10">
                                <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                  <Zap className="w-3.5 h-3.5 text-blue-400" />
                                  <span>Meta Ad Campaign Settings</span>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    Connected Meta Ad Campaign Name
                                  </label>
                                  <input data-no-emoji
                                    type="text"
                                    value={trig.adCampaignName || ''}
                                    onChange={(e) => handleUpdateTrigger(trig.id, { adCampaignName: e.target.value })}
                                    placeholder="Chatmize Ad Campaign #4102"
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    Meta Ad ID / Ref Payload
                                  </label>
                                  <input data-no-emoji
                                    type="text"
                                    value={trig.adCampaignId || ''}
                                    onChange={(e) => handleUpdateTrigger(trig.id, { adCampaignId: e.target.value })}
                                    placeholder="act_29103849102"
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 font-mono"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCopiedTriggerId(trig.id);
                                    navigator.clipboard.writeText(JSON.stringify({
                                      source: 'chatmize_meta_ad',
                                      flow_id: node.id,
                                      campaign_id: trig.adCampaignId || 'act_29103849102',
                                      keyword: trig.adPayloadKeyword || (trig.keywords ? trig.keywords[0] : 'START'),
                                      greeting_text: 'Hey {{user_first_name}}, thanks for clicking our ad!'
                                    }, null, 2));
                                    setTimeout(() => setCopiedTriggerId(null), 2500);
                                  }}
                                  className="w-full py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  {copiedTriggerId === trig.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                  <span>{copiedTriggerId === trig.id ? 'JSON Ad Payload Copied!' : 'Copy Meta Ads JSON Setup Payload'}</span>
                                </button>
                              </div>
                            )}

                            {/* Referral Links (m.me, ig.me, WhatsApp Link / QR) */}
                            {(trig.type === 'fb_ref_url' || trig.type === 'ig_ref_link' || trig.type === 'wa_link' || trig.type === 'fb_qr_code') && (
                              <div className="space-y-2.5 p-3 rounded-2xl bg-slate-950/60 border border-white/10">
                                <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                  <Link2 className="w-3.5 h-3.5 text-blue-400" />
                                  <span>Direct Referral Link & QR Code</span>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    Custom Referral Parameter (ref)
                                  </label>
                                  <input
                                    type="text"
                                    value={trig.refPayload || ''}
                                    onChange={(e) => {
                                      const val = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                                      const baseUrl = trig.type === 'fb_ref_url' 
                                        ? 'https://m.me/chatmize?ref=' 
                                        : trig.type === 'ig_ref_link' 
                                        ? 'https://ig.me/m/chatmize?ref=' 
                                        : 'https://wa.me/18005550199?text=';
                                      handleUpdateTrigger(trig.id, { 
                                        refPayload: val,
                                        refUrl: `${baseUrl}${val}`
                                      });
                                    }}
                                    placeholder="promo_offer"
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 font-mono"
                                  />
                                </div>

                                {trig.type === 'wa_link' && (
                                  <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                      WhatsApp Prefilled Message
                                    </label>
                                    <input
                                      type="text"
                                      value={trig.waPreFillText || ''}
                                      onChange={(e) => handleUpdateTrigger(trig.id, { waPreFillText: e.target.value })}
                                      placeholder="Hi! I want to claim the discount"
                                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                                    />
                                  </div>
                                )}

                                <div className="p-2 rounded-xl bg-slate-950 border border-white/10 flex items-center justify-between gap-2">
                                  <div className="font-mono text-[11px] text-blue-300 truncate">
                                    {trig.refUrl || (
                                      trig.type === 'fb_ref_url' ? 'https://m.me/chatmize?ref=promo_offer' :
                                      trig.type === 'ig_ref_link' ? 'https://ig.me/m/chatmize?ref=promo_offer' :
                                      'https://wa.me/18005550199?text=START'
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const url = trig.refUrl || (
                                        trig.type === 'fb_ref_url' ? 'https://m.me/chatmize?ref=promo_offer' :
                                        trig.type === 'ig_ref_link' ? 'https://ig.me/m/chatmize?ref=promo_offer' :
                                        'https://wa.me/18005550199?text=START'
                                      );
                                      navigator.clipboard.writeText(url);
                                      setCopiedTriggerId(trig.id);
                                      setTimeout(() => setCopiedTriggerId(null), 2500);
                                    }}
                                    className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 flex-shrink-0 cursor-pointer"
                                  >
                                    {copiedTriggerId === trig.id ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                                    <span>{copiedTriggerId === trig.id ? 'Copied' : 'Copy'}</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Growth Tools: Website Popups & Widgets */}
                            {(trig.type === 'web_modal' || trig.type === 'web_slidein' || trig.type === 'web_bar' || trig.type === 'web_embed_form' || trig.type === 'landing_page' || trig.type === 'fb_customer_chat') && (
                              <div className="space-y-2.5 p-3 rounded-2xl bg-slate-950/60 border border-white/10">
                                <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                  <Layout className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>Website Widget Copy</span>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    Widget Headline
                                  </label>
                                  <input
                                    type="text"
                                    value={trig.widgetHeadline || ''}
                                    onChange={(e) => handleUpdateTrigger(trig.id, { widgetHeadline: e.target.value })}
                                    placeholder="Get the Free Workshop Blueprint in Messenger!"
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    CTA Button Label
                                  </label>
                                  <input
                                    type="text"
                                    value={trig.widgetButtonText || ''}
                                    onChange={(e) => handleUpdateTrigger(trig.id, { widgetButtonText: e.target.value })}
                                    placeholder="Send to Messenger →"
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                                  />
                                </div>
                              </div>
                            )}

                            {/* External Inbound Webhook / Integrations */}
                            {(trig.type === 'webhook' || trig.type === 'shopify_trigger' || trig.type === 'lead_form') && (
                              <div className="space-y-2.5 p-3 rounded-2xl bg-slate-950/60 border border-white/10">
                                <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                  <Webhook className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Inbound Webhook API Endpoint</span>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                    Webhook URL
                                  </label>
                                  <div className="p-2 rounded-xl bg-slate-950 border border-white/10 flex items-center justify-between gap-2">
                                    <div className="font-mono text-[10px] text-amber-300 truncate">
                                      {trig.webhookUrl || `https://api.chatmize.io/v1/webhook/${trig.id}`}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(trig.webhookUrl || `https://api.chatmize.io/v1/webhook/${trig.id}`);
                                        setCopiedTriggerId(trig.id);
                                        setTimeout(() => setCopiedTriggerId(null), 2500);
                                      }}
                                      className="p-1 px-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 flex-shrink-0 cursor-pointer"
                                    >
                                      {copiedTriggerId === trig.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                      <span>{copiedTriggerId === trig.id ? 'Copied' : 'Copy'}</span>
                                    </button>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setTestedWebhookId(trig.id);
                                    setTimeout(() => setTestedWebhookId(null), 3000);
                                  }}
                                  className="w-full py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  {testedWebhookId === trig.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Zap className="w-3.5 h-3.5" />}
                                  <span>{testedWebhookId === trig.id ? 'Test Event Received Successfully! (HTTP 200)' : 'Simulate Inbound Webhook Event'}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center rounded-2xl bg-slate-950/60 border border-dashed border-white/10 space-y-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 mx-auto flex items-center justify-center border border-blue-500/30">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">No Entry Points Attached Yet</div>
                    <div className="text-[11px] text-slate-400 max-w-xs mx-auto mt-1">
                      Choose how contacts start this conversation: Instagram DMs, Facebook post comments, Ads, or referral links.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenTriggerModal) onOpenTriggerModal();
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer shadow-lg"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Choose Starting Triggers</span>
                  </button>
                </div>
              )}

              {/* Bottom dashed button to add more */}
              {node.triggers && node.triggers.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenTriggerModal) onOpenTriggerModal();
                  }}
                  className="w-full py-2 border border-dashed border-white/20 hover:border-cyan-500/50 hover:bg-cyan-500/10 text-slate-300 hover:text-cyan-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 text-cyan-400" />
                  <span>+ Add Another Entry Point / Growth Tool</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 2. SMART DELAY CONFIGURATION & 24-HOUR WINDOW BOUNDARY IMPACT */}
        {isDelay && (
          <div className="space-y-4">
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  <span>Delay Duration & Timing</span>
                </label>
                <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                  Timer
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-2">
                  Quick Presets
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { label: '15 Minutes', text: 'Wait 15 minutes before next step', hours: 0.25 },
                    { label: '1 Hour', text: 'Wait 1 hour before next message', hours: 1 },
                    { label: '6 Hours', text: 'Wait 6 hours before follow-up', hours: 6 },
                    { label: '23 Hours', text: 'Wait 23 hours (inside 24h limit)', hours: 23 },
                    { label: '2 Days (48h)', text: 'Wait 2 days for live workshop date', hours: 48 },
                    { label: '7 Days (168h)', text: 'Wait 7 days for weekly drops', hours: 168 },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onAutoUpdate({ delayText: preset.text, delayHours: preset.hours })}
                      className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition-all text-center ${
                        node.delayText === preset.text || node.delayHours === preset.hours
                          ? 'bg-purple-600 text-white border-purple-400'
                          : 'bg-slate-950/80 text-slate-300 border-white/10 hover:border-white/20'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                  Custom Delay Description / Timer Text
                </label>
                <input data-no-emoji
                  type="text"
                  value={node.delayText || node.content || ''}
                  onChange={(e) => onAutoUpdate({ delayText: e.target.value, content: e.target.value })}
                  placeholder="e.g. Wait 2 days for live workshop date"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                />
              </div>

              {/* Meta Policy Window Boundary Impact Visualizer */}
              {(() => {
                const dText = (node.delayText || node.content || '').toLowerCase();
                const isOver24h = (node.delayHours && node.delayHours >= 24) ||
                  dText.includes('day') || dText.includes('week') || dText.includes('month') || dText.includes('post-24h') ||
                  (/\b(\d+)\s*h(?:ours?)?\b/i.test(dText) && parseInt(dText.match(/\b(\d+)\s*h(?:ours?)?\b/i)?.[1] || '0', 10) >= 24);

                if (isOver24h) {
                  return (
                    <div className="p-3 rounded-xl bg-purple-500/15 border border-purple-500/35 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                        <AlertCircle className="w-4 h-4 text-purple-400 flex-shrink-0" />
                        <span>Exceeds Meta's 24-Hour Window</span>
                      </div>
                      <p className="text-[11px] text-purple-200/90 leading-relaxed">
                        Messages connected downstream from this delay will deliver outside the standard 24h window. The system will automatically prompt you to configure an Outside-24h Rule (Message Tag, One-Time Notification, or Recurring Notification).
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Inside Standard 24h Window</span>
                    </div>
                    <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                      This delay completes within 24 hours. Connected downstream messages remain covered under Step 1 starting rules with promotional freedom and no tags needed.
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* 3. MESSAGE STEPS: Standard 24h Window OR Outside 24-Hour Rule Setup */}
        {isMessage && (
          <div>
            {!outsideInfo.isOutside ? (
              /* Case A: Node is inside the standard 24-hour window (Governed by First Node) */
              <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Governed by Step 1 Starting Rules</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Standard 24h Window
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  This step runs within the 24-hour session opened by the Starting Point. Free-form promotional offers, discounts, buttons, and carousels are 100% permitted with no tags needed.
                </p>
                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Sending this step outside the 24h window?</span>
                  <button
                    type="button"
                    onClick={() => onAutoUpdate({ isPost24h: true, outsideRuleType: 'tag', messageTag: 'CONFIRMED_EVENT_UPDATE' })}
                    className="text-[11px] font-bold text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 px-2.5 py-1 rounded-lg border border-purple-500/30 transition-colors cursor-pointer"
                  >
                    Setup Outside-24h Rule
                  </button>
                </div>
              </div>
            ) : (
              /* Case B: Node is outside the rules and requires an approved Meta setup */
              <div className="bg-slate-900/95 border border-purple-500/40 rounded-2xl p-4 space-y-4 shadow-lg shadow-purple-950/20">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                      <AlertCircle className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <span>Outside 24-Hour Rule Setup</span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                      {outsideInfo.reason === 'delay'
                        ? `Triggered after delay exceeding 24h (${outsideInfo.delayNodeTitle || 'Delay'}: ${outsideInfo.delayText || 'Post-24h'}). Meta policy requires an approved re-engagement rule.`
                        : 'This step is configured to deliver outside Meta\'s standard 24-hour window.'}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                    Post-24h Delivery
                  </span>
                </div>

                {/* Tab Selector for Approved Outside-24h Mechanisms */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-2">
                    Choose Meta Outside-24h Delivery Rule
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onAutoUpdate({ outsideRuleType: 'tag', messageTag: node.messageTag && node.messageTag !== 'NONE' ? node.messageTag : 'CONFIRMED_EVENT_UPDATE' })}
                      className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition-all text-center ${
                        (node.outsideRuleType === 'tag' || (!node.outsideRuleType && node.messageTag && node.messageTag !== 'NONE'))
                          ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                          : 'bg-slate-950/80 text-slate-300 border-white/10 hover:border-white/20'
                      }`}
                    >
                      🏷️ Message Tag
                    </button>
                    <button
                      type="button"
                      onClick={() => onAutoUpdate({ outsideRuleType: 'otn', otnTopic: node.otnTopic || 'Live Event Replay' })}
                      className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition-all text-center ${
                        node.outsideRuleType === 'otn'
                          ? 'bg-cyan-600 text-white border-cyan-400 shadow-sm'
                          : 'bg-slate-950/80 text-slate-300 border-white/10 hover:border-white/20'
                      }`}
                    >
                      🎟️ OTN Token
                    </button>
                    <button
                      type="button"
                      onClick={() => onAutoUpdate({ outsideRuleType: 'recurring_notification', rnTopic: node.rnTopic || 'VIP Weekly Drops', rnFrequency: node.rnFrequency || 'weekly' })}
                      className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition-all text-center ${
                        node.outsideRuleType === 'recurring_notification'
                          ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                          : 'bg-slate-950/80 text-slate-300 border-white/10 hover:border-white/20'
                      }`}
                    >
                      🔔 Recurring (RN)
                    </button>
                  </div>
                </div>

                {/* Sub-config: If Message Tag */}
                {(node.outsideRuleType === 'tag' || (!node.outsideRuleType && node.messageTag && node.messageTag !== 'NONE')) && (
                  <div className="space-y-3 pt-1 border-t border-purple-500/20">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1.5">
                        Approved Meta Message Tag
                      </label>
                      <div className="relative">
                        <select
                          value={node.messageTag || 'CONFIRMED_EVENT_UPDATE'}
                          onChange={(e) => onAutoUpdate({ messageTag: e.target.value as MetaMessageTag })}
                          className="w-full appearance-none bg-slate-950 border border-white/10 rounded-xl px-3 py-2 pr-8 text-xs text-white outline-none focus:border-purple-500 transition-colors cursor-pointer"
                        >
                          <option value="CONFIRMED_EVENT_UPDATE">CONFIRMED_EVENT_UPDATE — Reminders for registered events / webinars</option>
                          <option value="POST_PURCHASE_UPDATE">POST_PURCHASE_UPDATE — Receipts, order confirmations & delivery tracking</option>
                          <option value="ACCOUNT_UPDATE">ACCOUNT_UPDATE — Security alerts, password & account status</option>
                          <option value="HUMAN_AGENT">HUMAN_AGENT — Live agent support (Up to 7 days / 168h)</option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        Strict policy: Message tags strictly forbid promotional copy, coupon codes, discounts, or sales pitches.
                      </p>
                    </div>

                    {/* Real-time Anti-Promotion Scanner */}
                    {(() => {
                      const fullText = (node.content || '') + ' ' + (node.components || []).map(c => (c.text || '') + ' ' + (c.cardTitle || '') + ' ' + (c.cardSubtitle || '')).join(' ');
                      const compliance = validateMessageTagCompliance(fullText, (node.messageTag || 'CONFIRMED_EVENT_UPDATE') as MetaMessageTag);
                      
                      if (!compliance.compliant) {
                        return (
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
                            <div className="flex items-center gap-1.5 font-bold text-amber-300">
                              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                              <span>Promotional Language Detected for Message Tag</span>
                            </div>
                            <p className="text-[11px] text-amber-200/90 leading-relaxed">
                              Flagged keywords: <span className="font-mono font-bold text-amber-300">"{compliance.flaggedWords.join(', ')}"</span>. Message Tags will be blocked by Meta if promotional words are sent outside 24h.
                            </p>
                            <div className="flex flex-wrap gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => onAutoUpdate({ outsideRuleType: 'otn', otnTopic: 'Live Replay / Promotion' })}
                                className="px-2.5 py-1 bg-cyan-500 text-slate-950 font-bold rounded-lg text-[11px] hover:bg-cyan-400 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <BellRing className="w-3 h-3" />
                                <span>Switch to OTN (Promo Allowed!)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onAutoUpdate({ outsideRuleType: 'recurring_notification', rnTopic: 'VIP Special Offers' })}
                                className="px-2.5 py-1 bg-blue-500 text-white font-bold rounded-lg text-[11px] hover:bg-blue-400 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Switch to RN</span>
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          <span>Compliant with Meta Tag non-promotional policy guidelines.</span>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Sub-config: If One-Time Notification (OTN) */}
                {node.outsideRuleType === 'otn' && (
                  <div className="space-y-3 pt-1 border-t border-cyan-500/20">
                    <div className="bg-cyan-950/40 border border-cyan-500/30 rounded-xl p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                        <BellRing className="w-4 h-4 text-cyan-400" />
                        <span>One-Time Notification (OTN) Rule</span>
                      </div>
                      <p className="text-[11px] text-cyan-200/90 leading-relaxed">
                        Meta OTN allows sending 1 follow-up message outside the 24-hour window for contacts who granted an OTN token. Unlike Message Tags, <strong className="text-white">promotional & marketing content is 100% permitted</strong>!
                      </p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1.5">
                        OTN Token Topic / Purpose
                      </label>
                      <input data-no-emoji
                        type="text"
                        value={node.otnTopic || ''}
                        onChange={(e) => onAutoUpdate({ otnTopic: e.target.value })}
                        placeholder="e.g. Masterclass Replay, Flash Sale Drop, Back in Stock"
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-500 transition-colors"
                      />
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        Must match the topic promised when the subscriber clicked "Notify Me" during their initial 24h window.
                      </p>
                    </div>

                    {/* Token pairing helper */}
                    {(() => {
                      const hasUpstreamOptin = nodes.some(n => 
                        n.id !== node.id && 
                        (n.components || []).some(c => c.type === 'one_time_notification_optin' || c.type === 'recurring_notification_optin')
                      );

                      if (!hasUpstreamOptin) {
                        return (
                          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-amber-200">No OTN Opt-In card detected in earlier steps.</span>
                            <button
                              type="button"
                              onClick={() => {
                                const targetStep = nodes.find(n => n.id === 'step-2') || nodes.find(n => n.type === 'message' && n.id !== node.id);
                                if (targetStep && onUpdateNode) {
                                  const updatedComps = [...(targetStep.components || []), {
                                    id: `comp-otn-${Date.now()}`,
                                    type: 'one_time_notification_optin' as MessageComponentType,
                                    otnTopic: node.otnTopic || 'Masterclass Replay Alert',
                                    otnButtonText: 'Notify Me'
                                  }];
                                  onUpdateNode(targetStep.id, { components: updatedComps });
                                }
                              }}
                              className="text-[10px] font-bold text-cyan-300 hover:text-white bg-cyan-500/20 hover:bg-cyan-500/30 px-2 py-1 rounded-lg border border-cyan-500/40 whitespace-nowrap transition-colors cursor-pointer"
                            >
                              + Add Opt-In to Step 2
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[11px] flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Subscribers collect this OTN token in an earlier step before this delay triggers.</span>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Sub-config: If Recurring Notification (RN) */}
                {node.outsideRuleType === 'recurring_notification' && (
                  <div className="space-y-3 pt-1 border-t border-blue-500/20">
                    <div className="bg-blue-950/40 border border-blue-500/30 rounded-xl p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-300">
                        <RefreshCw className="w-4 h-4 text-blue-400" />
                        <span>Recurring Notifications (RN) Marketing Rule</span>
                      </div>
                      <p className="text-[11px] text-blue-200/90 leading-relaxed">
                        Meta's flagship Marketing API to send scheduled broadcasts outside the 24-hour window. <strong className="text-white">Promotional offers, newsletters, and drops are 100% permitted</strong>.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1.5">
                          Topic
                        </label>
                        <input data-no-emoji
                          type="text"
                          value={node.rnTopic || ''}
                          onChange={(e) => onAutoUpdate({ rnTopic: e.target.value })}
                          placeholder="e.g. VIP Weekly Drops"
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1.5">
                          Frequency
                        </label>
                        <select
                          value={node.rnFrequency || 'weekly'}
                          onChange={(e) => onAutoUpdate({ rnFrequency: e.target.value as MetaRecurringFrequency })}
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500 transition-colors cursor-pointer"
                        >
                          <option value="daily">Daily (6 Months Active)</option>
                          <option value="weekly">Weekly (9 Months Active)</option>
                          <option value="monthly">Monthly (12 Months Active)</option>
                        </select>
                      </div>
                    </div>

                    {/* Token pairing helper */}
                    {(() => {
                      const hasUpstreamOptin = nodes.some(n => 
                        n.id !== node.id && 
                        (n.components || []).some(c => c.type === 'recurring_notification_optin')
                      );

                      if (!hasUpstreamOptin) {
                        return (
                          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-amber-200">No Recurring Opt-In card detected in earlier steps.</span>
                            <button
                              type="button"
                              onClick={() => {
                                const targetStep = nodes.find(n => n.id === 'step-2') || nodes.find(n => n.type === 'message' && n.id !== node.id);
                                if (targetStep && onUpdateNode) {
                                  const updatedComps = [...(targetStep.components || []), {
                                    id: `comp-rn-${Date.now()}`,
                                    type: 'recurring_notification_optin' as MessageComponentType,
                                    rnTopic: node.rnTopic || 'VIP Weekly Drops',
                                    rnFrequency: node.rnFrequency || 'weekly',
                                    rnTitle: 'Get VIP Weekly Drops & Special Alerts',
                                    rnButtonText: 'Get Updates'
                                  }];
                                  onUpdateNode(targetStep.id, { components: updatedComps });
                                }
                              }}
                              className="text-[10px] font-bold text-blue-300 hover:text-white bg-blue-500/20 hover:bg-blue-500/30 px-2 py-1 rounded-lg border border-blue-500/40 whitespace-nowrap transition-colors cursor-pointer"
                            >
                              + Add Opt-In to Step 2
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[11px] flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Subscribers collect this Recurring subscription token in an earlier step.</span>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Reset button to clear post-24h designation */}
                <div className="pt-2 border-t border-white/5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onAutoUpdate({ isPost24h: false, outsideRuleType: undefined, messageTag: 'NONE' })}
                    className="text-[10px] text-slate-400 hover:text-slate-200 underline transition-colors cursor-pointer"
                  >
                    Move back inside standard 24h window
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Message Content & Formatting (Only for actual message nodes, not trigger/delay/action) */}
        {!isAction && !isDelay && !isTrigger && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold uppercase text-slate-400">Message Text</label>
              <div className="flex gap-1.5">
                <EmojiPickerButton onPick={(e) => msgTextEmoji.insert(e, node.content || '', (v) => onAutoUpdate({ content: v }))} placement="down" />
                <PersonalizationPickerButton
                  onPick={(t) => msgPz.insert(t, node.content || '', (v) => onAutoUpdate({ content: v }))}
                  placement="down"
                  title="Insert personalization"
                />
                <button
                  onClick={() => onAutoUpdate({ content: (node.content || '') + ' {{first_name}}' })}
                  className="text-[11px] font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20"
                >
                  + {'{{first_name}}'}
                </button>
                <button
                  onClick={() => onAutoUpdate({ content: (node.content || '') + ' {{email}}' })}
                  className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20"
                >
                  + {'{{email}}'}
                </button>
              </div>
            </div>
            <textarea
              rows={6}
              ref={msgTextEmoji.ref}
              value={node.content || ''}
              onChange={(e) => onAutoUpdate({ content: e.target.value })}
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-3.5 text-sm text-white outline-none focus:border-blue-500 transition-colors resize-none leading-relaxed font-sans"
              placeholder="Type your bot response here..."
            />
          </div>
        )}

        {/* List of Added Components in this Step */}
        {node.type === 'message' && (
          <div>
            {node.components && node.components.length > 0 ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase text-slate-400">Step Components Sequence</label>
                  <span className="text-[10px] text-slate-500">Order executes top-to-bottom</span>
                </div>

                <div className="space-y-3">
                  {node.components.map((comp, idx) => (
                    <div 
                      key={comp.id} 
                      className={`bg-slate-900/90 border rounded-2xl p-3 space-y-3 transition-all ${
                        comp.type === 'typing' 
                          ? 'border-cyan-500/40 shadow-sm shadow-cyan-500/5' 
                          : comp.type === 'image'
                          ? 'border-emerald-500/30'
                          : comp.type === 'card'
                          ? 'border-purple-500/30'
                          : comp.type === 'gallery'
                          ? 'border-amber-500/30'
                          : 'border-blue-500/30'
                      }`}
                    >
                      {/* Component Item Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-slate-500 bg-white/5 w-5 h-5 rounded-full flex items-center justify-center">
                            {idx + 1}
                          </span>
                          {comp.type === 'typing' && (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                              <MoreHorizontal className="w-4 h-4 text-cyan-400" />
                              Typing Indicator
                            </span>
                          )}
                          {comp.type === 'text' && (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-blue-300">
                              <FileText className="w-4 h-4 text-blue-400" />
                              Text Bubble
                            </span>
                          )}
                          {comp.type === 'image' && (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                              <ImageIcon className="w-4 h-4 text-emerald-400" />
                              Image Attachment
                            </span>
                          )}
                          {comp.type === 'card' && (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                              <Layers className="w-4 h-4 text-purple-400" />
                              Card Block
                            </span>
                          )}
                          {comp.type === 'gallery' && (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                              <FolderPlus className="w-4 h-4 text-amber-400" />
                              Carousel Gallery
                            </span>
                          )}
                          {comp.type === 'recurring_notification_optin' && (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                              <BellRing className="w-4 h-4 text-cyan-400" />
                              Recurring Notification Opt-In
                            </span>
                          )}
                          {comp.type === 'one_time_notification_optin' && (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                              <Zap className="w-4 h-4 text-purple-400" />
                              One-Time Notification (OTN)
                            </span>
                          )}
                          {comp.type === 'whatsapp_template' && (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                              <MessageCircle className="w-4 h-4 text-emerald-400" />
                              WhatsApp Template
                            </span>
                          )}
                        </div>

                        {/* Order & Remove Controls */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveComponent(idx, 'up')}
                            disabled={idx === 0}
                            className={`p-1 rounded-lg transition-colors ${
                              idx === 0 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:text-white hover:bg-white/10'
                            }`}
                            title="Move up in sequence"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveComponent(idx, 'down')}
                            disabled={idx === (node.components?.length || 1) - 1}
                            className={`p-1 rounded-lg transition-colors ${
                              idx === (node.components?.length || 1) - 1 
                                ? 'text-slate-600 cursor-not-allowed' 
                                : 'text-slate-400 hover:text-white hover:bg-white/10'
                            }`}
                            title="Move down in sequence"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveComponent(comp.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-1"
                            title="Delete component"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* TYPING COMPONENT EDITOR */}
                      {comp.type === 'typing' && (
                        <div className="space-y-3 pt-1">
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Mimics realistic human typing in the recipient&apos;s DM window before the next message or card is revealed.
                          </p>

                          {/* Quick Duration Pills */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">
                              Typing Duration: <span className="text-cyan-300 font-mono text-xs">{comp.delaySeconds || 3} seconds</span>
                            </label>
                            <div className="flex gap-1.5">
                              {[1, 2, 3, 5, 8].map((sec) => (
                                <button
                                  key={sec}
                                  type="button"
                                  onClick={() => handleUpdateComponent(comp.id, { delaySeconds: sec })}
                                  className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all ${
                                    (comp.delaySeconds || 3) === sec
                                      ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-sm shadow-cyan-500/30'
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/5'
                                  }`}
                                >
                                  {sec}s
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Range Slider */}
                          <div className="pt-1">
                            <input 
                              type="range"
                              min="1"
                              max="10"
                              step="1"
                              value={comp.delaySeconds || 3}
                              onChange={(e) => handleUpdateComponent(comp.id, { delaySeconds: parseInt(e.target.value, 10) })}
                              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                            />
                            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                              <span>1s</span>
                              <span>5s</span>
                              <span>10s</span>
                            </div>
                          </div>

                          {/* Live Animated Mimic Preview Box */}
                          <div className="bg-slate-950/80 border border-cyan-500/30 rounded-xl p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="flex items-center gap-1 bg-cyan-500/15 px-2.5 py-1.5 rounded-full border border-cyan-500/30 shadow-inner">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                              <span className="text-[11px] text-cyan-300 font-medium">Bot is typing...</span>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                              {comp.delaySeconds || 3}s delay
                            </span>
                          </div>
                        </div>
                      )}

                      {/* TEXT COMPONENT EDITOR */}
                      {comp.type === 'text' && (
                        <div className="space-y-2 pt-1">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold uppercase text-slate-400">Bubble Text</label>
                            <div className="flex gap-1">
                              <EmojiPickerButton onPick={(e) => compEmoji.insert(`${comp.id}:text`, e, comp.text || '', (v) => handleUpdateComponent(comp.id, { text: v }))} placement="down" />
                              <PersonalizationPickerButton
                                onPick={(t) => compPz.insert(`bubble:${comp.id}`, t, comp.text || '', (v) => handleUpdateComponent(comp.id, { text: v }))}
                                placement="down"
                                title="Insert personalization"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateComponent(comp.id, { text: (comp.text || '') + ' {{first_name}}' })}
                                className="text-[10px] font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20"
                              >
                                + {'{{first_name}}'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateComponent(comp.id, { text: (comp.text || '') + ' {{email}}' })}
                                className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20"
                              >
                                + {'{{email}}'}
                              </button>
                            </div>
                          </div>
                          <textarea
                            rows={3}
                            ref={compEmoji.setRef(`${comp.id}:text`)}
                            value={comp.text || ''}
                            onChange={(e) => handleUpdateComponent(comp.id, { text: e.target.value })}
                            placeholder="Add additional message text..."
                            className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-blue-500 resize-none font-sans leading-relaxed"
                          />
                        </div>
                      )}

                      {/* IMAGE COMPONENT EDITOR */}
                      {comp.type === 'image' && (
                        <div className="space-y-3 pt-1">
                          {/* Image Presets */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">Preset Sample Images</label>
                            <div className="grid grid-cols-4 gap-1">
                              {PRESET_IMAGES.map((img, pIdx) => (
                                <button
                                  key={pIdx}
                                  type="button"
                                  onClick={() => handleUpdateComponent(comp.id, { imageUrl: img.url })}
                                  className={`py-1 px-1.5 rounded-lg text-[10px] font-medium truncate transition-all ${
                                    comp.imageUrl === img.url 
                                      ? 'bg-emerald-500 text-slate-950 font-bold' 
                                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                  }`}
                                >
                                  {img.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <ImageUpload
                              label="Image"
                              value={comp.imageUrl || ''}
                              onChange={(url) => handleUpdateComponent(comp.id, { imageUrl: url })}
                              accentClass="focus-within:border-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Caption (Optional)</label>
                            <input 
                              type="text" 
                              value={comp.imageCaption || ''} 
                              onChange={(e) => handleUpdateComponent(comp.id, { imageCaption: e.target.value })}
                              placeholder="Flyer or product description..."
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
                            />
                          </div>

                        </div>
                      )}

                      {/* CARD COMPONENT EDITOR */}
                      {comp.type === 'card' && (
                        <div className="space-y-3 pt-1">
                          {/* Image Presets for Card */}
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Card Header Image</label>
                            <div className="grid grid-cols-4 gap-1 mb-2">
                              {PRESET_IMAGES.map((img, pIdx) => (
                                <button
                                  key={pIdx}
                                  type="button"
                                  onClick={() => handleUpdateComponent(comp.id, { cardImageUrl: img.url })}
                                  className={`py-1 px-1.5 rounded-lg text-[10px] font-medium truncate transition-all ${
                                    comp.cardImageUrl === img.url 
                                      ? 'bg-purple-500 text-white font-bold' 
                                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                  }`}
                                >
                                  {img.label}
                                </button>
                              ))}
                            </div>
                            <ImageUpload
                              value={comp.cardImageUrl || ''}
                              onChange={(url) => handleUpdateComponent(comp.id, { cardImageUrl: url })}
                              accentClass="focus-within:border-purple-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Card Title</label>
                            <div className="relative">
                              <input 
                                type="text" 
                                ref={compEmoji.setRef(`${comp.id}:cardTitle`)}
                                value={comp.cardTitle || ''} 
                                onChange={(e) => handleUpdateComponent(comp.id, { cardTitle: e.target.value })}
                                placeholder="e.g. VIP Masterclass Pass"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl pl-2.5 pr-9 py-1.5 text-xs text-white outline-none focus:border-purple-500 font-bold"
                              />
                              <span className="absolute right-1 top-1/2 -translate-y-1/2">
                                <EmojiPickerButton onPick={(e) => compEmoji.insert(`${comp.id}:cardTitle`, e, comp.cardTitle || '', (v) => handleUpdateComponent(comp.id, { cardTitle: v }))} placement="up" />
                              </span>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Subtitle / Details</label>
                            <div className="relative">
                              <textarea 
                                rows={2}
                                ref={compEmoji.setRef(`${comp.id}:cardSubtitle`)}
                                value={comp.cardSubtitle || ''} 
                                onChange={(e) => handleUpdateComponent(comp.id, { cardSubtitle: e.target.value })}
                                placeholder="Brief description of the offer or content..."
                                className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 pr-9 text-xs text-white outline-none focus:border-purple-500 resize-none leading-relaxed"
                              />
                              <span className="absolute right-1.5 bottom-1.5">
                                <EmojiPickerButton onPick={(e) => compEmoji.insert(`${comp.id}:cardSubtitle`, e, comp.cardSubtitle || '', (v) => handleUpdateComponent(comp.id, { cardSubtitle: v }))} placement="up" />
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Button Label</label>
                              <div className="relative">
                                <input 
                                  type="text" 
                                  ref={compEmoji.setRef(`${comp.id}:cardButtonLabel`)}
                                  value={comp.cardButtonLabel || ''} 
                                  onChange={(e) => handleUpdateComponent(comp.id, { cardButtonLabel: e.target.value })}
                                  placeholder="e.g. Reserve Spot"
                                  className="w-full bg-slate-950 border border-white/10 rounded-xl pl-2.5 pr-9 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                                />
                                <span className="absolute right-1 top-1/2 -translate-y-1/2">
                                  <EmojiPickerButton onPick={(e) => compEmoji.insert(`${comp.id}:cardButtonLabel`, e, comp.cardButtonLabel || '', (v) => handleUpdateComponent(comp.id, { cardButtonLabel: v }))} placement="up" />
                                </span>
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Button Link</label>
                              <input 
                                type="text" 
                                value={comp.cardButtonUrl || ''} 
                                onChange={(e) => handleUpdateComponent(comp.id, { cardButtonUrl: e.target.value })}
                                placeholder="https://..."
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* GALLERY COMPONENT EDITOR */}
                      {comp.type === 'gallery' && (
                        <div className="space-y-3 pt-1">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold uppercase text-slate-400">Carousel Cards ({(comp.galleryCards || []).length})</label>
                            <button
                              type="button"
                              onClick={() => handleAddGalleryCard(comp.id)}
                              className="text-[10px] font-bold text-amber-300 hover:text-amber-200 bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/30 flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" /> Add Card
                            </button>
                          </div>

                          <div className="space-y-3">
                            {(comp.galleryCards || []).map((gcard, gIdx) => (
                              <div key={gcard.id} className="bg-slate-950 border border-amber-500/20 rounded-xl p-2.5 space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-amber-400">Card #{gIdx + 1}</span>
                                  {(comp.galleryCards?.length || 0) > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveGalleryCard(comp.id, gcard.id)}
                                      className="text-slate-500 hover:text-red-400 p-0.5"
                                      title="Remove card"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                                <input 
                                  type="text"
                                  value={gcard.title}
                                  onChange={(e) => handleUpdateGalleryCard(comp.id, gcard.id, { title: e.target.value })}
                                  placeholder="Card Title"
                                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-amber-500 font-bold"
                                />
                                <input 
                                  type="text"
                                  value={gcard.subtitle || ''}
                                  onChange={(e) => handleUpdateGalleryCard(comp.id, gcard.id, { subtitle: e.target.value })}
                                  placeholder="Subtitle description"
                                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-amber-500"
                                />
                                <div className="grid grid-cols-2 gap-1.5">
                                  <ImageUpload
                                    value={gcard.imageUrl || ''}
                                    onChange={(url) => handleUpdateGalleryCard(comp.id, gcard.id, { imageUrl: url })}
                                    accentClass="focus-within:border-amber-500"
                                    compact
                                  />
                                  <div className="relative">
                                    <input 
                                      type="text"
                                      ref={compEmoji.setRef(`${comp.id}:${gcard.id}:btn`)}
                                      value={gcard.buttonLabel || ''}
                                      onChange={(e) => handleUpdateGalleryCard(comp.id, gcard.id, { buttonLabel: e.target.value })}
                                      placeholder="Button text"
                                      className="w-full bg-slate-900 border border-white/10 rounded-lg pl-2 pr-8 py-1 text-[11px] text-white outline-none focus:border-amber-500"
                                    />
                                    <span className="absolute right-0.5 top-1/2 -translate-y-1/2">
                                      <EmojiPickerButton onPick={(e) => compEmoji.insert(`${comp.id}:${gcard.id}:btn`, e, gcard.buttonLabel || '', (v) => handleUpdateGalleryCard(comp.id, gcard.id, { buttonLabel: v }))} placement="up" />
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* RECURRING NOTIFICATION OPT-IN EDITOR */}
                      {comp.type === 'recurring_notification_optin' && (
                        <div className="space-y-3 pt-1">
                          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] leading-relaxed">
                            💡 <strong>Meta Recurring Notifications (Messenger & Instagram):</strong> When the user taps the opt-in button, Meta grants a secure subscription token allowing your bot to send recurring messages past the 24-hour window at the chosen frequency without policy violations!
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Topic / Campaign</label>
                              <input 
                                type="text" 
                                value={comp.rnTopic || ''} 
                                onChange={(e) => handleUpdateComponent(comp.id, { rnTopic: e.target.value })}
                                placeholder="VIP Weekly Drops"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Frequency</label>
                              <select
                                value={comp.rnFrequency || 'weekly'}
                                onChange={(e) => handleUpdateComponent(comp.id, { rnFrequency: e.target.value as 'daily' | 'weekly' | 'monthly' })}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                              >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Prompt / Card Title</label>
                            <input 
                              type="text" 
                              value={comp.rnTitle || ''} 
                              onChange={(e) => handleUpdateComponent(comp.id, { rnTitle: e.target.value })}
                              placeholder="Get VIP Weekly Drops & Flash Sale Alerts"
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Opt-In Button Text</label>
                            <input 
                              type="text" 
                              value={comp.rnButtonText || ''} 
                              onChange={(e) => handleUpdateComponent(comp.id, { rnButtonText: e.target.value })}
                              placeholder="Get Updates"
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                            />
                          </div>
                        </div>
                      )}

                      {/* ONE-TIME NOTIFICATION (OTN) EDITOR */}
                      {comp.type === 'one_time_notification_optin' && (
                        <div className="space-y-3 pt-1">
                          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] leading-relaxed">
                            ⚡ <strong>One-Time Notification (OTN):</strong> Requests 1 permission token to send an alert (e.g. Back in stock, flash price drop, webinar replay) after the 24-hour window has expired.
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Topic / Event Trigger</label>
                            <input 
                              type="text" 
                              value={comp.otnTopic || ''} 
                              onChange={(e) => handleUpdateComponent(comp.id, { otnTopic: e.target.value })}
                              placeholder="Back in Stock Alert / VIP Replay"
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Button Call-to-Action</label>
                            <input 
                              type="text" 
                              value={comp.otnButtonText || ''} 
                              onChange={(e) => handleUpdateComponent(comp.id, { otnButtonText: e.target.value })}
                              placeholder="Notify Me"
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                            />
                          </div>
                        </div>
                      )}

                      {/* WHATSAPP TEMPLATE EDITOR */}
                      {comp.type === 'whatsapp_template' && (
                        <div className="space-y-3 pt-1">
                          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] leading-relaxed">
                            💬 <strong>WhatsApp Business Cloud API:</strong> Pre-approved Meta template messages are required to initiate outbound conversations past the WhatsApp 24-hour session window.
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Meta Template Name</label>
                              <input data-no-emoji 
                                type="text" 
                                value={comp.waTemplateName || ''} 
                                onChange={(e) => handleUpdateComponent(comp.id, { waTemplateName: e.target.value })}
                                placeholder="order_status_update_v1"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-500 font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Template Category</label>
                              <select
                                value={comp.waCategory || 'UTILITY'}
                                onChange={(e) => handleUpdateComponent(comp.id, { waCategory: e.target.value as 'UTILITY' | 'MARKETING' | 'AUTHENTICATION' })}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
                              >
                                <option value="UTILITY">Utility (Account / Order Updates)</option>
                                <option value="MARKETING">Marketing (Offers & Re-engagement)</option>
                                <option value="AUTHENTICATION">Authentication (OTPs & Codes)</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Template Header (Optional)</label>
                            <input 
                              type="text" 
                              value={comp.waHeader || ''} 
                              onChange={(e) => handleUpdateComponent(comp.id, { waHeader: e.target.value })}
                              placeholder="Order Status #{{1}}"
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Template Body (Approved Copy)</label>
                            <div className="relative">
                              <textarea 
                                rows={3}
                                ref={compEmoji.setRef(`${comp.id}:waBody`)}
                                value={comp.waBody || ''} 
                                onChange={(e) => handleUpdateComponent(comp.id, { waBody: e.target.value })}
                                placeholder="Hi {{1}}, your order has been dispatched. Track here: {{2}}"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 pr-9 text-xs text-white outline-none focus:border-emerald-500 resize-none font-sans"
                              />
                              <span className="absolute right-1.5 bottom-1.5">
                                <EmojiPickerButton onPick={(e) => compEmoji.insert(`${comp.id}:waBody`, e, comp.waBody || '', (v) => handleUpdateComponent(comp.id, { waBody: v }))} placement="up" />
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-slate-900/40 border border-dashed border-white/10 rounded-2xl text-center space-y-1">
                <p className="text-xs text-slate-400 font-medium">No additional components in this step yet.</p>
                <p className="text-[11px] text-slate-500">Use the toolbar pinned below to attach text bubbles, images, rich cards, galleries, or typing delays.</p>
              </div>
            )}
          </div>
        )}

        {/* Buttons List & Management */}
        {node.type === 'message' && (
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Interactive Buttons</label>
            <div className="space-y-2 mb-3">
              {(node.buttons || []).map((btn, idx) => (
                <div key={idx} className="flex items-center justify-between bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-white">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-blue-400" />
                    <span>{btn}</span>
                  </div>
                  <button 
                    onClick={() => handleRemoveButton(idx)}
                    className="text-slate-400 hover:text-red-400 p-1 transition-colors"
                    title="Remove button"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add new button input */}
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  placeholder="Button label..." 
                  ref={btnEmoji.ref}
                  value={newBtnText} 
                  onChange={(e) => setNewBtnText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddButton()}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl pl-3 pr-9 py-2 text-xs text-white outline-none focus:border-blue-500 transition-colors"
                />
                <span className="absolute right-1 top-1/2 -translate-y-1/2">
                  <EmojiPickerButton onPick={(e) => btnEmoji.insert(e, newBtnText, setNewBtnText)} placement="up" />
                </span>
              </div>
              <button 
                onClick={handleAddButton}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>
        )}

        {/* Actions configuration */}
        {node.type === 'action' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase text-slate-400">Actions to Execute</label>
              <span className="text-[10px] text-amber-400 font-mono">{(node.actionTags || []).length} active</span>
            </div>

            <div className="space-y-2 mb-3">
              {(node.actionTags || []).map((act, idx) => (
                <div key={idx} className="flex items-center justify-between bg-slate-900 border border-amber-500/20 rounded-xl px-3 py-2 text-xs font-mono text-amber-300">
                  <div className="flex items-center gap-2 truncate">
                    <Tag className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span className="truncate">{act}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(idx)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors ml-2 flex-shrink-0 cursor-pointer"
                    title="Remove action"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {(!node.actionTags || node.actionTags.length === 0) && (
                <div className="p-3 rounded-xl bg-slate-900/50 border border-dashed border-white/10 text-center text-xs text-slate-500">
                  No actions defined yet. Choose a preset or add a custom action.
                </div>
              )}
            </div>

            <div className="flex gap-2 mb-3">
              <input 
                type="text" 
                placeholder="e.g. AddTag: Webinar Registered" 
                value={newTagText} 
                onChange={(e) => setNewTagText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500 transition-colors"
              />
              <button 
                onClick={handleAddTag}
                className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            {/* SMS action: sent via the workspace's Twilio number; requires opt-in */}
            <div className="pt-3 border-t border-white/10 space-y-2.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <MessageSquareText className="w-3 h-3 text-amber-400" />
                <span>Send SMS</span>
                <span className="ml-auto"><EmojiPickerButton onPick={(e) => smsEmoji.insert(e, node.smsMessage || '', (v) => onAutoUpdate({ smsMessage: v }))} placement="up" /></span>
              </label>
              <textarea
                ref={smsEmoji.ref}
                value={node.smsMessage || ''}
                onChange={(e) => onAutoUpdate({ smsMessage: e.target.value })}
                rows={3}
                maxLength={1600}
                placeholder="Text message to send (leave empty for no SMS)..."
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-amber-500 transition-colors resize-none"
              />
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!node.smsCollectOptIn}
                  onChange={(e) => onAutoUpdate({ smsCollectOptIn: e.target.checked })}
                  className="accent-amber-500"
                />
                Collect SMS opt-in at this step (asks for phone number + consent)
              </label>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Sends only to contacts who opted in. STOP/START/HELP are handled automatically.
              </p>
            </div>

            {/* Active Integrations Cascading Configuration: Connection -> List -> Tags */}
            <div className="pt-3 border-t border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>Integration Actions</span>
                </label>
                {activeIntegrations.length > 0 ? (
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-medium">
                    {activeIntegrations.length} active
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-full font-medium">
                    0 active
                  </span>
                )}
              </div>

              {activeIntegrations.length > 0 ? (
                <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-3 space-y-3">
                  {/* 1. Pick Connection */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        1. Pick Connection
                      </label>
                      {selectedApp && (
                        <span className="text-[9px] text-emerald-400 font-mono flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" /> Connected
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <select
                        value={selectedConnectionId}
                        onChange={(e) => {
                          setSelectedConnectionId(e.target.value);
                          setSelectedListId('');
                          setSelectedTag('');
                          setCustomTagInput('');
                        }}
                        className="w-full appearance-none bg-slate-950 border border-white/10 rounded-xl px-3 py-2 pr-8 text-xs text-slate-200 outline-none focus:border-amber-500 transition-colors cursor-pointer font-medium"
                      >
                        <option value="" className="text-slate-500">
                          Choose active connection...
                        </option>
                        {activeIntegrations.map((app) => (
                          <option key={app.id} value={app.id}>
                            {app.name} ({app.authType})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* 2. Pick List / Audience / Resource */}
                  {selectedConnectionId && connectionData && (
                    <div className="space-y-1 pt-2 border-t border-white/5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          2. {connectionData.listLabel || 'Select List'}
                        </label>
                        <span className="text-[9px] text-amber-400 font-mono">Required</span>
                      </div>
                      <div className="relative">
                        <select
                          value={selectedListId}
                          onChange={(e) => setSelectedListId(e.target.value)}
                          className="w-full appearance-none bg-slate-950 border border-white/10 rounded-xl px-3 py-2 pr-8 text-xs text-slate-200 outline-none focus:border-amber-500 transition-colors cursor-pointer font-medium"
                        >
                          <option value="" className="text-slate-500">
                            Choose list or endpoint...
                          </option>
                          {connectionData.lists.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  )}

                  {/* 3. Pick Tags (If offered) */}
                  {selectedConnectionId && selectedListId && connectionData && (
                    <div className="space-y-1.5 pt-2 border-t border-white/5">
                      {connectionData.supportsTags ? (
                        <>
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              3. Tags (If offered)
                            </label>
                            <span className="text-[9px] text-slate-400 font-mono">Optional</span>
                          </div>
                          <div className="relative">
                            <select
                              value={selectedTag}
                              onChange={(e) => setSelectedTag(e.target.value)}
                              className="w-full appearance-none bg-slate-950 border border-white/10 rounded-xl px-3 py-2 pr-8 text-xs text-slate-200 outline-none focus:border-amber-500 transition-colors cursor-pointer font-medium"
                            >
                              <option value="">No tag (subscribe to list only)</option>
                              {connectionData.availableTags && connectionData.availableTags.length > 0 && (
                                <optgroup label="Available Tags" className="bg-slate-900 text-amber-300 font-semibold">
                                  {connectionData.availableTags.map((tag) => (
                                    <option key={tag} value={tag} className="bg-slate-950 text-slate-200 py-1">
                                      Tag: {tag}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              <option value="__custom__" className="text-amber-400 font-medium">
                                + Custom Tag...
                              </option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>

                          {selectedTag === '__custom__' && (
                            <input
                              type="text"
                              placeholder="Type custom tag name (e.g. VIP-Lead-2026)"
                              value={customTagInput}
                              onChange={(e) => setCustomTagInput(e.target.value)}
                              className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500 transition-colors font-mono mt-1"
                            />
                          )}
                        </>
                      ) : (
                        <div className="p-2 bg-white/5 rounded-xl text-[11px] text-slate-400 flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span>{selectedApp?.name} executes directly on the chosen endpoint (no tags needed).</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Preview & Add Button */}
                  {composedActionText ? (
                    <div className="pt-2 border-t border-amber-500/20">
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2">
                        <div className="truncate text-xs font-mono text-amber-300 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          <span className="truncate">{composedActionText}</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddComposedAction}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 flex-shrink-0 shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                      </div>
                    </div>
                  ) : selectedConnectionId ? (
                    <div className="text-[10px] text-slate-400 italic text-center py-0.5">
                      {!selectedListId ? 'Select a list or event above to configure this action' : ''}
                    </div>
                  ) : null}

                  {onNavigateToIntegrations && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={onNavigateToIntegrations}
                        className="text-[10px] text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        Manage active connections ({activeIntegrations.length}) <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 space-y-2 text-center">
                  <p className="text-xs text-slate-400">
                    No active integrations connected yet. Connect your accounts in Integrations to enable automated actions.
                  </p>
                  {onNavigateToIntegrations && (
                    <button
                      type="button"
                      onClick={onNavigateToIntegrations}
                      className="px-3 py-1.5 bg-white/5 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>Connect Integrations</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Piping & Connected Steps */}
        <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase text-slate-300 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Next Steps & Piping</span>
            </label>
            <button
              type="button"
              onClick={(e) => onStartConnect(e, 'output')}
              className="text-[11px] font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-lg border border-blue-500/30 flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" /> Pull Out Pipe
            </button>
          </div>

          {/* Outbound pipes */}
          {outboundConnections.length === 0 ? (
            <div className="text-xs text-slate-500 italic bg-slate-950/40 p-2.5 rounded-xl border border-white/5 text-center">
              No outgoing pipes yet. Drag from pins on the canvas or click "Pull Out Pipe" above!
            </div>
          ) : (
            <div className="space-y-1.5">
              {outboundConnections.map((conn) => {
                const targetNode = nodes.find(n => n.id === conn.targetNodeId);
                const handleName = conn.sourceHandleId?.startsWith('btn-')
                  ? `Button (${node.buttons?.[parseInt(conn.sourceHandleId.replace('btn-', ''), 10)] || 'Btn'})`
                  : 'Main Output';
                return (
                  <div key={conn.id} className="flex items-center justify-between bg-slate-950/60 border border-white/5 rounded-xl px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: conn.color || '#3b82f6' }} />
                      <span className="text-slate-400 truncate text-[11px]">{handleName} →</span>
                      <span className="text-white font-semibold truncate">{targetNode?.title || 'Next Step'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteConnection(conn.id)}
                      className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors ml-1 flex-shrink-0"
                      title="Disconnect pipe"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Inbound pipes */}
          {inboundConnections.length > 0 && (
            <div className="pt-2 border-t border-white/5 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Triggered From:</span>
              <div className="space-y-1">
                {inboundConnections.map((conn) => {
                  const sourceNode = nodes.find(n => n.id === conn.sourceNodeId);
                  return (
                    <div key={conn.id} className="flex items-center justify-between bg-slate-950/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-[11px]">
                      <span className="text-slate-400 truncate">From: <strong className="text-slate-300">{sourceNode?.title || 'Previous Step'}</strong></span>
                      <button
                        type="button"
                        onClick={() => onDeleteConnection(conn.id)}
                        className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors"
                        title="Disconnect incoming pipe"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Delete node option (if not trigger) */}
        {node.type !== 'trigger' && (
          <div className="pt-2">
            <button 
              onClick={onDelete}
              className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" /> Delete This Step
            </button>
          </div>
        )}
      </div>

      {/* Sticky "Add Component to Step" toolbar pinned to bottom of drawer - saving all space for elements */}
      {node.type === 'message' && (
        <div className="pt-3 pb-2 border-t border-white/10 bg-slate-950/95 -mx-3.5 sm:-mx-5 px-3.5 sm:px-5 z-10 flex-shrink-0">
          <div className="flex justify-between items-center mb-1.5 sm:mb-2">
            <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              <span>Add Component to Step</span>
            </label>
            <span className="text-[10px] sm:text-[11px] font-mono text-slate-400">
              {(node.components || []).length} added
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1 sm:gap-1.5 mb-1.5">
            <button 
              type="button"
              onClick={() => handleAddComponent('text')}
              className="flex flex-col items-center justify-center p-1.5 sm:p-2 bg-slate-900 border border-white/10 hover:border-blue-500/50 hover:bg-slate-800/80 rounded-xl transition-all group cursor-pointer active:scale-95 shadow-sm"
              title="Add extra text bubble"
            >
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 group-hover:scale-110 transition-transform mb-0.5" />
              <span className="text-[9px] sm:text-[10px] font-medium text-slate-300">Text</span>
            </button>
            <button 
              type="button"
              onClick={() => handleAddComponent('image')}
              className="flex flex-col items-center justify-center p-1.5 sm:p-2 bg-slate-900 border border-white/10 hover:border-emerald-500/50 hover:bg-slate-800/80 rounded-xl transition-all group cursor-pointer active:scale-95 shadow-sm"
              title="Add image attachment"
            >
              <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 group-hover:scale-110 transition-transform mb-0.5" />
              <span className="text-[9px] sm:text-[10px] font-medium text-slate-300">Image</span>
            </button>
            <button 
              type="button"
              onClick={() => handleAddComponent('card')}
              className="flex flex-col items-center justify-center p-1.5 sm:p-2 bg-slate-900 border border-white/10 hover:border-purple-500/50 hover:bg-slate-800/80 rounded-xl transition-all group cursor-pointer active:scale-95 shadow-sm"
              title="Add rich card block"
            >
              <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400 group-hover:scale-110 transition-transform mb-0.5" />
              <span className="text-[9px] sm:text-[10px] font-medium text-slate-300">Card</span>
            </button>
            <button 
              type="button"
              onClick={() => handleAddComponent('gallery')}
              className="flex flex-col items-center justify-center p-1.5 sm:p-2 bg-slate-900 border border-white/10 hover:border-amber-500/50 hover:bg-slate-800/80 rounded-xl transition-all group cursor-pointer active:scale-95 shadow-sm"
              title="Add carousel gallery"
            >
              <FolderPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 group-hover:scale-110 transition-transform mb-0.5" />
              <span className="text-[9px] sm:text-[10px] font-medium text-slate-300">Gallery</span>
            </button>
            <button 
              type="button"
              onClick={() => handleAddComponent('typing')}
              className="flex flex-col items-center justify-center p-1.5 sm:p-2 bg-slate-900 border border-cyan-500/40 hover:border-cyan-400 hover:bg-cyan-500/15 rounded-xl transition-all group cursor-pointer shadow-sm shadow-cyan-500/10 active:scale-95"
              title="Mimics typing for the end user"
            >
              <MoreHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 group-hover:scale-110 transition-transform mb-0.5" />
              <span className="text-[9px] sm:text-[10px] font-bold text-cyan-300">Typing</span>
            </button>
          </div>

          {/* Meta Post-24h Compliance Opt-in Components */}
          <div className="pt-1.5 border-t border-white/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Meta Post-24h Compliance</span>
              <span className="text-[9px] font-mono text-cyan-400 font-semibold">Permission Tokens</span>
            </div>
            <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
              <button 
                type="button"
                onClick={() => handleAddComponent('recurring_notification_optin')}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-cyan-950/40 border border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/20 rounded-lg text-[10px] font-bold text-cyan-300 transition-all cursor-pointer"
                title="Add Meta Recurring Notification Opt-In Card"
              >
                <BellRing className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                <span className="truncate">RN Opt-In</span>
              </button>
              <button 
                type="button"
                onClick={() => handleAddComponent('one_time_notification_optin')}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-purple-950/40 border border-purple-500/30 hover:border-purple-400 hover:bg-purple-500/20 rounded-lg text-[10px] font-bold text-purple-300 transition-all cursor-pointer"
                title="Add Meta One-Time Notification (OTN) Card"
              >
                <Zap className="w-3 h-3 text-purple-400 flex-shrink-0" />
                <span className="truncate">OTN Token</span>
              </button>
              <button 
                type="button"
                onClick={() => handleAddComponent('whatsapp_template')}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-emerald-950/40 border border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-500/20 rounded-lg text-[10px] font-bold text-emerald-300 transition-all cursor-pointer"
                title="Add WhatsApp Template Message"
              >
                <MessageCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                <span className="truncate">WA Template</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type SimulatorItem = 
  | { id: string; sender: 'user'; text: string }
  | { id: string; sender: 'bot'; type: 'text'; text: string }
  | { id: string; sender: 'bot'; type: 'image'; imageUrl: string; caption?: string }
  | { id: string; sender: 'bot'; type: 'card'; title: string; subtitle?: string; imageUrl?: string; buttonLabel?: string; buttonUrl?: string }
  | { id: string; sender: 'bot'; type: 'gallery'; cards: CardItem[] }
  | { id: string; sender: 'bot'; type: 'rn_optin'; topic: string; frequency: string; title: string; buttonText: string; tokenGranted?: boolean }
  | { id: string; sender: 'bot'; type: 'otn_optin'; topic: string; buttonText: string; tokenGranted?: boolean }
  | { id: string; sender: 'bot'; type: 'wa_template'; templateName: string; category: string; header?: string; body: string };

function PhoneSimulator({ 
  nodes, 
  connections = [], 
  onClose 
}: { 
  nodes: FlowNode[]; 
  connections?: FlowConnection[]; 
  onClose: () => void;
}) {
  const [currentNodeId, setCurrentNodeId] = useState<string>('step-1');
  const [chatItems, setChatItems] = useState<SimulatorItem[]>([]);
  const [activeButtons, setActiveButtons] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [typingDuration, setTypingDuration] = useState<number>(3);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(3);
  const [appliedTag, setAppliedTag] = useState<string | null>(null);
  const [typingMode, setTypingMode] = useState<'realistic' | 'instant'>('realistic');

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const galleryScrollRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const stepQueueRef = useRef<Array<() => void>>([]);

  // Replace personalization variables
  const replaceVars = (text: string) => {
    return text
      .replace(/{{first_name}}/g, 'Alex')
      .replace(/{{email}}/g, 'alex.webinar@gmail.com')
      .replace(/{{phone}}/g, '+1 (555) 019-2834');
  };

  // Scroll to bottom on updates
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [chatItems, isTyping, activeButtons]);

  // Handle countdown for typing
  useEffect(() => {
    if (!isTyping) return;

    if (secondsRemaining <= 0) {
      setIsTyping(false);
      // Run next item in queue
      if (stepQueueRef.current.length > 0) {
        const nextAction = stepQueueRef.current.shift();
        nextAction?.();
      }
      return;
    }

    const interval = setInterval(() => {
      setSecondsRemaining(prev => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isTyping, secondsRemaining]);

  // Start / Play a Node
  const playNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setCurrentNodeId(nodeId);

    // If it's an action node, execute CRM action and immediately jump to connected target
    if (node.type === 'action') {
      const tagText = (node.actionTags && node.actionTags.length > 0) 
        ? node.actionTags.join(', ') 
        : node.title;
      setAppliedTag(tagText);

      // Auto-sync contact action to Firestore
      try {
        const now = new Date();
        saveContact({
          id: 'sim_contact_alex_vance',
          name: 'Alex Vance',
          firstName: 'Alex',
          lastName: 'Vance',
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
          channel: 'messenger',
          email: 'alex.webinar@gmail.com',
          phone: '+1 (555) 019-2834',
          company: 'Vance Robotics & Automation',
          jobTitle: 'Director of Growth',
          city: 'Seattle',
          state: 'WA',
          country: 'United States',
          status: 'lead',
          optInStatus: 'opted_in',
          smsConsent: true,
          emailConsent: true,
          messagingWindowExpiresAt: new Date(now.getTime() + 24 * 3600 * 1000).toISOString(),
          tags: node.actionTags && node.actionTags.length > 0 ? node.actionTags : [tagText],
          variables: {
            simulated_flow: 'Build-A-Bot Live Workshop',
            last_action_node: node.title,
            registered_session: 'Thursday 2PM EST',
            lead_score: 95,
          },
          customFields: {
            simulated_flow: 'Build-A-Bot Live Workshop',
            last_action_node: node.title,
            registered_session: 'Thursday 2PM EST',
            lead_score: 95,
          },
          meta: {
            psid: '9182749182390182',
            locale: 'en_US',
            timezone: -5,
            adId: '120208940192019',
            adTitle: '(Ad) Build-A-Bot VIP Workshop Invite',
            adSource: 'ADS',
            referralRef: 'bab_vip_ad_v2',
          },
          notes: `Updated in real time during flow simulator execution. Applied actions: ${tagText}`,
          createdAt: now.toISOString(),
          lastInteractionAt: now.toISOString(),
        }).catch(err => console.warn('Could not sync simulated contact to Firestore:', err));
      } catch (e) {}

      // Find outbound connection from this action node
      const nextConn = connections.find(c => c.sourceNodeId === node.id);
      if (nextConn) {
        setTimeout(() => {
          playNode(nextConn.targetNodeId);
        }, 600);
      }
      return;
    }

    // Build the sequential steps for this message node:
    // 1. Primary content (if any)
    // 2. Each component in node.components
    // 3. Final interactive buttons
    const queue: Array<() => void> = [];

    // Primary content block
    if (node.content && node.content.trim()) {
      queue.push(() => {
        setChatItems(prev => [
          ...prev, 
          { 
            id: `msg-${Date.now()}-${Math.random()}`, 
            sender: 'bot', 
            type: 'text', 
            text: replaceVars(node.content!) 
          }
        ]);
        // Trigger next queue item if available
        if (stepQueueRef.current.length > 0) {
          const next = stepQueueRef.current.shift();
          next?.();
        }
      });
    }

    // Components in order (typing, text, image, card, gallery)
    if (node.components && node.components.length > 0) {
      node.components.forEach((comp) => {
        if (comp.type === 'typing') {
          // Push a typing pause step
          queue.push(() => {
            const delay = typingMode === 'instant' ? 0.3 : (comp.delaySeconds || 3);
            setTypingDuration(Math.ceil(delay));
            setSecondsRemaining(Math.ceil(delay));
            setIsTyping(true);
          });
        } else if (comp.type === 'text' && comp.text) {
          queue.push(() => {
            setChatItems(prev => [
              ...prev,
              {
                id: `comp-${comp.id}`,
                sender: 'bot',
                type: 'text',
                text: replaceVars(comp.text!)
              }
            ]);
            if (stepQueueRef.current.length > 0) {
              const next = stepQueueRef.current.shift();
              next?.();
            }
          });
        } else if (comp.type === 'image' && comp.imageUrl) {
          queue.push(() => {
            setChatItems(prev => [
              ...prev,
              {
                id: `comp-${comp.id}`,
                sender: 'bot',
                type: 'image',
                imageUrl: comp.imageUrl!,
                caption: comp.imageCaption ? replaceVars(comp.imageCaption) : undefined
              }
            ]);
            if (stepQueueRef.current.length > 0) {
              const next = stepQueueRef.current.shift();
              next?.();
            }
          });
        } else if (comp.type === 'card') {
          queue.push(() => {
            setChatItems(prev => [
              ...prev,
              {
                id: `comp-${comp.id}`,
                sender: 'bot',
                type: 'card',
                title: replaceVars(comp.cardTitle || 'Special Offer'),
                subtitle: comp.cardSubtitle ? replaceVars(comp.cardSubtitle) : undefined,
                imageUrl: comp.cardImageUrl,
                buttonLabel: comp.cardButtonLabel || 'View Details',
                buttonUrl: comp.cardButtonUrl
              }
            ]);
            if (stepQueueRef.current.length > 0) {
              const next = stepQueueRef.current.shift();
              next?.();
            }
          });
        } else if (comp.type === 'gallery' && comp.galleryCards && comp.galleryCards.length > 0) {
          queue.push(() => {
            setChatItems(prev => [
              ...prev,
              {
                id: `comp-${comp.id}`,
                sender: 'bot',
                type: 'gallery',
                cards: comp.galleryCards!
              }
            ]);
            if (stepQueueRef.current.length > 0) {
              const next = stepQueueRef.current.shift();
              next?.();
            }
          });
        } else if (comp.type === 'recurring_notification_optin') {
          queue.push(() => {
            setChatItems(prev => [
              ...prev,
              {
                id: `comp-${comp.id}`,
                sender: 'bot',
                type: 'rn_optin',
                topic: comp.rnTopic || 'VIP Weekly Drops',
                frequency: comp.rnFrequency || 'weekly',
                title: replaceVars(comp.rnTitle || 'Get VIP Weekly Drops & Flash Sale Alerts'),
                buttonText: comp.rnButtonText || 'Get Updates',
              }
            ]);
            if (stepQueueRef.current.length > 0) {
              const next = stepQueueRef.current.shift();
              next?.();
            }
          });
        } else if (comp.type === 'one_time_notification_optin') {
          queue.push(() => {
            setChatItems(prev => [
              ...prev,
              {
                id: `comp-${comp.id}`,
                sender: 'bot',
                type: 'otn_optin',
                topic: comp.otnTopic || 'Back in Stock Alert',
                buttonText: comp.otnButtonText || 'Notify Me',
              }
            ]);
            if (stepQueueRef.current.length > 0) {
              const next = stepQueueRef.current.shift();
              next?.();
            }
          });
        } else if (comp.type === 'whatsapp_template') {
          queue.push(() => {
            setChatItems(prev => [
              ...prev,
              {
                id: `comp-${comp.id}`,
                sender: 'bot',
                type: 'wa_template',
                templateName: comp.waTemplateName || 'order_update',
                category: comp.waCategory || 'UTILITY',
                header: comp.waHeader ? replaceVars(comp.waHeader) : undefined,
                body: replaceVars(comp.waBody || 'Template notification'),
              }
            ]);
            if (stepQueueRef.current.length > 0) {
              const next = stepQueueRef.current.shift();
              next?.();
            }
          });
        }
      });
    }

    // Final interactive buttons
    queue.push(() => {
      if (node.buttons && node.buttons.length > 0) {
        setActiveButtons(node.buttons);
      } else {
        setActiveButtons([]);
      }
    });

    stepQueueRef.current = queue;

    // Start executing the queue
    if (stepQueueRef.current.length > 0) {
      const first = stepQueueRef.current.shift();
      first?.();
    }
  };

  // Initial load
  useEffect(() => {
    // Find starting trigger node or step-1
    const startNode = nodes.find(n => n.type === 'trigger') || nodes.find(n => n.id === 'step-1') || nodes[0];
    if (startNode) {
      // If trigger node, follow connection to first message
      if (startNode.type === 'trigger') {
        const conn = connections.find(c => c.sourceNodeId === startNode.id);
        if (conn) {
          playNode(conn.targetNodeId);
          return;
        }
      }
      playNode(startNode.id);
    }
  }, []);

  const handleButtonClick = (btnLabel: string, btnIndex: number) => {
    // 1. Append user's choice to chat
    setChatItems(prev => [
      ...prev,
      { id: `user-${Date.now()}`, sender: 'user', text: btnLabel }
    ]);
    setActiveButtons([]);

    // Persist user button response as a dynamic variable to Firestore contact
    try {
      setContactVariable('sim_contact_alex_vance', 'last_user_choice', btnLabel).catch(() => {});
    } catch (e) {}

    // 2. Find which node to transition to:
    // First check button specific connection (sourceHandleId: `btn-${btnIndex}`)
    let targetConn = connections.find(
      c => c.sourceNodeId === currentNodeId && c.sourceHandleId === `btn-${btnIndex}`
    );

    // If none, check main output handle
    if (!targetConn) {
      targetConn = connections.find(
        c => c.sourceNodeId === currentNodeId && (!c.sourceHandleId || c.sourceHandleId === 'output')
      );
    }

    if (targetConn) {
      // Small delay then play target node
      setTimeout(() => {
        playNode(targetConn!.targetNodeId);
      }, 400);
    } else {
      // Fallback: follow sequential steps in array
      const currentIndex = nodes.findIndex(n => n.id === currentNodeId);
      const nextNode = nodes.slice(currentIndex + 1).find(n => n.type !== 'trigger');
      if (nextNode) {
        setTimeout(() => {
          playNode(nextNode.id);
        }, 400);
      } else {
        // Conclude simulation
        setTimeout(() => {
          setChatItems(prev => [
            ...prev,
            {
              id: `bot-done-${Date.now()}`,
              sender: 'bot',
              type: 'text',
              text: '🎉 Conversation sequence complete! All steps, components & actions simulated successfully.'
            }
          ]);
        }, 500);
      }
    }
  };

  const handleSkipTyping = () => {
    setIsTyping(false);
    setSecondsRemaining(0);
    if (stepQueueRef.current.length > 0) {
      const next = stepQueueRef.current.shift();
      next?.();
    }
  };

  const handleReset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    stepQueueRef.current = [];
    setIsTyping(false);
    setChatItems([]);
    setActiveButtons([]);
    setAppliedTag(null);

    const startNode = nodes.find(n => n.type === 'trigger') || nodes.find(n => n.id === 'step-1') || nodes[0];
    if (startNode) {
      if (startNode.type === 'trigger') {
        const conn = connections.find(c => c.sourceNodeId === startNode.id);
        if (conn) {
          playNode(conn.targetNodeId);
          return;
        }
      }
      playNode(startNode.id);
    }
  };

  const scrollGallery = (galleryId: string, direction: 'left' | 'right') => {
    const el = galleryScrollRefs.current[galleryId];
    if (el) {
      el.scrollBy({ left: direction === 'left' ? -220 : 220, behavior: 'smooth' });
    }
  };

  const currentNode = nodes.find(n => n.id === currentNodeId);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-white/20 rounded-[36px] w-[380px] h-[680px] max-h-[94vh] flex flex-col shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Phone Notch & Header */}
        <div className="bg-slate-950 p-4 border-b border-white/10 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-blue-500/20">
              🤖
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>ChatMize Assistant</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                {isTyping ? (
                  <span className="text-cyan-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                    typing ({secondsRemaining}s)...
                  </span>
                ) : (
                  <span className="text-emerald-400">Active Bot • {currentNode?.title || 'Flow'}</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {/* Speed toggle */}
            <button
              type="button"
              onClick={() => setTypingMode(prev => prev === 'realistic' ? 'instant' : 'realistic')}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                typingMode === 'realistic' 
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300' 
                  : 'bg-white/5 border-white/10 text-slate-400'
              }`}
              title={`Typing speed: ${typingMode}. Click to toggle.`}
            >
              {typingMode === 'realistic' ? '⏳ Delay: On' : '⚡ Instant'}
            </button>

            <button 
              onClick={handleReset}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Restart from beginning"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Close phone simulator"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Applied CRM Tag Notification Banner */}
        {appliedTag && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-3 py-1.5 text-[10px] font-mono text-amber-300 flex items-center gap-1.5 animate-in slide-in-from-top duration-150">
            <Tag className="w-3 h-3 text-amber-400 flex-shrink-0" />
            <span className="truncate">CRM Action: {appliedTag}</span>
          </div>
        )}

        {/* Chat Messages Body */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {chatItems.map((item) => {
            if (item.sender === 'user') {
              return (
                <div key={item.id} className="flex flex-col items-end">
                  <div className="p-3 bg-blue-600 text-white rounded-2xl rounded-br-none max-w-[85%] text-xs leading-relaxed shadow-sm">
                    {item.text}
                  </div>
                </div>
              );
            }

            // Bot text bubble
            if (item.type === 'text') {
              return (
                <div key={item.id} className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="p-3.5 bg-slate-800/95 text-slate-100 border border-white/10 rounded-2xl rounded-bl-none max-w-[88%] text-xs leading-relaxed whitespace-pre-wrap shadow-md">
                    {item.text}
                  </div>
                </div>
              );
            }

            // Bot image attachment
            if (item.type === 'image') {
              return (
                <div key={item.id} className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-[88%]">
                  <div className="bg-slate-800/95 border border-white/10 rounded-2xl rounded-bl-none overflow-hidden shadow-md">
                    <img 
                      src={item.imageUrl} 
                      alt={item.caption || 'Attached image'} 
                      className="w-full max-h-48 object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {item.caption && (
                      <div className="p-2.5 text-[11px] text-slate-300 font-medium border-t border-white/5">
                        {item.caption}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // Bot card block
            if (item.type === 'card') {
              return (
                <div key={item.id} className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-200 w-full max-w-[90%]">
                  <div className="bg-slate-800/95 border border-purple-500/30 rounded-2xl rounded-bl-none overflow-hidden shadow-lg w-full">
                    {item.imageUrl && (
                      <div className="h-32 w-full bg-slate-900 overflow-hidden relative">
                        <img 
                          src={item.imageUrl} 
                          alt={item.title} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    <div className="p-3 space-y-1.5">
                      <h4 className="text-xs font-bold text-white">{item.title}</h4>
                      {item.subtitle && (
                        <p className="text-[11px] text-slate-300 leading-relaxed">{item.subtitle}</p>
                      )}
                      {item.buttonLabel && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (item.buttonUrl) {
                                window.open(item.buttonUrl, '_blank');
                              }
                            }}
                            className="w-full py-2 px-3 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 text-purple-200 rounded-xl text-xs font-bold text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-98"
                          >
                            <span>{item.buttonLabel}</span>
                            {item.buttonUrl && <ExternalLink className="w-3 h-3" />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // Bot carousel gallery
            if (item.type === 'gallery') {
              return (
                <div key={item.id} className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-200 w-full">
                  <div className="flex items-center justify-between w-full pr-2 mb-1 text-[10px] text-amber-300 font-bold uppercase tracking-wider">
                    <span>Carousel Gallery</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => scrollGallery(item.id, 'left')}
                        className="p-1 rounded-md bg-slate-800 text-slate-300 hover:text-white border border-white/10"
                        title="Scroll left"
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollGallery(item.id, 'right')}
                        className="p-1 rounded-md bg-slate-800 text-slate-300 hover:text-white border border-white/10"
                        title="Scroll right"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div 
                    ref={el => { galleryScrollRefs.current[item.id] = el; }}
                    className="flex gap-2.5 overflow-x-auto w-full pb-2 pt-1 snap-x scrollbar-none pr-4"
                  >
                    {item.cards.map((card, cIdx) => (
                      <div 
                        key={card.id || cIdx}
                        className="min-w-[200px] w-[200px] bg-slate-800/95 border border-amber-500/30 rounded-2xl overflow-hidden shadow-lg flex-shrink-0 snap-start flex flex-col justify-between"
                      >
                        <div>
                          {card.imageUrl && (
                            <div className="h-24 w-full bg-slate-900 overflow-hidden">
                              <img 
                                src={card.imageUrl} 
                                alt={card.title} 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                          <div className="p-2.5">
                            <h5 className="text-[11px] font-bold text-white leading-tight mb-1">{card.title}</h5>
                            <p className="text-[10px] text-slate-300 line-clamp-2 leading-relaxed">{card.subtitle}</p>
                          </div>
                        </div>
                        {card.buttonLabel && (
                          <div className="p-2.5 pt-0">
                            <button
                              type="button"
                              className="w-full py-1.5 px-2 bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/40 text-amber-200 rounded-xl text-[10px] font-bold text-center transition-all cursor-pointer"
                            >
                              {card.buttonLabel}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            // Recurring Notification Opt-In Card (Meta RN)
            if (item.type === 'rn_optin') {
              return (
                <div key={item.id} className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-200 w-full max-w-[90%]">
                  <div className="bg-slate-800/95 border border-cyan-500/40 rounded-2xl rounded-bl-none overflow-hidden shadow-lg w-full p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-cyan-300 font-bold text-xs">
                        <BellRing className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Recurring Notification</span>
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30 uppercase">
                        {item.frequency}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white leading-snug">{item.title}</div>
                    <div className="text-[10px] text-slate-400">
                      Topic: <span className="text-cyan-300 font-semibold">{item.topic}</span>
                    </div>
                    {item.tokenGranted ? (
                      <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Opt-in Confirmed! Meta Token Saved</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const token = `rn_tok_${Date.now()}`;
                          saveRecurringNotificationToken('sim_contact_alex_vance', {
                            topic: item.topic,
                            frequency: item.frequency as any,
                            token: token,
                            optedInAt: new Date().toISOString(),
                            expiresAt: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString(),
                            status: 'active',
                          }).catch(() => {});
                          setChatItems(prev => prev.map(ci => ci.id === item.id ? { ...ci, tokenGranted: true } : ci));
                          setChatItems(prev => [
                            ...prev,
                            {
                              id: `rn-granted-${Date.now()}`,
                              sender: 'bot',
                              type: 'text',
                              text: `🔔 Opt-in confirmed! Granted Meta Recurring Token for "${item.topic}". Your bot can now send weekly updates past the 24-hour window!`
                            }
                          ]);
                        }}
                        className="w-full py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-cyan-900/40 active:scale-98 cursor-pointer"
                      >
                        <BellRing className="w-3.5 h-3.5" />
                        <span>{item.buttonText}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            // One-Time Notification Opt-In Card (Meta OTN)
            if (item.type === 'otn_optin') {
              return (
                <div key={item.id} className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-200 w-full max-w-[90%]">
                  <div className="bg-slate-800/95 border border-purple-500/40 rounded-2xl rounded-bl-none overflow-hidden shadow-lg w-full p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-purple-300 font-bold text-xs">
                        <Zap className="w-3.5 h-3.5 text-purple-400" />
                        <span>One-Time Notification (OTN)</span>
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">
                        1 Token
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white">{item.topic}</div>
                    {item.tokenGranted ? (
                      <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Reminder Set! OTN Token Acquired</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const token = `otn_tok_${Date.now()}`;
                          saveOtnToken('sim_contact_alex_vance', {
                            topic: item.topic,
                            token: token,
                            optedInAt: new Date().toISOString(),
                            status: 'available',
                          }).catch(() => {});
                          setChatItems(prev => prev.map(ci => ci.id === item.id ? { ...ci, tokenGranted: true } : ci));
                          setChatItems(prev => [
                            ...prev,
                            {
                              id: `otn-granted-${Date.now()}`,
                              sender: 'bot',
                              type: 'text',
                              text: `⚡ One-Time Notification token registered for "${item.topic}"! Your bot has permission for 1 follow-up message when the event occurs.`
                            }
                          ]);
                        }}
                        className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-purple-900/40 active:scale-98 cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>{item.buttonText}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            // WhatsApp Official Template Message
            if (item.type === 'wa_template') {
              return (
                <div key={item.id} className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-200 w-full max-w-[90%]">
                  <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-2xl rounded-bl-none overflow-hidden shadow-lg w-full p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs">
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>WhatsApp Official Template</span>
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded uppercase border border-emerald-500/30">
                        {item.category}
                      </span>
                    </div>
                    {item.header && (
                      <div className="text-xs font-bold text-white">{item.header}</div>
                    )}
                    <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {item.body}
                    </div>
                    <div className="pt-1 flex items-center justify-between text-[9px] text-emerald-400/80 font-mono">
                      <span>Meta Template: {item.templateName}</span>
                      <span className="flex items-center gap-1 text-emerald-400 font-sans font-semibold">
                        <Check className="w-2.5 h-2.5" /> Verified
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            return null;
          })}

          {/* Real-time Typing Simulator Bubble (Mimics typing for end user) */}
          {isTyping && (
            <div className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center gap-2">
                {/* 3 bouncing dots */}
                <div className="bg-slate-800 border border-cyan-500/30 px-3.5 py-2.5 rounded-2xl rounded-bl-none shadow-md flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>

                {/* Skip button for rapid previewing */}
                <button
                  type="button"
                  onClick={handleSkipTyping}
                  className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 px-2 py-1 rounded-lg border border-cyan-500/30 transition-colors"
                >
                  Skip ({secondsRemaining}s)
                </button>
              </div>
            </div>
          )}

          {/* Interactive User Buttons (appear when typing is done) */}
          {!isTyping && activeButtons.length > 0 && (
            <div className="space-y-1.5 pt-1 w-full max-w-[88%] animate-in fade-in slide-in-from-bottom-2 duration-200">
              {activeButtons.map((btn, bIdx) => (
                <button
                  key={bIdx}
                  type="button"
                  onClick={() => handleButtonClick(btn, bIdx)}
                  className="w-full py-2.5 px-3.5 bg-blue-500/15 hover:bg-blue-500/30 border border-blue-500/40 hover:border-blue-400 text-blue-200 rounded-xl text-xs font-bold text-center transition-all cursor-pointer shadow-sm active:scale-98 flex items-center justify-between"
                >
                  <span>{btn}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-blue-400" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Phone Footer */}
        <div className="p-3 bg-slate-950 border-t border-white/10 text-center text-[10px] text-slate-500 flex justify-between items-center px-4">
          <span>Simulation Preview</span>
          <span className="text-blue-400 font-medium">Messenger & IG DM</span>
        </div>
      </div>
    </div>
  );
}
