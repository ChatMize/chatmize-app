import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  getDocFromServer,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  serverTimestamp,
  Timestamp,
  arrayUnion
} from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  User as FirebaseUser
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Firebase web config: environment variables take precedence so each deploy
// target (dev / staging / production) can point at its own project and
// Firestore database. Falls back to the AI Studio applet config for local/demo.
const envVars = import.meta.env as Record<string, string | undefined>;
const applet = firebaseConfig as unknown as Record<string, string>;
const resolvedConfig = {
  apiKey: envVars.VITE_FIREBASE_API_KEY || applet.apiKey,
  authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN || applet.authDomain,
  projectId: envVars.VITE_FIREBASE_PROJECT_ID || applet.projectId,
  storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET || applet.storageBucket,
  messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID || applet.messagingSenderId,
  appId: envVars.VITE_FIREBASE_APP_ID || applet.appId,
  measurementId: envVars.VITE_FIREBASE_MEASUREMENT_ID || applet.measurementId,
};
const firestoreDatabaseId =
  envVars.VITE_FIRESTORE_DATABASE_ID || applet.firestoreDatabaseId;

// Initialize Firebase App singleton
const app = getApps().length === 0 ? initializeApp(resolvedConfig) : getApp();

// Initialize Firestore database using the configured database ID
export const db = getFirestore(app, firestoreDatabaseId);

/**
 * Demo seeding is opt-in and dev-only. It must never run in staging or
 * production: fictional contacts and campaigns would pollute real customer
 * data. Enable locally with VITE_ENABLE_DEMO_SEED=true.
 */
export function isDemoSeedEnabled(): boolean {
  return envVars.VITE_ENABLE_DEMO_SEED === 'true';
}

// Initialize Firebase Auth
export const auth = getAuth(app);

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export function subscribeToAuthChanges(callback: (user: AppUser | null) => void) {
  return onAuthStateChanged(auth, (user: FirebaseUser | null) => {
    if (user) {
      callback({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      });
    } else {
      callback(null);
    }
  });
}

export async function signInUser(email: string, pass: string): Promise<{ success: boolean; error?: string }> {
  try {
    await signInWithEmailAndPassword(auth, email.trim(), pass);
    return { success: true };
  } catch (err: any) {
    console.error('Firebase Auth sign in error:', err);
    let msg = 'Failed to sign in. Please verify your credentials.';
    if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
      msg = 'Invalid email or password.';
    } else if (err.code === 'auth/invalid-email') {
      msg = 'Please enter a valid email address.';
    } else if (err.code === 'auth/too-many-requests') {
      msg = 'Too many failed login attempts. Please wait or reset your password.';
    }
    return { success: false, error: msg };
  }
}

export async function signUpUser(email: string, pass: string, name?: string): Promise<{ success: boolean; error?: string; rawCode?: string }> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    if (name && cred.user) {
      await updateProfile(cred.user, { displayName: name.trim() });
    }
    return { success: true };
  } catch (err: any) {
    console.error('Firebase Auth sign up error:', err);
    let msg = err.message || 'Failed to create account.';
    if (err.code === 'auth/email-already-in-use') {
      msg = 'An account with this email already exists. Please switch to Sign In!';
    } else if (err.code === 'auth/weak-password') {
      msg = 'Password is too weak. Please use at least 6 characters.';
    } else if (err.code === 'auth/invalid-email') {
      msg = 'Please enter a valid email address.';
    } else if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/admin-restricted-operation') {
      msg = 'Email/Password sign-up is not enabled in Firebase Console Auth Providers yet. Enable it under Firebase Authentication > Sign-in method.';
    } else if (err.code) {
      msg = `Sign up failed (${err.code}): ${err.message || 'Please check console'}`;
    }
    return { success: false, error: msg, rawCode: err.code };
  }
}

export async function signOutUser(): Promise<{ success: boolean }> {
  try {
    await signOut(auth);
    return { success: true };
  } catch (err) {
    console.error('Sign out error:', err);
    return { success: false };
  }
}

export async function signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    return { success: true };
  } catch (err: any) {
    console.error('Google sign in error:', err);
    return { success: false, error: err.message || 'Google sign-in failed.' };
  }
}

export async function resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
    return { success: true };
  } catch (err: any) {
    console.error('Password reset error:', err);
    let msg = 'Could not send reset email.';
    if (err.code === 'auth/user-not-found') {
      msg = 'No account found with this email.';
    } else if (err.code === 'auth/invalid-email') {
      msg = 'Please enter a valid email address.';
    }
    return { success: false, error: msg };
  }
}

export interface MetaAttribution {
  adId?: string;
  adTitle?: string;
  adSource?: 'ADS' | 'ORGANIC' | 'SHORTLINK' | 'PAGE_POST' | 'STORY_REPLY';
  adSetId?: string;
  campaignId?: string;
  referralRef?: string;
  psid?: string; // Messenger Page-Scoped ID
  igsid?: string; // Instagram-Scoped ID
  waId?: string; // WhatsApp ID
  locale?: string;
  timezone?: number; // e.g. -5, -8
  gender?: string;
}

export interface MetaRecurringToken {
  id: string;
  topic: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  token: string;
  optedInAt: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'revoked';
  lastSentAt?: string;
  sendCount?: number;
  renewedAt?: string;
}

export interface MetaOtnToken {
  id: string;
  topic: string;
  token: string;
  optedInAt: string;
  status: 'available' | 'consumed';
}

export interface ContactRecord {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  channel: 'messenger' | 'instagram' | 'whatsapp' | 'web';
  email?: string;
  phone?: string; // Mobile Phone / SMS
  company?: string;
  jobTitle?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  status: 'lead' | 'subscriber' | 'customer' | 'unsubscribed';
  optInStatus: 'opted_in' | 'pending' | 'unsubscribed';
  smsConsent?: boolean;
  emailConsent?: boolean;
  messagingWindowExpiresAt?: string; // ISO string for Meta 24-hr window
  humanAgentExpiresAt?: string; // ISO string for Meta 7-day Human Agent extension
  recurringTokens?: MetaRecurringToken[]; // Meta Marketing Messages / Recurring Notifications tokens
  otnTokens?: MetaOtnToken[]; // Meta One-Time Notification tokens
  whatsappOptIn?: boolean; // WhatsApp Business opt-in status
  senderId?: string; // Meta PSID/IGSID for webhook-routed contacts
  tags: string[];
  variables: Record<string, string | number | boolean>; // Arbitrary dynamic captured variables: {{var_name}}
  customFields: Record<string, string | number | boolean>; // Synced with variables
  meta: MetaAttribution;
  notes?: string;
  createdAt: string;
  lastInteractionAt: string;
}

export type CampaignType = 'recurring' | 'date_specific' | 'drip' | 'broadcast';

export interface DripStep {
  id: string;
  stepNumber: number;
  delayValue: number;
  delayUnit: 'minutes' | 'hours' | 'days';
  title: string;
  messageText: string;
  mediaUrl?: string;
  ctaTitle?: string;
  ctaUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
  tagToAdd?: string;
  rnTopicRequired?: string;
}

export interface CampaignRecord {
  id: string;
  name: string;
  description?: string;
  type: CampaignType;
  channel: 'all' | 'messenger' | 'instagram' | 'whatsapp';
  status: 'draft' | 'active' | 'scheduled' | 'paused' | 'completed';
  targetAudience?: {
    channel?: string;
    topic?: string;
    tag?: string;
    hasActiveRnTokenOnly?: boolean;
  } | 'all' | 'rn_optins' | 'tagged_leads';
  targetAudienceFilter?: {
    tags?: string[];
    rnTopic?: string;
    rnCadence?: 'all' | 'daily' | 'weekly' | 'monthly';
    channel?: string;
  };
  // Recurring Notification settings
  rnTopic?: string;
  rnCadence?: 'daily' | 'weekly' | 'monthly';
  enforceRateLimitShield?: boolean;
  triggerOnRnOptin?: boolean;
  // Date-Specific settings
  scheduledDate?: string; // YYYY-MM-DD
  scheduledTime?: string; // HH:mm
  timeZone?: string;
  timezone?: string;
  scheduledDateTimeIso?: string;
  // Drip campaign settings
  triggerOnTag?: string;
  dripSteps?: DripStep[];
  // Message payload for single broadcasts / recurring blasts
  messageText?: string;
  mediaUrl?: string;
  ctaTitle?: string;
  ctaUrl?: string;
  ctaButtonText?: string;
  ctaButtonUrl?: string;
  // Delivery metrics & tracking
  stats?: {
    targetAudienceCount: number;
    deliveredCount: number;
    openedCount: number;
    clickedCount: number;
    optOutCount: number;
    lastDispatchedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Test connectivity as mandated by Firebase skill
export async function testFirebaseConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore client is offline or initializing.");
      return false;
    }
    // Missing document error is normal on first run and proves connection is live
    return true;
  }
}

// Subscribe to real-time contacts (capped: every mount re-reads the result
// set, so an unbounded listener burns reads on every page load)
export function subscribeToContacts(
  onUpdate: (contacts: ContactRecord[]) => void,
  onError?: (err: Error) => void,
  maxResults = 500
) {
  const contactsRef = collection(db, 'contacts');
  const q = query(contactsRef, orderBy('lastInteractionAt', 'desc'), limit(maxResults));

  return onSnapshot(
    q,
    (snapshot) => {
      const contacts: ContactRecord[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const vars = data.variables || data.customFields || {};
        contacts.push({
          id: doc.id,
          name: data.name || (data.firstName ? `${data.firstName} ${data.lastName || ''}`.trim() : 'Unnamed Contact'),
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          avatarUrl: data.avatarUrl || '',
          channel: data.channel || 'messenger',
          senderId: data.senderId || '',
          email: data.email || '',
          phone: data.phone || data.mobile || '',
          company: data.company || '',
          jobTitle: data.jobTitle || '',
          city: data.city || '',
          state: data.state || '',
          country: data.country || '',
          zipCode: data.zipCode || '',
          status: data.status || 'lead',
          optInStatus: data.optInStatus || 'opted_in',
          smsConsent: data.smsConsent ?? true,
          emailConsent: data.emailConsent ?? true,
          messagingWindowExpiresAt: data.messagingWindowExpiresAt || '',
          tags: Array.isArray(data.tags) ? data.tags : (typeof data.tags === 'string' ? JSON.parse(data.tags || '[]') : []),
          variables: vars,
          customFields: vars,
          meta: data.meta || {},
          notes: data.notes || '',
          createdAt: data.createdAt || new Date().toISOString(),
          lastInteractionAt: data.lastInteractionAt || new Date().toISOString(),
        });
      });
      onUpdate(contacts);
    },
    (err) => {
      console.error('Error listening to contacts in Firestore:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribe to real inbound/outbound messages for a Meta conversation.
 * Messages live at workspaces/{ws}/conversations/{channel_senderId}/messages.
 */
export function subscribeToConversationMessages(
  workspaceId: string,
  convoId: string,
  onUpdate: (messages: Array<{ id: string; direction: string; text: string; timestampMs: number; senderId: string }>) => void,
  onError?: (err: Error) => void,
) {
  const messagesRef = collection(db, 'workspaces', workspaceId, 'conversations', convoId, 'messages');
  const q = query(messagesRef, orderBy('timestampMs', 'asc'), limit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      const messages: Array<{ id: string; direction: string; text: string; timestampMs: number; senderId: string }> = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        messages.push({
          id: doc.id,
          direction: data.direction || 'inbound',
          text: data.text || '',
          timestampMs: data.timestampMs || 0,
          senderId: data.senderId || '',
        });
      });
      onUpdate(messages);
    },
    (err) => {
      console.error('Error listening to conversation messages:', err);
      if (onError) onError(err);
    }
  );
}

// Save or add contact to Firestore
export async function saveContact(contact: ContactRecord): Promise<void> {
  const contactRef = doc(db, 'contacts', contact.id);
  const vars = contact.variables || contact.customFields || {};
  // Strip undefined values (Firestore rejects them)
  const clean = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(clean);
    if (obj && typeof obj === 'object') {
      return Object.fromEntries(
        Object.entries(obj)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, clean(v)])
      );
    }
    return obj;
  };
  await setDoc(contactRef, clean({
    ...contact,
    variables: vars,
    customFields: vars,
    lastInteractionAt: new Date().toISOString(),
  }), { merge: true });
}

// Update specific fields on a contact
export async function updateContactField(
  contactId: string, 
  updates: Partial<ContactRecord>
): Promise<void> {
  const contactRef = doc(db, 'contacts', contactId);
  const patch: Record<string, any> = {
    ...updates,
    lastInteractionAt: new Date().toISOString(),
  };
  if (updates.variables) {
    patch.customFields = updates.variables;
  }
  await updateDoc(contactRef, patch);
}

// Set or update a dynamic variable on a contact
export async function setContactVariable(
  contactId: string,
  key: string,
  value: string | number | boolean
): Promise<void> {
  const cleanKey = key.trim().replace(/^\{\{|\}\}$/g, '').trim();
  if (!cleanKey) return;
  const contactRef = doc(db, 'contacts', contactId);
  await updateDoc(contactRef, {
    [`variables.${cleanKey}`]: value,
    [`customFields.${cleanKey}`]: value,
    lastInteractionAt: new Date().toISOString(),
  });
}

// Delete a dynamic variable on a contact
export async function deleteContactVariable(
  contactId: string,
  key: string,
  existingVariables: Record<string, any>
): Promise<void> {
  const cleanKey = key.trim();
  const updatedVars = { ...existingVariables };
  delete updatedVars[cleanKey];
  const contactRef = doc(db, 'contacts', contactId);
  await updateDoc(contactRef, {
    variables: updatedVars,
    customFields: updatedVars,
    lastInteractionAt: new Date().toISOString(),
  });
}

// Compliant Erasure / Meta Data Deletion Audit Record
export interface DeletionAuditRecord {
  id: string;
  confirmationCode: string;
  deletedContactId: string;
  channel?: string;
  reason: string;
  status: 'completed';
  purgedAt: string;
}

// Full Compliant Contact Deletion / Right to be Forgotten (GDPR Art. 17 / CCPA / Meta Policy)
export async function executeCompliantContactErasure(
  contactId: string, 
  channel?: string,
  reason: string = 'user_request'
): Promise<{ confirmationCode: string; purgedAt: string }> {
  const purgedAt = new Date().toISOString();
  // Generate Meta & GDPR compliant unique confirmation code: DEL-XXXXXXXX
  const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timestampCode = Date.now().toString(36).toUpperCase().slice(-4);
  const confirmationCode = `DEL-${randomHex}-${timestampCode}`;

  // 1. Permanently delete contact document (erasing all PII, names, phone, email, variables, Meta PSID/IGSID)
  const contactRef = doc(db, 'contacts', contactId);
  await deleteDoc(contactRef);

  // 2. Record immutable compliance audit entry (no PII retained)
  const auditRef = doc(db, 'deletion_audit_logs', confirmationCode);
  const auditData: DeletionAuditRecord = {
    id: confirmationCode,
    confirmationCode,
    deletedContactId: contactId,
    channel: channel || 'unknown',
    reason,
    status: 'completed',
    purgedAt,
  };
  await setDoc(auditRef, auditData);

  return { confirmationCode, purgedAt };
}

// Unsubscribe / Opt-Out Contact without erasing historical transaction data
export async function optOutContact(contactId: string): Promise<void> {
  const contactRef = doc(db, 'contacts', contactId);
  await updateDoc(contactRef, {
    status: 'unsubscribed',
    optInStatus: 'unsubscribed',
    smsConsent: false,
    emailConsent: false,
    lastInteractionAt: new Date().toISOString(),
  });
}

// Save or append a Meta Recurring Notification token
export async function saveRecurringNotificationToken(
  contactId: string,
  tokenData: Omit<MetaRecurringToken, 'id'> & { id?: string }
): Promise<void> {
  const contactRef = doc(db, 'contacts', contactId);
  const snap = await getDoc(contactRef);
  const currentTokens: MetaRecurringToken[] = snap.exists() ? (snap.data().recurringTokens || []) : [];
  const newToken: MetaRecurringToken = {
    id: tokenData.id || `rn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    topic: tokenData.topic,
    frequency: tokenData.frequency,
    token: tokenData.token,
    optedInAt: tokenData.optedInAt || new Date().toISOString(),
    expiresAt: tokenData.expiresAt,
    status: tokenData.status || 'active',
  };
  await updateDoc(contactRef, {
    recurringTokens: [...currentTokens.filter(t => t.topic !== tokenData.topic), newToken],
    lastInteractionAt: new Date().toISOString(),
  });
}

// Record that a Recurring Notification was sent (updates cadence tracking and sent counter)
export async function recordRecurringNotificationSent(
  contactId: string,
  tokenId: string
): Promise<void> {
  const contactRef = doc(db, 'contacts', contactId);
  const snap = await getDoc(contactRef);
  if (!snap.exists()) return;
  const currentTokens: MetaRecurringToken[] = snap.data().recurringTokens || [];
  const nowIso = new Date().toISOString();
  const updatedTokens = currentTokens.map(t => {
    if (t.id === tokenId) {
      return {
        ...t,
        lastSentAt: nowIso,
        sendCount: (t.sendCount || 0) + 1,
      };
    }
    return t;
  });
  await updateDoc(contactRef, {
    recurringTokens: updatedTokens,
    lastInteractionAt: nowIso,
  });
}

// Renew a Recurring Notification token (updates expiration date and resets status to active)
export async function renewRecurringNotificationToken(
  contactId: string,
  tokenId: string,
  newExpirationIso: string
): Promise<void> {
  const contactRef = doc(db, 'contacts', contactId);
  const snap = await getDoc(contactRef);
  if (!snap.exists()) return;
  const currentTokens: MetaRecurringToken[] = snap.data().recurringTokens || [];
  const nowIso = new Date().toISOString();
  const updatedTokens = currentTokens.map(t => {
    if (t.id === tokenId) {
      return {
        ...t,
        expiresAt: newExpirationIso,
        status: 'active' as const,
        renewedAt: nowIso,
      };
    }
    return t;
  });
  await updateDoc(contactRef, {
    recurringTokens: updatedTokens,
    lastInteractionAt: nowIso,
  });
}

// Save or append a Meta One-Time Notification (OTN) token
export async function saveOtnToken(
  contactId: string,
  tokenData: Omit<MetaOtnToken, 'id'> & { id?: string }
): Promise<void> {
  const contactRef = doc(db, 'contacts', contactId);
  const snap = await getDoc(contactRef);
  const currentTokens: MetaOtnToken[] = snap.exists() ? (snap.data().otnTokens || []) : [];
  const newToken: MetaOtnToken = {
    id: tokenData.id || `otn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    topic: tokenData.topic,
    token: tokenData.token,
    optedInAt: tokenData.optedInAt || new Date().toISOString(),
    status: tokenData.status || 'available',
  };
  await updateDoc(contactRef, {
    otnTokens: [...currentTokens, newToken],
    lastInteractionAt: new Date().toISOString(),
  });
}

// Subscribe to real-time deletion audit logs for compliance officers.
// Capped: this collection grows forever, so the listener is bounded to the
// most recent entries instead of re-reading the full history on every mount.
export function subscribeToDeletionAuditLogs(
  onUpdate: (logs: DeletionAuditRecord[]) => void,
  onError?: (err: Error) => void,
  maxResults = 200
) {
  const logsRef = collection(db, 'deletion_audit_logs');
  const q = query(logsRef, orderBy('purgedAt', 'desc'), limit(maxResults));

  return onSnapshot(
    q,
    (snapshot) => {
      const logs: DeletionAuditRecord[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as DeletionAuditRecord;
        logs.push({
          ...data,
          id: doc.id,
        });
      });
      onUpdate(logs);
    },
    (err) => {
      console.error('Error listening to deletion audit logs:', err);
      if (onError) onError(err);
    }
  );
}

// Standard delete contact from Firestore
export async function deleteContactRecord(contactId: string): Promise<void> {
  const contactRef = doc(db, 'contacts', contactId);
  await deleteDoc(contactRef);
}

// Seed realistic Meta-captured contacts if Firestore is empty.
// DEMO ONLY: no-ops unless VITE_ENABLE_DEMO_SEED=true.
export async function seedInitialMetaContacts(): Promise<void> {
  if (!isDemoSeedEnabled()) {
    return;
  }
  try {
    const contactsRef = collection(db, 'contacts');
    const snap = await getDocs(contactsRef);
    if (!snap.empty) {
      return; // Already populated
    }

    const now = new Date();
    const windowActive = new Date(now.getTime() + 18 * 60 * 60 * 1000).toISOString();
    const windowExpired = new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString();

    const sampleContacts: ContactRecord[] = [
      {
        id: 'meta_fb_91827491823',
        name: 'Sarah Jenkins',
        firstName: 'Sarah',
        lastName: 'Jenkins',
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        channel: 'messenger',
        email: 'sarah.jenkins@growthcraft.io',
        phone: '+1 (555) 234-8901',
        company: 'GrowthCraft Media',
        jobTitle: 'VP of Growth',
        city: 'Austin',
        state: 'TX',
        country: 'United States',
        zipCode: '78701',
        status: 'lead',
        optInStatus: 'opted_in',
        smsConsent: true,
        emailConsent: true,
        messagingWindowExpiresAt: windowActive,
        humanAgentExpiresAt: new Date(now.getTime() + 6 * 24 * 3600 * 1000).toISOString(),
        recurringTokens: [
          {
            id: 'rn_tok_daily_masterclass_8123',
            topic: 'Daily Bot Growth Hacks',
            frequency: 'daily',
            token: 'tkn_rn_fb_dy_812374918239',
            optedInAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString(),
            expiresAt: new Date(now.getTime() + 178 * 24 * 3600 * 1000).toISOString(),
            status: 'active',
          }
        ],
        otnTokens: [
          {
            id: 'otn_tok_webinar_live_9182',
            topic: 'Webinar Broadcast Starts Now',
            token: 'tkn_otn_91827491823_webinar',
            optedInAt: new Date(now.getTime() - 1 * 24 * 3600 * 1000).toISOString(),
            status: 'available',
          }
        ],
        tags: ['VIP Lead', 'Webinar Registered', 'Ad Referral', 'RN Opt-In: Daily'],
        variables: {
          business_type: 'E-Commerce Brand',
          monthly_ad_spend: '$25,000 - $50,000',
          preferred_session: 'Thursday 2PM EST',
          lead_score: 92,
          decision_maker: true,
          heard_from: 'Meta Instagram Story Ad',
        },
        customFields: {
          business_type: 'E-Commerce Brand',
          monthly_ad_spend: '$25,000 - $50,000',
          preferred_session: 'Thursday 2PM EST',
          lead_score: 92,
          decision_maker: true,
          heard_from: 'Meta Instagram Story Ad',
        },
        meta: {
          psid: '9182749182390182',
          locale: 'en_US',
          timezone: -5,
          gender: 'female',
          adId: '120208940192019',
          adTitle: '(Ad) Build-A-Bot VIP Workshop Invite',
          adSource: 'ADS',
          adSetId: 'adset_retargeting_v4',
          campaignId: 'camp_q3_scaling_scale',
          referralRef: 'bab_vip_ad_v2',
        },
        notes: 'Came through Meta Click-to-Messenger Ad. Registered for live webinar in step 3 of bot flow. Captured verified business email & mobile.',
        createdAt: new Date(now.getTime() - 3 * 3600 * 1000).toISOString(),
        lastInteractionAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
      },
      {
        id: 'meta_ig_48102948190',
        name: 'Marcus Reed',
        firstName: 'Marcus',
        lastName: 'Reed',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        channel: 'instagram',
        email: 'marcus@reedaesthetics.com',
        phone: '+1 (555) 891-2304',
        company: 'Reed Aesthetics Agency',
        jobTitle: 'Founder & CEO',
        city: 'Los Angeles',
        state: 'CA',
        country: 'United States',
        zipCode: '90028',
        status: 'customer',
        optInStatus: 'opted_in',
        smsConsent: true,
        emailConsent: true,
        messagingWindowExpiresAt: windowActive,
        tags: ['High Intent Prospect', 'Instagram DM Lead', 'Agency Owner'],
        variables: {
          agency_clients: '18 Active Accounts',
          crm_platform: 'ActiveCampaign',
          white_label_interested: true,
          budget_tier: 'Enterprise $997/mo',
          lead_score: 98,
        },
        customFields: {
          agency_clients: '18 Active Accounts',
          crm_platform: 'ActiveCampaign',
          white_label_interested: true,
          budget_tier: 'Enterprise $997/mo',
          lead_score: 98,
        },
        meta: {
          igsid: '17841402948190182',
          locale: 'en_US',
          timezone: -8,
          adId: '120209938102938',
          adTitle: 'Instagram Story Ad: Chatbot Automation Playbook',
          adSource: 'ADS',
          referralRef: 'ig_story_swipe_v1',
        },
        notes: 'Inbound message from Instagram Story Ad swipe-up. Purchased Pro License. Highly responsive on IG Direct.',
        createdAt: new Date(now.getTime() - 26 * 3600 * 1000).toISOString(),
        lastInteractionAt: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
      },
      {
        id: 'meta_wa_18294019283',
        name: 'Elena Rostova',
        firstName: 'Elena',
        lastName: 'Rostova',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        channel: 'whatsapp',
        email: 'elena.rostova@globalseed.co',
        phone: '+44 7700 900142',
        company: 'GlobalSeed Ventures',
        jobTitle: 'Operations Director',
        city: 'London',
        state: 'Greater London',
        country: 'United Kingdom',
        zipCode: 'EC2A 4NE',
        status: 'subscriber',
        optInStatus: 'opted_in',
        smsConsent: true,
        emailConsent: true,
        messagingWindowExpiresAt: windowActive,
        tags: ['Global WhatsApp Lead', 'Ebook Downloaded'],
        variables: {
          company_size: '35 Employees',
          preferred_channel: 'WhatsApp Business',
          downloaded_asset: 'ChatMize 2026 Playbook PDF',
          lead_score: 76,
        },
        customFields: {
          company_size: '35 Employees',
          preferred_channel: 'WhatsApp Business',
          downloaded_asset: 'ChatMize 2026 Playbook PDF',
          lead_score: 76,
        },
        meta: {
          waId: '447700900142',
          locale: 'en_GB',
          timezone: 0,
          adSource: 'SHORTLINK',
          referralRef: 'wa.me/buildabot',
        },
        notes: 'Opted in via WhatsApp direct click-to-chat shortlink. Downloaded automation guide. Fast responder via WhatsApp.',
        createdAt: new Date(now.getTime() - 48 * 3600 * 1000).toISOString(),
        lastInteractionAt: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
      },
      {
        id: 'meta_fb_38192049182',
        name: 'David Chen',
        firstName: 'David',
        lastName: 'Chen',
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        channel: 'messenger',
        email: 'david@chenenterprises.com',
        phone: '+1 (555) 782-9910',
        company: 'Chen Enterprises',
        jobTitle: 'General Manager',
        city: 'Chicago',
        state: 'IL',
        country: 'United States',
        zipCode: '60601',
        status: 'lead',
        optInStatus: 'opted_in',
        smsConsent: false,
        emailConsent: true,
        messagingWindowExpiresAt: windowExpired,
        humanAgentExpiresAt: new Date(now.getTime() + 4 * 24 * 3600 * 1000).toISOString(),
        recurringTokens: [
          {
            id: 'rn_tok_weekly_promos_9921',
            topic: 'Weekly Automation Playbook & Promos',
            frequency: 'weekly',
            token: 'tkn_rn_fb_wk_992182049182',
            optedInAt: new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString(),
            expiresAt: new Date(now.getTime() + 250 * 24 * 3600 * 1000).toISOString(),
            status: 'active',
          }
        ],
        otnTokens: [
          {
            id: 'otn_tok_flash_sale_4821',
            topic: 'Summer Flash Sale Early Access',
            token: 'tkn_otn_38192049182_sale',
            optedInAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString(),
            status: 'available',
          }
        ],
        tags: ['Cart Abandoner', 'Discount Requested', 'RN Opt-In: Weekly'],
        variables: {
          last_viewed_package: 'Agency Tier',
          coupon_attempted: 'SUMMER20',
          cart_value: 497,
          lead_score: 65,
        },
        customFields: {
          last_viewed_package: 'Agency Tier',
          coupon_attempted: 'SUMMER20',
          cart_value: 497,
          lead_score: 65,
        },
        meta: {
          psid: '3819204918203912',
          locale: 'en_US',
          timezone: -6,
          adSource: 'PAGE_POST',
          referralRef: 'organic_fb_post_892',
        },
        notes: 'Commented on Facebook organic post. Bot automatically initiated DM via Comment-to-Message automation.',
        createdAt: new Date(now.getTime() - 72 * 3600 * 1000).toISOString(),
        lastInteractionAt: new Date(now.getTime() - 30 * 3600 * 1000).toISOString(),
      }
    ];

    for (const c of sampleContacts) {
      await saveContact(c);
    }
  } catch (err) {
    console.error('Failed to seed initial Meta contacts:', err);
  }
}

// Subscribe to real-time campaigns (capped for the same read-burn reason
// as contacts: every mount re-reads the result set)
export function subscribeToCampaigns(
  onUpdate: (campaigns: CampaignRecord[]) => void,
  onError?: (err: Error) => void,
  maxResults = 200
) {
  const campaignsRef = collection(db, 'campaigns');
  const q = query(campaignsRef, orderBy('createdAt', 'desc'), limit(maxResults));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: CampaignRecord[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...(doc.data() as Omit<CampaignRecord, 'id'>) });
      });
      onUpdate(items);
    },
    (err) => {
      console.error('Error listening to campaigns:', err);
      if (onError) onError(err);
    }
  );
}

// Save or update campaign
export async function saveCampaign(campaign: CampaignRecord): Promise<void> {
  const campaignRef = doc(db, 'campaigns', campaign.id);
  const data = { ...campaign };
  delete (data as any).id;
  // Strip undefined values (Firestore rejects them)
  const clean = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(clean);
    if (obj && typeof obj === 'object') {
      return Object.fromEntries(
        Object.entries(obj)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, clean(v)])
      );
    }
    return obj;
  };
  await setDoc(campaignRef, clean(data), { merge: true });
}

// Delete campaign
export async function deleteCampaign(campaignId: string): Promise<void> {
  const campaignRef = doc(db, 'campaigns', campaignId);
  await deleteDoc(campaignRef);
}

// Enroll a contact into a drip campaign
export async function enrollContactInCampaign(contactId: string, campaignId: string): Promise<void> {
  const contactRef = doc(db, 'contacts', contactId);
  await setDoc(
    contactRef,
    {
      enrolledCampaigns: arrayUnion(campaignId),
      lastInteractionAt: new Date().toISOString()
    },
    { merge: true }
  );
}

// Seed initial campaigns
// DEMO ONLY: no-ops unless VITE_ENABLE_DEMO_SEED=true.
export async function seedInitialCampaigns(): Promise<void> {
  if (!isDemoSeedEnabled()) {
    return;
  }
  try {
    const demoCampaigns: CampaignRecord[] = [
      {
        id: 'camp_rn_weekly_vip',
        name: 'Weekly VIP Drops & Feature Playbook',
        description: 'Auto-delivers every Monday at 10 AM using Meta Recurring Notifications token with built-in 7-day rate-limiting protection.',
        type: 'recurring',
        channel: 'all',
        status: 'active',
        rnTopic: 'Weekly Automation Playbook & Promos',
        rnCadence: 'weekly',
        enforceRateLimitShield: true,
        messageText: '🔥 Hey {{first_name}}! Here is this week\'s curated automation breakdown & exclusive VIP access code: Use VIP30 for 30% OFF!\n\nReply with "DEMO" to test live.',
        ctaTitle: 'Claim 30% Off VIP Pass',
        ctaUrl: 'https://chatmize.io/vip-offer',
        stats: {
          targetAudienceCount: 38,
          deliveredCount: 38,
          openedCount: 36,
          clickedCount: 22,
          optOutCount: 0,
          lastDispatchedAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
        },
        createdAt: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'camp_date_black_friday',
        name: 'Summer AI Summit Live Keynote Launch',
        description: 'Scheduled multi-channel product launch broadcast for July 15, 2026 at 11:00 AM EST.',
        type: 'date_specific',
        channel: 'all',
        status: 'scheduled',
        scheduledDate: '2026-07-15',
        scheduledTime: '11:00',
        timeZone: 'America/New_York',
        messageText: '🚀 {{first_name}}, the Summer AI Summit is officially streaming live right now! Join thousands of builders in the main room 👇',
        mediaUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&auto=format&fit=crop&q=80',
        ctaTitle: 'Join Live Stream 🔴',
        ctaUrl: 'https://chatmize.io/live-summit',
        stats: {
          targetAudienceCount: 52,
          deliveredCount: 0,
          openedCount: 0,
          clickedCount: 0,
          optOutCount: 0,
        },
        createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'camp_drip_onboarding',
        name: '7-Day High-Ticket Lead Nurture Drip',
        description: 'Automated 4-step sequence triggered when a contact receives the "High Intent Prospect" tag.',
        type: 'drip',
        channel: 'messenger',
        status: 'active',
        triggerOnTag: 'High Intent Prospect',
        dripSteps: [
          {
            id: 'step_1',
            stepNumber: 1,
            delayValue: 0,
            delayUnit: 'minutes',
            title: 'Immediate VIP Welcome & Case Study',
            messageText: 'Welcome {{first_name}}! Here is the case study on how we generated 12,000 qualified Meta leads in 30 days.',
            ctaTitle: 'Read Case Study 📄',
            ctaUrl: 'https://chatmize.io/case-study'
          },
          {
            id: 'step_2',
            stepNumber: 2,
            delayValue: 2,
            delayUnit: 'days',
            title: '48-Hour Check-in: Strategy Assessment',
            messageText: 'Hey {{first_name}}, have you had a chance to look over the case study? Want to audit your current bot architecture?',
            ctaTitle: 'Book 1-on-1 Audit 🗓️',
            ctaUrl: 'https://chatmize.io/audit'
          },
          {
            id: 'step_3',
            stepNumber: 3,
            delayValue: 5,
            delayUnit: 'days',
            title: 'RN Opt-In Renewal & Secret VIP Drop',
            messageText: '{{first_name}}, want us to keep sending you exclusive weekly flash sales and AI bot templates?',
            rnTopicRequired: 'Weekly Automation Playbook & Promos',
            ctaTitle: 'Opt-In to Weekly Drops 🔔',
            ctaUrl: 'https://chatmize.io/optin'
          }
        ],
        stats: {
          targetAudienceCount: 24,
          deliveredCount: 22,
          openedCount: 21,
          clickedCount: 16,
          optOutCount: 0,
        },
        createdAt: new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ];

    for (const c of demoCampaigns) {
      await saveCampaign(c);
    }
  } catch (err) {
    console.error('Failed to seed demo campaigns:', err);
  }
}
