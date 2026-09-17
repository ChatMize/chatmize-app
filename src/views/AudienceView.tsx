import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  Plus, 
  ExternalLink, 
  MessageSquare, 
  Instagram, 
  Smartphone, 
  Globe, 
  Tag, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Database, 
  Sparkles, 
  Zap, 
  X, 
  Trash2, 
  ChevronRight,
  Info,
  RefreshCw,
  Mail,
  Phone,
  Radio,
  Copy,
  Check,
  Building2,
  MapPin,
  Briefcase,
  Hash,
  Code2,
  Sliders,
  UserPlus,
  ShieldAlert,
  Save,
  Edit3,
  FileText,
  UserX,
  AlertTriangle,
  Lock,
  ArrowRight,
  Shield,
  BellRing,
  Send
} from 'lucide-react';
import { 
  subscribeToContacts, 
  saveContact, 
  updateContactField, 
  setContactVariable,
  deleteContactVariable,
  deleteContactRecord, 
  executeCompliantContactErasure,
  optOutContact,
  subscribeToDeletionAuditLogs,
  DeletionAuditRecord,
  seedInitialMetaContacts, 
  testFirebaseConnection,
  ContactRecord 
} from '../lib/firebase';
import { MetaFollowUpModal } from '../components/MetaFollowUpModal';
import { RecurringNotificationBroadcastHub } from '../components/RecurringNotificationBroadcastHub';

interface DynamicVarEntry {
  key: string;
  val: string;
}

export function AudienceView({ workspaceId }: { workspaceId?: string }) {
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [selectedContact, setSelectedContact] = useState<ContactRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<'all' | 'messenger' | 'instagram' | 'whatsapp'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'lead' | 'subscriber' | 'customer' | 'unsubscribed'>('all');
  const [attributeFilter, setAttributeFilter] = useState<'all' | 'has_phone' | 'has_email' | 'has_variables' | 'has_rn_token' | 'rn_expiring_soon'>('all');
  const [showBroadcastHub, setShowBroadcastHub] = useState<boolean>(false);
  
  // Tag manager
  const [newTagInput, setNewTagInput] = useState<string>('');

  // Dynamic variable manager in drawer
  const [newVarKey, setNewVarKey] = useState<string>('');
  const [newVarVal, setNewVarVal] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Edit contact info mode in drawer
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [editFirstName, setEditFirstName] = useState<string>('');
  const [editLastName, setEditLastName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editCompany, setEditCompany] = useState<string>('');
  const [editJobTitle, setEditJobTitle] = useState<string>('');
  const [editCity, setEditCity] = useState<string>('');
  const [editCountry, setEditCountry] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  // Capture Lead / Add Contact modal
  const [showCaptureModal, setShowCaptureModal] = useState<boolean>(false);
  const [simulating, setSimulating] = useState<boolean>(false);

  // Modal form states
  const [modalChannel, setModalChannel] = useState<'messenger' | 'instagram' | 'whatsapp' | 'web'>('messenger');
  const [modalFirstName, setModalFirstName] = useState<string>('Jordan');
  const [modalLastName, setModalLastName] = useState<string>('Miller');
  const [modalPhone, setModalPhone] = useState<string>('+1 (555) 482-9012');
  const [modalEmail, setModalEmail] = useState<string>('jordan.miller@venturegrowth.io');
  const [modalCompany, setModalCompany] = useState<string>('VentureGrowth Labs');
  const [modalJobTitle, setModalJobTitle] = useState<string>('Head of Demand Gen');
  const [modalCity, setModalCity] = useState<string>('San Francisco');
  const [modalCountry, setModalCountry] = useState<string>('United States');
  const [modalAdTitle, setModalAdTitle] = useState<string>('(Meta Ad) Scale Your Chatbot 10x with AI');
  const [modalAdId, setModalAdId] = useState<string>('12021038491823');
  const [modalTag, setModalTag] = useState<string>('VIP High Intent');
  const [modalVars, setModalVars] = useState<DynamicVarEntry[]>([
    { key: 'monthly_ad_spend', val: '$20,000+' },
    { key: 'primary_crm', val: 'HubSpot' },
    { key: 'team_size', val: '10-25' },
  ]);
  const [newModalVarKey, setNewModalVarKey] = useState<string>('');
  const [newModalVarVal, setNewModalVarVal] = useState<string>('');

  // Compliance / Right to be Forgotten (GDPR Art. 17 & Meta Data Deletion)
  const [showErasureModal, setShowErasureModal] = useState<boolean>(false);
  const [contactToErase, setContactToErase] = useState<ContactRecord | null>(null);
  const [erasureMode, setErasureMode] = useState<'hard_purge' | 'opt_out'>('hard_purge');
  const [erasureReason, setErasureReason] = useState<string>('User asked to be forgotten (GDPR Art. 17)');
  const [erasureConfirmationInput, setErasureConfirmationInput] = useState<string>('');
  const [isErasing, setIsErasing] = useState<boolean>(false);
  const [erasureReceipt, setErasureReceipt] = useState<{
    confirmationCode: string;
    purgedAt: string;
    contactName: string;
    contactId: string;
    channel: string;
  } | null>(null);

  // Compliance & Deletion Audit Logs Modal
  const [showAuditLogsModal, setShowAuditLogsModal] = useState<boolean>(false);
  const [deletionLogs, setDeletionLogs] = useState<DeletionAuditRecord[]>([]);
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');

  // Meta 24h+ Compliant Follow-Up Dispatcher Modal
  const [metaFollowUpContact, setMetaFollowUpContact] = useState<ContactRecord | null>(null);

  useEffect(() => {
    let unsubscribeContacts: (() => void) | undefined;
    let unsubscribeAuditLogs: (() => void) | undefined;

    async function init() {
      setLoading(true);
      const connected = await testFirebaseConnection();
      setIsConnected(connected);

      // Seed initial Meta contacts if empty
      await seedInitialMetaContacts();

      // Listen to real-time contacts
      unsubscribeContacts = subscribeToContacts(
        (data) => {
          setContacts(data);
          setLoading(false);

          // If a contact was selected, keep selectedContact in sync
          setSelectedContact(prev => {
            if (!prev) return null;
            const updated = data.find(c => c.id === prev.id);
            return updated || null;
          });
        },
        (err) => {
          console.error("Firestore error:", err);
          setLoading(false);
        }
      );

      // Listen to real-time compliance deletion audit logs
      unsubscribeAuditLogs = subscribeToDeletionAuditLogs(
        (logs) => {
          setDeletionLogs(logs);
        },
        (err) => {
          console.warn("Audit log subscription notice:", err);
        }
      );
    }

    init();

    return () => {
      if (unsubscribeContacts) unsubscribeContacts();
      if (unsubscribeAuditLogs) unsubscribeAuditLogs();
    };
  }, []);

  // When selected contact changes, populate edit fields
  useEffect(() => {
    if (selectedContact) {
      setEditFirstName(selectedContact.firstName || selectedContact.name.split(' ')[0] || '');
      setEditLastName(selectedContact.lastName || selectedContact.name.split(' ').slice(1).join(' ') || '');
      setEditPhone(selectedContact.phone || '');
      setEditEmail(selectedContact.email || '');
      setEditCompany(selectedContact.company || '');
      setEditJobTitle(selectedContact.jobTitle || '');
      setEditCity(selectedContact.city || '');
      setEditCountry(selectedContact.country || '');
      setEditNotes(selectedContact.notes || '');
      setIsEditingProfile(false);
    }
  }, [selectedContact?.id]);

  // Filtered contacts
  const filteredContacts = contacts.filter((c) => {
    if (channelFilter !== 'all' && c.channel !== channelFilter) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    
    if (attributeFilter === 'has_phone' && !c.phone) return false;
    if (attributeFilter === 'has_email' && !c.email) return false;
    if (attributeFilter === 'has_variables' && (!c.variables || Object.keys(c.variables).length === 0)) return false;
    if (attributeFilter === 'has_rn_token' && (!c.recurringTokens || !c.recurringTokens.some(t => t.status === 'active'))) return false;
    if (attributeFilter === 'rn_expiring_soon' && (!c.recurringTokens || !c.recurringTokens.some(t => {
      if (t.status !== 'active' || !t.expiresAt) return false;
      const days = (new Date(t.expiresAt).getTime() - Date.now()) / (1000 * 3600 * 24);
      return days > 0 && days <= 14;
    }))) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchFirst = (c.firstName || '').toLowerCase().includes(q);
      const matchLast = (c.lastName || '').toLowerCase().includes(q);
      const matchEmail = (c.email || '').toLowerCase().includes(q);
      const matchPhone = (c.phone || '').toLowerCase().includes(q);
      const matchCompany = (c.company || '').toLowerCase().includes(q);
      const matchCity = (c.city || '').toLowerCase().includes(q);
      const matchTag = (c.tags || []).some(t => t.toLowerCase().includes(q));
      const matchAd = (c.meta.adTitle || '').toLowerCase().includes(q);
      const matchAdId = (c.meta.adId || '').includes(q);
      const matchPsid = (c.meta.psid || '').includes(q);
      const matchIgsid = (c.meta.igsid || '').includes(q);
      
      const vars = c.variables || c.customFields || {};
      const matchVars = Object.entries(vars).some(
        ([k, v]) => k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q)
      );

      return matchName || matchFirst || matchLast || matchEmail || matchPhone || matchCompany || matchCity || matchTag || matchAd || matchAdId || matchPsid || matchIgsid || matchVars;
    }
    return true;
  });

  // Calculate Meta 24-hour window status
  const isWindowActive = (isoDate?: string) => {
    if (!isoDate) return false;
    return new Date(isoDate).getTime() > Date.now();
  };

  const getChannelBadge = (channel: string) => {
    switch (channel) {
      case 'messenger':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <MessageSquare className="w-3 h-3" /> Messenger
          </span>
        );
      case 'instagram':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-pink-500/15 text-pink-400 border border-pink-500/30">
            <Instagram className="w-3 h-3" /> Instagram DM
          </span>
        );
      case 'whatsapp':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Smartphone className="w-3 h-3" /> WhatsApp
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/15 text-slate-300 border border-slate-500/30">
            <Globe className="w-3 h-3" /> Webchat
          </span>
        );
    }
  };

  // Copy helper
  const copyToClipboard = (text: string, identifier: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(identifier);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Copy variable shortcode: {{var_name}}
  const copyVarShortcode = (key: string) => {
    const clean = key.trim().replace(/^\{\{|\}\}$/g, '');
    const code = `{{${clean}}}`;
    navigator.clipboard.writeText(code);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Save profile changes
  const handleSaveProfile = async () => {
    if (!selectedContact) return;
    setIsSavingProfile(true);
    try {
      const fullName = `${editFirstName} ${editLastName}`.trim() || selectedContact.name;
      const updates: Partial<ContactRecord> = {
        name: fullName,
        firstName: editFirstName,
        lastName: editLastName,
        phone: editPhone,
        email: editEmail,
        company: editCompany,
        jobTitle: editJobTitle,
        city: editCity,
        country: editCountry,
        notes: editNotes,
      };
      await updateContactField(selectedContact.id, updates);
      setIsEditingProfile(false);
    } catch (err) {
      console.error("Failed to update contact profile:", err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Tag manager
  const handleAddTagToContact = async (contactId: string) => {
    if (!newTagInput.trim() || !selectedContact) return;
    const cleanTag = newTagInput.trim();
    const updatedTags = Array.from(new Set([...(selectedContact.tags || []), cleanTag]));
    await updateContactField(contactId, { tags: updatedTags });
    setNewTagInput('');
  };

  const handleRemoveTagFromContact = async (contactId: string, tagToRemove: string) => {
    if (!selectedContact) return;
    const updatedTags = (selectedContact.tags || []).filter(t => t !== tagToRemove);
    await updateContactField(contactId, { tags: updatedTags });
  };

  // Dynamic variable operations
  const handleAddVariable = async () => {
    if (!selectedContact || !newVarKey.trim()) return;
    const cleanKey = newVarKey.trim().replace(/^\{\{|\}\}$/g, '').replace(/\s+/g, '_').toLowerCase();
    await setContactVariable(selectedContact.id, cleanKey, newVarVal.trim());
    setNewVarKey('');
    setNewVarVal('');
  };

  const handleDeleteVariable = async (key: string) => {
    if (!selectedContact) return;
    const vars = selectedContact.variables || selectedContact.customFields || {};
    await deleteContactVariable(selectedContact.id, key, vars);
  };

  // Trigger compliant erasure flow
  const openErasureModal = (contact: ContactRecord) => {
    setContactToErase(contact);
    setErasureConfirmationInput('');
    setErasureMode('hard_purge');
    setErasureReason('User explicitly requested deletion (Right to be Forgotten)');
    setErasureReceipt(null);
    setShowErasureModal(true);
  };

  // Execute compliant erasure
  const handleExecuteErasure = async () => {
    if (!contactToErase) return;
    setIsErasing(true);
    try {
      if (erasureMode === 'hard_purge') {
        // Full hard deletion with compliance receipt
        const result = await executeCompliantContactErasure(
          contactToErase.id,
          contactToErase.channel,
          erasureReason
        );

        setErasureReceipt({
          confirmationCode: result.confirmationCode,
          purgedAt: result.purgedAt,
          contactName: contactToErase.name,
          contactId: contactToErase.id,
          channel: contactToErase.channel,
        });

        if (selectedContact?.id === contactToErase.id) {
          setSelectedContact(null);
        }
      } else {
        // Opt-out / revoke consent only
        await optOutContact(contactToErase.id);
        setShowErasureModal(false);
      }
    } catch (err) {
      console.error("Failed to execute compliant erasure:", err);
      alert("Error processing deletion request. Please check your connection.");
    } finally {
      setIsErasing(false);
    }
  };

  // Download official GDPR / Meta data erasure certificate
  const handleDownloadErasureCertificate = () => {
    if (!erasureReceipt) return;
    const certText = `========================================================================
OFFICIAL DATA ERASURE & COMPLIANCE CONFIRMATION RECEIPT
Under GDPR Article 17 (Right to Erasure), CCPA & Meta Data Deletion Policy
========================================================================

Confirmation Code  : ${erasureReceipt.confirmationCode}
Timestamp of Purge : ${new Date(erasureReceipt.purgedAt).toUTCString()}
Purged Contact ID  : ${erasureReceipt.contactId}
Channel Origin     : ${erasureReceipt.channel.toUpperCase()}
Reason for Erasure : ${erasureReason}
Status             : COMPLETED - 100% DATA PURGED

RECORDS PURGED FROM SYSTEM:
- Full Name and Personal Identifiers
- Verified Mobile Phone Number & SMS Opt-In Consent
- Verified Email Address & Marketing Consent
- Company Name, Job Title & Physical Location
- Platform Graph IDs (Page-Scoped PSID, Instagram IGSID, WhatsApp ID)
- All Custom Dynamic Variables, Question Answers & Lead Scores
- All Communication History, Tags & Notes

CERTIFICATION:
ChatMize certifies that all personally identifiable data (PII) and associated
attributes have been irrevocably deleted from the production Firestore database.
This confirmation code serves as cryptographic proof of compliance for the
data subject, Meta Developer Compliance, and regulatory authorities.
========================================================================`;

    const blob = new Blob([certText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Erasure_Proof_${erasureReceipt.confirmationCode}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Modal: Add temporary dynamic variable row
  const handleAddModalVarRow = () => {
    if (!newModalVarKey.trim()) return;
    const cleanKey = newModalVarKey.trim().replace(/^\{\{|\}\}$/g, '').replace(/\s+/g, '_').toLowerCase();
    setModalVars(prev => [...prev, { key: cleanKey, val: newModalVarVal.trim() }]);
    setNewModalVarKey('');
    setNewModalVarVal('');
  };

  const handleRemoveModalVarRow = (index: number) => {
    setModalVars(prev => prev.filter((_, i) => i !== index));
  };

  // Save new contact from Modal into Firestore
  const handleCreateContact = async () => {
    setSimulating(true);
    try {
      const now = new Date();
      const id = `contact_${modalChannel}_${Date.now().toString().slice(-8)}`;
      const windowExpiry = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
      const fullName = `${modalFirstName} ${modalLastName}`.trim();

      // Build variables dictionary
      const variablesDict: Record<string, string | number | boolean> = {};
      modalVars.forEach(v => {
        if (v.key.trim()) {
          variablesDict[v.key.trim()] = v.val;
        }
      });
      variablesDict['capture_source'] = 'Meta Lead Ad & Form';
      variablesDict['intake_date'] = now.toISOString().slice(0, 10);

      const newRecord: ContactRecord = {
        id,
        name: fullName || 'New Lead',
        firstName: modalFirstName,
        lastName: modalLastName,
        avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
        channel: modalChannel,
        email: modalEmail,
        phone: modalPhone,
        company: modalCompany,
        jobTitle: modalJobTitle,
        city: modalCity,
        country: modalCountry,
        status: 'lead',
        optInStatus: 'opted_in',
        smsConsent: true,
        emailConsent: true,
        messagingWindowExpiresAt: windowExpiry,
        tags: [modalTag, 'Captured Lead', 'Verified Info'].filter(Boolean),
        variables: variablesDict,
        customFields: variablesDict,
        meta: {
          psid: modalChannel === 'messenger' ? `9${Date.now()}` : undefined,
          igsid: modalChannel === 'instagram' ? `1784${Date.now().toString().slice(-8)}` : undefined,
          waId: modalChannel === 'whatsapp' ? modalPhone.replace(/\D/g, '') : undefined,
          locale: 'en_US',
          timezone: -5,
          adId: modalAdId,
          adTitle: modalAdTitle,
          adSource: 'ADS',
          referralRef: 'meta_lead_form_v1',
        },
        notes: `Captured with verified First/Last Name, Mobile Phone, Email, Company, and dynamic custom variables.`,
        createdAt: now.toISOString(),
        lastInteractionAt: now.toISOString(),
      };

      await saveContact(newRecord);
      setShowCaptureModal(false);
      setSelectedContact(newRecord);
    } catch (err) {
      console.error("Failed to capture contact:", err);
    } finally {
      setSimulating(false);
    }
  };

  // CSV Export with ALL captured data including dynamic variables
  const handleExportCSV = () => {
    if (contacts.length === 0) return;
    const headers = [
      'ID', 
      'Full_Name', 
      'First_Name', 
      'Last_Name', 
      'Mobile_Phone', 
      'Email', 
      'Company', 
      'Job_Title', 
      'City', 
      'Country', 
      'Channel', 
      'Status', 
      'SMS_Consent', 
      'Email_Consent', 
      'Meta_PSID/IGSID', 
      'Meta_Ad_ID', 
      'Meta_Ad_Title', 
      'Tags', 
      '24hr_Window_Active', 
      'Captured_Variables_JSON', 
      'Created_At'
    ];

    const rows = contacts.map(c => {
      const vars = c.variables || c.customFields || {};
      return [
        c.id,
        `"${c.name}"`,
        `"${c.firstName || ''}"`,
        `"${c.lastName || ''}"`,
        `"${c.phone || ''}"`,
        `"${c.email || ''}"`,
        `"${c.company || ''}"`,
        `"${c.jobTitle || ''}"`,
        `"${c.city || ''}"`,
        `"${c.country || ''}"`,
        c.channel,
        c.status,
        c.smsConsent ? 'TRUE' : 'FALSE',
        c.emailConsent ? 'TRUE' : 'FALSE',
        c.meta.psid || c.meta.igsid || c.meta.waId || '',
        c.meta.adId || '',
        `"${(c.meta.adTitle || '').replace(/"/g, '""')}"`,
        `"${c.tags.join(', ')}"`,
        isWindowActive(c.messagingWindowExpiresAt) ? 'ACTIVE' : 'EXPIRED',
        `"${JSON.stringify(vars).replace(/"/g, '""')}"`,
        c.createdAt
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `chatmize_audience_full_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Metrics calculation
  const totalContacts = contacts.length;
  const reachableMobileCount = contacts.filter(c => !!c.phone).length;
  const emailsCapturedCount = contacts.filter(c => !!c.email).length;
  const activeWindowCount = contacts.filter(c => isWindowActive(c.messagingWindowExpiresAt)).length;
  
  const totalVariablesAcrossAudience = contacts.reduce((acc, c) => {
    const vars = c.variables || c.customFields || {};
    return acc + Object.keys(vars).length;
  }, 0);

  const rnSubscribersCount = contacts.reduce((acc, c) => {
    const hasActive = (c.recurringTokens || []).some(t => t.status === 'active');
    return acc + (hasActive ? 1 : 0);
  }, 0);

  // Filtered deletion audit logs
  const filteredAuditLogs = deletionLogs.filter(log => {
    if (!auditSearchQuery.trim()) return true;
    const q = auditSearchQuery.toLowerCase();
    return (
      log.confirmationCode.toLowerCase().includes(q) ||
      (log.deletedContactId || '').toLowerCase().includes(q) ||
      (log.channel || '').toLowerCase().includes(q) ||
      (log.reason || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 flex flex-col gap-5 overflow-y-auto pb-10 pr-1">
      {/* Header & Status */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-white tracking-tight">Audience & Contact Records</h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Firestore Database
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            Compliant CRM capturing First/Last Name, Mobile, Verified Email, Meta Identifiers, Dynamic Variables, and GDPR Right to Erasure.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Recurring Notifications Marketing Broadcast Hub Button */}
          <button
            onClick={() => setShowBroadcastHub(true)}
            className="px-3 py-2 bg-gradient-to-r from-cyan-600/30 to-blue-600/30 hover:from-cyan-600/40 hover:to-blue-600/40 text-cyan-300 hover:text-cyan-200 rounded-xl text-xs font-bold border border-cyan-500/40 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            title="Manage Meta Recurring Notifications (Marketing Messages API) & Broadcast beyond 24h"
          >
            <BellRing className="w-3.5 h-3.5 text-cyan-400" />
            <span>RN Broadcast Hub</span>
            <span className="px-1.5 py-0.2 rounded-full bg-cyan-400/20 text-[10px] font-mono font-bold text-cyan-300 ml-0.5">
              {rnSubscribersCount} Active
            </span>
          </button>

          {/* Compliance & Erasure Audit Log Button */}
          <button
            onClick={() => setShowAuditLogsModal(true)}
            className="px-3 py-2 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 hover:text-indigo-200 rounded-xl text-xs font-semibold border border-indigo-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
            title="View verified proof of deletion records for GDPR and Meta compliance"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Erasure Audit Registry ({deletionLogs.length})</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-white/10 flex items-center gap-1.5 transition-all cursor-pointer"
            title="Download full CSV with all personal info, Meta IDs, and custom variables"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setShowCaptureModal(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Capture New Lead</span>
          </button>
        </div>
      </div>

      {/* Compliance & Right to be Forgotten Banner */}
      <div className="p-3.5 bg-gradient-to-r from-indigo-950/40 via-purple-950/40 to-slate-900/60 border border-indigo-500/20 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 flex-shrink-0 mt-0.5">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-white block">GDPR Article 17, CCPA & Meta Data Deletion Compliant:</span>
            <span className="text-slate-300">
              When a contact requests erasure (<code className="text-indigo-300">"DELETE ME"</code>, <code className="text-indigo-300">"STOP"</code>, or manual admin request), ChatMize hard-purges all PII, Mobile, Email, Meta PSID/IGSID, and dynamic variables from Firestore and issues a verified <strong className="text-indigo-300 font-mono">Meta Confirmation Code</strong>.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 font-mono">
            Right to Erasure Ready
          </span>
          <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 font-mono">
            {deletionLogs.length} Erasure Proofs Issued
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-3.5 bg-slate-900/80 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Contacts</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-1">{totalContacts}</p>
          <span className="text-[10px] text-slate-400">All channels combined</span>
        </div>

        <div className="p-3.5 bg-slate-900/80 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Mobile Phones</span>
            <Phone className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{reachableMobileCount}</p>
          <span className="text-[10px] text-emerald-400/80">SMS & WhatsApp ready</span>
        </div>

        <div className="p-3.5 bg-slate-900/80 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Verified Emails</span>
            <Mail className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-cyan-300 mt-1">{emailsCapturedCount}</p>
          <span className="text-[10px] text-slate-400">Captured in bot flows</span>
        </div>

        <div className="p-3.5 bg-slate-900/80 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Dynamic Variables</span>
            <Hash className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-300 mt-1">{totalVariablesAcrossAudience}</p>
          <span className="text-[10px] text-slate-400">Reusable in {'{{curly}}'} tags</span>
        </div>

        <div className="p-3.5 bg-slate-900/80 rounded-2xl border border-white/10 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>24h Meta Window</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-bold text-purple-300">{activeWindowCount}</p>
            <span className="text-[10px] text-cyan-400 font-medium">
              +{contacts.filter(c => (c.recurringTokens || []).some(t => t.status === 'active')).length} RN Tokens
            </span>
          </div>
          <span className="text-[10px] text-purple-300/80">Reachable within policy</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-3 flex flex-col lg:flex-row gap-3 items-center justify-between">
        {/* Search Input */}
        <div className="relative w-full lg:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search name, phone, email, company, tag, variable, PSID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-blue-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Channel Filters */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-white/10 text-xs font-medium">
            <button
              onClick={() => setChannelFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${channelFilter === 'all' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              All Channels
            </button>
            <button
              onClick={() => setChannelFilter('messenger')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${channelFilter === 'messenger' ? 'bg-blue-600/30 text-blue-300 border border-blue-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <MessageSquare className="w-3 h-3" /> Messenger
            </button>
            <button
              onClick={() => setChannelFilter('instagram')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${channelFilter === 'instagram' ? 'bg-pink-600/30 text-pink-300 border border-pink-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Instagram className="w-3 h-3" /> Instagram
            </button>
            <button
              onClick={() => setChannelFilter('whatsapp')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${channelFilter === 'whatsapp' ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Smartphone className="w-3 h-3" /> WhatsApp
            </button>
          </div>

          {/* Quick Attribute Filter */}
          <select
            value={attributeFilter}
            onChange={(e) => setAttributeFilter(e.target.value as any)}
            className="bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500 transition-colors cursor-pointer"
          >
            <option value="all">All Attributes</option>
            <option value="has_rn_token">Has Active RN Token (Meta)</option>
            <option value="rn_expiring_soon">RN Expiring Soon (≤ 14d)</option>
            <option value="has_phone">Has Mobile Phone</option>
            <option value="has_email">Has Email Address</option>
            <option value="has_variables">Has Dynamic Variables</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500 transition-colors cursor-pointer"
          >
            <option value="all">All Lifecycles</option>
            <option value="lead">Leads</option>
            <option value="subscriber">Subscribers</option>
            <option value="customer">Customers</option>
            <option value="unsubscribed">Unsubscribed</option>
          </select>
        </div>
      </div>

      {/* Main Table & Selected Contact Drawer Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Contacts Table */}
        <div className={`bg-slate-900/80 border border-white/10 rounded-3xl overflow-hidden ${selectedContact ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-white/10 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Contact & Identity</th>
                  <th className="py-3 px-3">Mobile & Email</th>
                  <th className="py-3 px-3">Channel</th>
                  <th className="py-3 px-3">Dynamic Variables</th>
                  <th className="py-3 px-3">Attribution & Ad</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                        <span>Connecting to Firestore database...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No contacts match your current search or filters.
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map((contact) => {
                    const windowActive = isWindowActive(contact.messagingWindowExpiresAt);
                    const isSelected = selectedContact?.id === contact.id;
                    const vars = contact.variables || contact.customFields || {};
                    const varEntries = Object.entries(vars);

                    return (
                      <tr 
                        key={contact.id} 
                        onClick={() => setSelectedContact(contact)}
                        className={`hover:bg-white/[0.03] transition-colors cursor-pointer ${isSelected ? 'bg-blue-500/10 border-l-2 border-l-blue-400' : ''}`}
                      >
                        {/* Contact Name & Company */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <img 
                              src={contact.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'} 
                              alt={contact.name} 
                              className="w-9 h-9 rounded-full object-cover border border-white/10 flex-shrink-0"
                            />
                            <div className="min-w-0 max-w-[170px]">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white block truncate">{contact.name}</span>
                              </div>
                              {contact.company ? (
                                <span className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                                  <Building2 className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                  <span className="truncate">{contact.company}</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {contact.status.toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Mobile & Email */}
                        <td className="py-3 px-3 max-w-[190px]">
                          <div className="space-y-1">
                            {contact.phone ? (
                              <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono truncate">
                                <Phone className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{contact.phone}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-600 block">No phone</span>
                            )}
                            {contact.email ? (
                              <div className="flex items-center gap-1 text-[11px] text-blue-300 font-mono truncate">
                                <Mail className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{contact.email}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-600 block">No email</span>
                            )}
                          </div>
                        </td>

                        {/* Channel Badge */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {getChannelBadge(contact.channel)}
                        </td>

                        {/* Dynamic Variables Badge & Preview */}
                        <td className="py-3 px-3 max-w-[170px]">
                          {varEntries.length > 0 ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-[10px]">
                                <Hash className="w-2.5 h-2.5" />
                                {varEntries.length} {varEntries.length === 1 ? 'var' : 'vars'}
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {varEntries.slice(0, 2).map(([k, v]) => (
                                  <span 
                                    key={k} 
                                    className="px-1.5 py-0.2 rounded bg-white/5 text-[9px] text-slate-300 font-mono truncate max-w-[130px]"
                                    title={`${k}: ${String(v)}`}
                                  >
                                    {k}: <strong className="text-white">{String(v)}</strong>
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-600 font-mono">None captured</span>
                          )}
                        </td>

                        {/* Meta Attribution & Ad Source */}
                        <td className="py-3 px-3 max-w-[180px]">
                          {contact.meta.adTitle ? (
                            <div className="truncate">
                              <span className="text-[10px] text-amber-300 font-mono block truncate" title={contact.meta.adTitle}>
                                🎯 {contact.meta.adTitle}
                              </span>
                              <span className="text-[9px] text-slate-500 font-mono">
                                Ad ID: {contact.meta.adId || 'N/A'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-mono truncate block">
                              {contact.meta.adSource || 'Organic Inbound'}
                            </span>
                          )}
                        </td>

                        {/* Status & 24h Messaging Window */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {contact.status === 'unsubscribed' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                              <UserX className="w-2.5 h-2.5" /> Unsubscribed
                            </span>
                          ) : windowActive ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> 24h Window
                            </span>
                          ) : (contact.recurringTokens || []).some(t => t.status === 'active') ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-cyan-300 font-medium bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30" title="Active Meta Recurring Notification Opt-In">
                              <BellRing className="w-2.5 h-2.5 text-cyan-400" /> RN Token Active
                            </span>
                          ) : (contact.otnTokens || []).some(t => t.status === 'available') ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-purple-300 font-medium bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/30" title="Available One-Time Notification Token">
                              <Zap className="w-2.5 h-2.5 text-purple-400" /> OTN Available
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                              Window Closed
                            </span>
                          )}
                        </td>

                        {/* Action buttons */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMetaFollowUpContact(contact);
                              }}
                              className="p-1.5 hover:bg-blue-500/20 rounded-lg text-slate-400 hover:text-blue-300 transition-colors cursor-pointer"
                              title="Send Meta Compliant Follow-Up (24h+)"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openErasureModal(contact);
                              }}
                              className="p-1.5 hover:bg-rose-500/15 rounded-lg text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                              title="Delete or Erase Contact (GDPR Right to be Forgotten)"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedContact(contact);
                              }}
                              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                              title="Inspect Details"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Contact Inspector Drawer */}
        {selectedContact && (
          <div className="bg-slate-900/95 border border-white/15 rounded-3xl p-5 space-y-5 shadow-2xl relative animate-in fade-in slide-in-from-right-4 duration-200">
            {/* Drawer Header */}
            <div className="flex items-start justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <img 
                  src={selectedContact.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'} 
                  alt={selectedContact.name} 
                  className="w-12 h-12 rounded-full object-cover border-2 border-blue-500/40 flex-shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-white truncate">{selectedContact.name}</h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    {getChannelBadge(selectedContact.channel)}
                    <span className="text-[10px] text-slate-400 font-mono">
                      ID: {selectedContact.id.slice(0, 10)}...
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedContact(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title="Close Drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Meta 24h Window & Follow-Up Permissions Card */}
            <div className={`p-3.5 rounded-2xl border text-xs space-y-2.5 ${
              isWindowActive(selectedContact.messagingWindowExpiresAt)
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-900 border-white/10 text-slate-300'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>
                    {isWindowActive(selectedContact.messagingWindowExpiresAt)
                      ? 'Meta 24-Hour Messaging Window: ACTIVE'
                      : 'Meta 24-Hour Messaging Window: EXPIRED'}
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isWindowActive(selectedContact.messagingWindowExpiresAt)
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {isWindowActive(selectedContact.messagingWindowExpiresAt) ? 'Standard Allowed' : 'Tag / Token Required'}
                </span>
              </div>

              <p className="text-[11px] opacity-85 leading-relaxed">
                {isWindowActive(selectedContact.messagingWindowExpiresAt)
                  ? 'Standard free-form messages, audio, and flow triggers can be sent without template fees or tag restrictions.'
                  : 'Free-form messaging closed. Meta requires an approved Message Tag (CONFIRMED_EVENT_UPDATE, POST_PURCHASE_UPDATE, ACCOUNT_UPDATE, HUMAN_AGENT), Recurring Notification token, or WhatsApp template.'}
              </p>

              {/* Recurring Notification Tokens */}
              {selectedContact.recurringTokens && selectedContact.recurringTokens.length > 0 && (
                <div className="pt-2 border-t border-white/5 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 block">
                    Active Recurring Notification Tokens (RN API)
                  </span>
                  {selectedContact.recurringTokens.map((rn) => (
                    <div key={rn.tokenId} className="p-2 rounded-xl bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <BellRing className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                        <div className="truncate">
                          <span className="font-bold text-white block truncate">{rn.topic}</span>
                          <span className="text-[10px] text-slate-400 font-mono capitalize">{rn.frequency} updates</span>
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold flex-shrink-0">
                        Active
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* OTN Tokens */}
              {selectedContact.otnTokens && selectedContact.otnTokens.length > 0 && (
                <div className="pt-1.5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">
                    One-Time Notification Tokens (OTN API)
                  </span>
                  {selectedContact.otnTokens.map((otn) => (
                    <div key={otn.token} className="p-2 rounded-xl bg-purple-950/40 border border-purple-500/20 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <Zap className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                        <span className="font-bold text-white truncate">{otn.topic}</span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold flex-shrink-0 ${
                        otn.status === 'available' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {otn.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Send Follow-Up Action Button */}
              <button
                onClick={() => setMetaFollowUpContact(selectedContact)}
                className="w-full mt-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Meta Compliant Follow-Up (24h+)</span>
              </button>
            </div>

            {/* Contact Information (View & Edit) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Contact Information
                </span>
                <button
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  {isEditingProfile ? 'Cancel' : 'Edit Info'}
                </button>
              </div>

              {isEditingProfile ? (
                /* Profile Edit Mode */
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-blue-500/30 space-y-2.5 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">First Name</label>
                      <input
                        type="text"
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Last Name</label>
                      <input
                        type="text"
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Mobile Phone</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Email Address</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Company</label>
                      <input
                        type="text"
                        value={editCompany}
                        onChange={(e) => setEditCompany(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Job Title</label>
                      <input
                        type="text"
                        value={editJobTitle}
                        onChange={(e) => setEditJobTitle(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">City</label>
                      <input
                        type="text"
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Country</label>
                      <input
                        type="text"
                        value={editCountry}
                        onChange={(e) => setEditCountry(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer mt-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingProfile ? 'Saving...' : 'Save Profile Changes'}</span>
                  </button>
                </div>
              ) : (
                /* Profile View Mode */
                <div className="space-y-2 text-xs">
                  {/* First & Last Name */}
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-white/5 flex items-center justify-between">
                    <span className="text-slate-400">First / Last Name:</span>
                    <span className="text-white font-medium">
                      {selectedContact.firstName || selectedContact.name.split(' ')[0]} {selectedContact.lastName || selectedContact.name.split(' ').slice(1).join(' ')}
                    </span>
                  </div>

                  {/* Mobile Phone */}
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-white/5 flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" /> Mobile Phone:
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono">{selectedContact.phone || 'Not provided'}</span>
                      {selectedContact.phone && (
                        <button
                          onClick={() => copyToClipboard(selectedContact.phone!, 'phone')}
                          className="text-slate-500 hover:text-white transition-colors cursor-pointer"
                          title="Copy phone"
                        >
                          {copiedText === 'phone' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Email */}
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-white/5 flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-blue-400" /> Email Address:
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono truncate max-w-[150px]">{selectedContact.email || 'Not provided'}</span>
                      {selectedContact.email && (
                        <button
                          onClick={() => copyToClipboard(selectedContact.email!, 'email')}
                          className="text-slate-500 hover:text-white transition-colors cursor-pointer"
                          title="Copy email"
                        >
                          {copiedText === 'email' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Company & Title */}
                  {(selectedContact.company || selectedContact.jobTitle) && (
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-white/5 flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-indigo-400" /> Company:
                      </span>
                      <span className="text-white font-medium truncate max-w-[170px]">
                        {selectedContact.jobTitle ? `${selectedContact.jobTitle}, ` : ''}{selectedContact.company}
                      </span>
                    </div>
                  )}

                  {/* Location */}
                  {(selectedContact.city || selectedContact.country) && (
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-white/5 flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-rose-400" /> Location:
                      </span>
                      <span className="text-white font-medium">
                        {[selectedContact.city, selectedContact.country].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Consent Badges */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className={`p-2 rounded-xl border text-[10px] flex items-center gap-1.5 ${selectedContact.smsConsent ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-slate-950 border-white/5 text-slate-500'}`}>
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>SMS Opt-In (TCPA)</span>
                    </div>
                    <div className={`p-2 rounded-xl border text-[10px] flex items-center gap-1.5 ${selectedContact.emailConsent ? 'bg-blue-500/10 border-blue-500/20 text-blue-300' : 'bg-slate-950 border-white/5 text-slate-500'}`}>
                      <CheckCircle2 className="w-3 h-3 text-blue-400" />
                      <span>Email Consent</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Conversation Variables Section */}
            <div className="space-y-2.5 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Dynamic Custom Variables
                  </span>
                </div>
                <span className="text-[10px] font-mono text-amber-400">
                  {Object.keys(selectedContact.variables || selectedContact.customFields || {}).length} variables
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Bot question responses, quiz choices, and answers. Click <strong className="text-amber-300">Copy</strong> to paste into chatbot text as <code className="text-amber-300 font-mono">{'{{var_name}}'}</code>.
              </p>

              {/* Variable List */}
              <div className="space-y-1.5">
                {Object.entries(selectedContact.variables || selectedContact.customFields || {}).map(([key, val]) => (
                  <div 
                    key={key} 
                    className="p-2.5 rounded-xl bg-slate-950 border border-white/10 flex items-center justify-between gap-2 group hover:border-amber-500/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono font-bold text-amber-300 truncate">
                          {`{{${key}}}`}
                        </span>
                        <button
                          onClick={() => copyVarShortcode(key)}
                          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white transition-opacity p-0.5 cursor-pointer"
                          title="Copy shortcode tag"
                        >
                          {copiedKey === key ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      <span className="text-xs text-white block truncate font-medium mt-0.5">
                        {String(val)}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteVariable(key)}
                      className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 p-1 rounded transition-all cursor-pointer"
                      title="Delete variable"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {Object.keys(selectedContact.variables || selectedContact.customFields || {}).length === 0 && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-dashed border-white/10 text-center text-slate-500 text-xs">
                    No custom variables captured yet. Add one below or test via the Flow Simulator.
                  </div>
                )}
              </div>

              {/* Add New Variable Row */}
              <div className="pt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  + Add Variable / Custom Field
                </span>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Key (e.g. budget)"
                    value={newVarKey}
                    onChange={(e) => setNewVarKey(e.target.value)}
                    className="w-1/2 bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500 font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. $10,000)"
                    value={newVarVal}
                    onChange={(e) => setNewVarVal(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddVariable()}
                    className="w-1/2 bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500 font-mono"
                  />
                  <button
                    onClick={handleAddVariable}
                    disabled={!newVarKey.trim()}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex-shrink-0"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>

            {/* Native Meta Graph Identifiers & Ad Attribution */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Meta Graph API & Ad Attribution
              </span>
              <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-2 text-xs font-mono">
                {selectedContact.meta.psid && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Meta PSID:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-cyan-400">{selectedContact.meta.psid}</span>
                      <button 
                        onClick={() => copyToClipboard(selectedContact.meta.psid!, 'psid')}
                        className="text-slate-600 hover:text-white cursor-pointer"
                      >
                        {copiedText === 'psid' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                      </button>
                    </div>
                  </div>
                )}
                {selectedContact.meta.igsid && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Instagram IGSID:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-pink-400">{selectedContact.meta.igsid}</span>
                      <button 
                        onClick={() => copyToClipboard(selectedContact.meta.igsid!, 'igsid')}
                        className="text-slate-600 hover:text-white cursor-pointer"
                      >
                        {copiedText === 'igsid' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                      </button>
                    </div>
                  </div>
                )}
                {selectedContact.meta.waId && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">WhatsApp ID:</span>
                    <span className="text-emerald-400">{selectedContact.meta.waId}</span>
                  </div>
                )}
                {selectedContact.meta.adId && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Meta Ad ID:</span>
                    <span className="text-amber-400">{selectedContact.meta.adId}</span>
                  </div>
                )}
                {selectedContact.meta.adTitle && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-500">Ad Campaign:</span>
                    <span className="text-white truncate">{selectedContact.meta.adTitle}</span>
                  </div>
                )}
                {selectedContact.meta.locale && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Locale / Timezone:</span>
                    <span className="text-slate-300">{selectedContact.meta.locale} (UTC {selectedContact.meta.timezone || 0})</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tags Management */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Assigned Tags
                </span>
                <span className="text-[10px] text-blue-400 font-mono">
                  {(selectedContact.tags || []).length} tags
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(selectedContact.tags || []).map((tag, idx) => (
                  <span 
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-mono"
                  >
                    <Tag className="w-3 h-3 text-blue-400" />
                    <span>{tag}</span>
                    <button
                      onClick={() => handleRemoveTagFromContact(selectedContact.id, tag)}
                      className="hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              {/* Add Tag Input */}
              <div className="flex gap-1.5 pt-1">
                <input
                  type="text"
                  placeholder="Add tag (e.g. VIP-Lead)..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTagToContact(selectedContact.id)}
                  className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 transition-colors font-mono"
                />
                <button
                  onClick={() => handleAddTagToContact(selectedContact.id)}
                  disabled={!newTagInput.trim()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Compliance, Privacy & Right to be Forgotten Controls */}
            <div className="pt-3 border-t border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  Privacy & Data Erasure (GDPR / Meta)
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Created: {new Date(selectedContact.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setContactToErase(selectedContact);
                    setErasureMode('opt_out');
                    setErasureReason('User opted out of messaging');
                    setShowErasureModal(true);
                  }}
                  className="py-2 px-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-white/10 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <UserX className="w-3.5 h-3.5 text-amber-400" />
                  <span>Revoke Consent</span>
                </button>

                <button
                  onClick={() => openErasureModal(selectedContact)}
                  className="py-2 px-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Right to be Forgotten</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Compliance Data Erasure & Right to be Forgotten Flow */}
      {showErasureModal && contactToErase && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-rose-500/30 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl shadow-rose-950/40 animate-in fade-in zoom-in-95 my-8">
            {erasureReceipt ? (
              /* Success: Proof of Deletion Certificate */
              <div className="space-y-4 text-xs">
                <div className="flex items-center gap-2.5 text-emerald-400 pb-2 border-b border-white/10">
                  <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Contact Irrevocably Purged</h3>
                    <span className="text-emerald-400 font-mono text-[11px]">
                      Compliant under GDPR Article 17 & Meta Platform Terms
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-white/10 space-y-3 font-mono">
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <span className="text-slate-400">Deletion Confirmation Code:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-amber-300 font-bold text-sm">{erasureReceipt.confirmationCode}</span>
                      <button
                        onClick={() => copyToClipboard(erasureReceipt.confirmationCode, 'receiptCode')}
                        className="p-1 hover:text-white text-slate-400"
                        title="Copy confirmation code"
                      >
                        {copiedText === 'receiptCode' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Purged Contact ID:</span>
                    <span className="text-slate-200">{erasureReceipt.contactId}</span>
                  </div>

                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Purge Timestamp:</span>
                    <span className="text-slate-200">{new Date(erasureReceipt.purgedAt).toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Channel Origin:</span>
                    <span className="text-slate-200 uppercase">{erasureReceipt.channel}</span>
                  </div>

                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Database Status:</span>
                    <span className="text-emerald-400 font-bold">100% PURGED FROM FIRESTORE</span>
                  </div>
                </div>

                <p className="text-slate-400 leading-relaxed text-[11px]">
                  All Personally Identifiable Information (name, phone, email, address), Meta platform scoped IDs (PSID/IGSID), and dynamic custom variables have been permanently deleted. An immutable audit record with this confirmation code has been generated.
                </p>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleDownloadErasureCertificate}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Download Certificate (.txt)</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowErasureModal(false);
                      setErasureReceipt(null);
                      setContactToErase(null);
                    }}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Confirmation Screen before Deletion */
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2 text-rose-400">
                    <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0" />
                    <div>
                      <h3 className="font-bold text-white text-base">Right to be Forgotten & Data Deletion</h3>
                      <span className="text-[11px] text-slate-400">GDPR Article 17, CCPA, & Meta Policy Compliance</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowErasureModal(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Target Contact Card */}
                <div className="p-3 bg-slate-950 rounded-2xl border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img 
                      src={contactToErase.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'} 
                      alt={contactToErase.name}
                      className="w-10 h-10 rounded-full object-cover border border-white/10"
                    />
                    <div>
                      <span className="font-bold text-white block text-sm">{contactToErase.name}</span>
                      <span className="text-slate-400 text-[11px] font-mono">
                        {contactToErase.phone || contactToErase.email || contactToErase.channel}
                      </span>
                    </div>
                  </div>
                  {getChannelBadge(contactToErase.channel)}
                </div>

                {/* Mode Selector */}
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-semibold block">Select Erasure Level:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setErasureMode('hard_purge')}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        erasureMode === 'hard_purge'
                          ? 'bg-rose-500/15 border-rose-500/50 text-rose-200 shadow-md shadow-rose-950/50'
                          : 'bg-slate-950 border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold mb-1 text-white">
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Full Hard Erasure</span>
                      </div>
                      <p className="text-[11px] opacity-80 leading-snug">
                        Permanently purge all PII, variables, Meta IDs, and generates a compliance confirmation code.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setErasureMode('opt_out')}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        erasureMode === 'opt_out'
                          ? 'bg-amber-500/15 border-amber-500/50 text-amber-200 shadow-md shadow-amber-950/50'
                          : 'bg-slate-950 border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold mb-1 text-white">
                        <UserX className="w-3.5 h-3.5 text-amber-400" />
                        <span>Revoke Consent Only</span>
                      </div>
                      <p className="text-[11px] opacity-80 leading-snug">
                        Sets status to unsubscribed and halts all messaging while retaining historical transaction logs.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Reason Selection */}
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Reason for Erasure Request:</label>
                  <select
                    value={erasureReason}
                    onChange={(e) => setErasureReason(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-rose-500 cursor-pointer"
                  >
                    <option value="User asked to be forgotten (GDPR Art. 17)">User asked to be forgotten (GDPR Art. 17)</option>
                    <option value="User sent STOP / DELETE ME in chat">User sent STOP / DELETE ME in chat</option>
                    <option value="Meta Data Deletion Request callback">Meta Data Deletion Request callback</option>
                    <option value="CCPA Consumer Right to Delete">CCPA Consumer Right to Delete</option>
                    <option value="Revocation of TCPA SMS Marketing Consent">Revocation of TCPA SMS Marketing Consent</option>
                    <option value="Administrative Record Purge">Administrative Record Purge</option>
                  </select>
                </div>

                {/* Safety Warning */}
                {erasureMode === 'hard_purge' && (
                  <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-2xl space-y-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5 font-bold text-rose-300">
                      <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                      <span>Irreversible Action Warning</span>
                    </div>
                    <p className="text-rose-200/80 leading-relaxed">
                      This will permanently remove <strong className="text-white">{contactToErase.name}</strong>, their phone (<span className="font-mono">{contactToErase.phone || 'none'}</span>), email, all {Object.keys(contactToErase.variables || contactToErase.customFields || {}).length} custom dynamic variables, and Meta Graph IDs from Firestore.
                    </p>
                  </div>
                )}

                {/* Confirmation Input for Hard Purge */}
                {erasureMode === 'hard_purge' && (
                  <div>
                    <label className="text-slate-400 block mb-1 text-[11px]">
                      Type <strong className="text-rose-400 font-mono">DELETE</strong> to confirm permanent erasure:
                    </label>
                    <input
                      type="text"
                      placeholder="DELETE"
                      value={erasureConfirmationInput}
                      onChange={(e) => setErasureConfirmationInput(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-rose-500 uppercase tracking-widest text-center"
                    />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowErasureModal(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteErasure}
                    disabled={isErasing || (erasureMode === 'hard_purge' && erasureConfirmationInput.trim() !== 'DELETE')}
                    className="flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-40 text-white rounded-xl font-bold transition-all shadow-md shadow-rose-600/30 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isErasing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Purging Records...</span>
                      </>
                    ) : erasureMode === 'hard_purge' ? (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Permanently Erase</span>
                      </>
                    ) : (
                      <>
                        <UserX className="w-3.5 h-3.5" />
                        <span>Revoke Consent</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Deletion & Compliance Audit Registry */}
      {showAuditLogsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-white/15 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Compliance & Deletion Audit Registry</h3>
                  <span className="text-[11px] text-slate-400">
                    Immutable proof of data erasure requests for GDPR Article 17, CCPA, and Meta audits
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowAuditLogsModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search within Audit Logs */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search confirmation code, contact ID, or reason..."
                value={auditSearchQuery}
                onChange={(e) => setAuditSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Table of Proofs */}
            <div className="max-h-[50vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[10px] font-semibold sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Confirmation Code</th>
                    <th className="py-2.5 px-3">Date Purged</th>
                    <th className="py-2.5 px-3">Channel</th>
                    <th className="py-2.5 px-3">Reason</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-500 font-sans">
                        No deletion requests recorded yet. When a contact is deleted or asks to be forgotten, their unique confirmation proof will appear here.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-2.5 px-3 font-bold text-amber-300">
                          <div className="flex items-center gap-1.5">
                            <span>{log.confirmationCode}</span>
                            <button
                              onClick={() => copyToClipboard(log.confirmationCode, log.confirmationCode)}
                              className="text-slate-500 hover:text-white cursor-pointer"
                              title="Copy code"
                            >
                              {copiedText === log.confirmationCode ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {new Date(log.purgedAt).toLocaleDateString()}{' '}
                          <span className="text-[10px] text-slate-500">
                            {new Date(log.purgedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 uppercase">{log.channel || 'WEB'}</td>
                        <td className="py-2.5 px-3 text-slate-400 font-sans text-xs truncate max-w-[180px]" title={log.reason}>
                          {log.reason}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-sans font-semibold">
                            <Check className="w-3 h-3" /> Purged
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-slate-400">
                Total Proofs Logged: <strong className="text-white">{deletionLogs.length}</strong>
              </span>
              <button
                onClick={() => setShowAuditLogsModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Close Registry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Capture Full Inbound Lead with Verified Info & Variables */}
      {showCaptureModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-white/15 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-white text-base">Capture & Enrich Contact Lead</h3>
                  <span className="text-[11px] text-slate-400 block">Saves full identity and dynamic conversation variables to Firestore</span>
                </div>
              </div>
              <button
                onClick={() => setShowCaptureModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs max-h-[65vh] overflow-y-auto pr-1">
              {/* Channel Selection */}
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Inbound Channel</label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalChannel('messenger')}
                    className={`py-2 px-2 rounded-xl border text-center font-medium transition-all cursor-pointer ${modalChannel === 'messenger' ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-slate-950 border-white/10 text-slate-400'}`}
                  >
                    Messenger
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalChannel('instagram')}
                    className={`py-2 px-2 rounded-xl border text-center font-medium transition-all cursor-pointer ${modalChannel === 'instagram' ? 'bg-pink-600/30 border-pink-500 text-pink-300' : 'bg-slate-950 border-white/10 text-slate-400'}`}
                  >
                    Instagram
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalChannel('whatsapp')}
                    className={`py-2 px-2 rounded-xl border text-center font-medium transition-all cursor-pointer ${modalChannel === 'whatsapp' ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300' : 'bg-slate-950 border-white/10 text-slate-400'}`}
                  >
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalChannel('web')}
                    className={`py-2 px-2 rounded-xl border text-center font-medium transition-all cursor-pointer ${modalChannel === 'web' ? 'bg-slate-700/50 border-slate-400 text-white' : 'bg-slate-950 border-white/10 text-slate-400'}`}
                  >
                    Webchat
                  </button>
                </div>
              </div>

              {/* Personal Info: First & Last Name */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">First Name</label>
                  <input
                    type="text"
                    value={modalFirstName}
                    onChange={(e) => setModalFirstName(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Last Name</label>
                  <input
                    type="text"
                    value={modalLastName}
                    onChange={(e) => setModalLastName(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Mobile Phone & Email */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold flex items-center gap-1">
                    <Phone className="w-3 h-3 text-emerald-400" /> Mobile Phone
                  </label>
                  <input
                    type="text"
                    value={modalPhone}
                    onChange={(e) => setModalPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold flex items-center gap-1">
                    <Mail className="w-3 h-3 text-blue-400" /> Email Address
                  </label>
                  <input
                    type="email"
                    value={modalEmail}
                    onChange={(e) => setModalEmail(e.target.value)}
                    placeholder="jordan@company.com"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Company & Job Title */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Company Name</label>
                  <input
                    type="text"
                    value={modalCompany}
                    onChange={(e) => setModalCompany(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Job Title</label>
                  <input
                    type="text"
                    value={modalJobTitle}
                    onChange={(e) => setModalJobTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Location: City & Country */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">City</label>
                  <input
                    type="text"
                    value={modalCity}
                    onChange={(e) => setModalCity(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Country</label>
                  <input
                    type="text"
                    value={modalCountry}
                    onChange={(e) => setModalCountry(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Meta Ad Attribution */}
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Meta Ad Campaign Title</label>
                <input
                  type="text"
                  value={modalAdTitle}
                  onChange={(e) => setModalAdTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                />
              </div>

              {/* Dynamic Variables Intake */}
              <div className="p-3 bg-slate-950 rounded-2xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-amber-400" />
                    Dynamic Variables to Attach
                  </span>
                  <span className="text-[10px] text-slate-500">Captured bot answers</span>
                </div>

                {/* Variable chips */}
                <div className="space-y-1.5">
                  {modalVars.map((v, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-900 px-2.5 py-1.5 rounded-lg border border-white/5">
                      <span className="font-mono text-amber-300 text-[11px]">{`{{${v.key}}}`}</span>
                      <span className="text-white font-medium text-xs">{v.val}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveModalVarRow(i)}
                        className="text-slate-500 hover:text-red-400 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add variable row */}
                <div className="flex gap-1.5 pt-1">
                  <input
                    type="text"
                    placeholder="Var key (e.g. budget)"
                    value={newModalVarKey}
                    onChange={(e) => setNewModalVarKey(e.target.value)}
                    className="w-1/2 bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-amber-500 font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. $20k)"
                    value={newModalVarVal}
                    onChange={(e) => setNewModalVarVal(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddModalVarRow())}
                    className="w-1/2 bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddModalVarRow}
                    disabled={!newModalVarKey.trim()}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowCaptureModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateContact}
                disabled={simulating || (!modalFirstName.trim() && !modalLastName.trim())}
                className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer"
              >
                {simulating ? 'Recording to Firestore...' : 'Save Lead & Variables'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meta 24h+ Follow-Up Dispatcher Modal */}
      {metaFollowUpContact && (
        <MetaFollowUpModal
          contact={metaFollowUpContact}
          workspaceId={workspaceId}
          onClose={() => setMetaFollowUpContact(null)}
        />
      )}

      {/* Meta Recurring Notifications (RN) Broadcast & Token Hub Modal */}
      {showBroadcastHub && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-5 animate-in fade-in duration-200">
          <div className="w-full max-w-6xl max-h-[94vh] flex flex-col bg-slate-950 border border-cyan-500/30 rounded-3xl shadow-2xl overflow-hidden relative">
            <RecurringNotificationBroadcastHub 
              contacts={contacts} 
              onClose={() => setShowBroadcastHub(false)} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
