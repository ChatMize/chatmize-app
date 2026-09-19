import { getFirestore } from "firebase-admin/firestore";

/**
 * Personalization (merge tag) support.
 *
 * Tag syntax is {{tag_name}} (double curly braces), matching the tags users
 * already type in the app. Every send path resolves tags against the
 * recipient's contact record at send time.
 *
 * Fallback rule: a tag whose contact field is empty or unknown resolves to
 * an empty string. Raw tag text is never sent to a contact.
 */

export interface PersonalizationContact {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  variables?: Record<string, string | number | boolean>;
  customFields?: Record<string, string | number | boolean>;
}

export interface PersonalizationTag {
  /** The tag as typed, without braces, e.g. "first_name". */
  tag: string;
  /** Human readable label shown in the picker. */
  label: string;
  /** Short hint shown under the label in the picker. */
  hint: string;
}

/**
 * Canonical tag list. The frontend picker
 * (src/components/personalization/personalizationTags.ts) mirrors this list;
 * keep the two in sync when adding tags.
 */
export const PERSONALIZATION_TAGS: PersonalizationTag[] = [
  { tag: "first_name", label: "First name", hint: "Contact first name" },
  { tag: "last_name", label: "Last name", hint: "Contact last name" },
  { tag: "full_name", label: "Full name", hint: "Contact full name" },
  { tag: "email", label: "Email", hint: "Contact email address" },
  { tag: "phone", label: "Phone", hint: "Contact phone number" },
  { tag: "company", label: "Company", hint: "Contact company" },
  { tag: "job_title", label: "Job title", hint: "Contact job title" },
  { tag: "city", label: "City", hint: "Contact city" },
  { tag: "state", label: "State", hint: "Contact state" },
  { tag: "country", label: "Country", hint: "Contact country" },
  { tag: "zip_code", label: "ZIP code", hint: "Contact ZIP or postal code" },
  { tag: "booking_event", label: "Booking event", hint: "Name of the latest booking event" },
  { tag: "booking_date", label: "Booking date", hint: "Date of the latest booking" },
  { tag: "booking_time", label: "Booking time", hint: "Time of the latest booking" },
  { tag: "booking_status", label: "Booking status", hint: "Status of the latest booking" },
];

const db = () => getFirestore("chatmize-prod");

function str(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v);
}

function firstWord(name?: string): string {
  if (!name) return "";
  return name.trim().split(/\s+/)[0] ?? "";
}

/** Resolve a single normalized tag name against a contact record. */
function resolveTag(tag: string, contact: PersonalizationContact): string {
  // Allow the documented {{contact.first_name}} dotted form.
  const key = tag.startsWith("contact.") ? tag.slice("contact.".length) : tag;
  switch (key) {
    case "first_name":
      return contact.firstName || firstWord(contact.name);
    case "last_name":
      return contact.lastName || "";
    case "full_name":
    case "name":
      return contact.name || "";
    case "email":
      return contact.email || "";
    case "phone":
      return contact.phone || "";
    case "company":
      return contact.company || "";
    case "job_title":
      return contact.jobTitle || "";
    case "city":
      return contact.city || "";
    case "state":
      return contact.state || "";
    case "country":
      return contact.country || "";
    case "zip":
    case "zip_code":
      return contact.zipCode || "";
    default: {
      // Custom fields and captured flow variables, e.g. {{favorite_color}}
      // or {{cart_total}}. Unknown tags fall through to "".
      const vars = contact.variables ?? {};
      const customs = contact.customFields ?? {};
      if (key in vars) return str(vars[key]);
      if (key in customs) return str(customs[key]);
      return "";
    }
  }
}

const TAG_PATTERN = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;

/**
 * Replace every {{tag}} in text with the contact's value.
 * Empty or unknown tags resolve to "" so raw tag text never goes out.
 */
export function resolvePersonalizationTags(
  text: string,
  contact: PersonalizationContact | null | undefined,
): string {
  if (!text || !text.includes("{{")) return text;
  const c: PersonalizationContact = contact ?? {};
  return text.replace(TAG_PATTERN, (_match, tag: string) => resolveTag(tag, c));
}

/**
 * Load the contact for a Meta channel recipient. Contacts are upserted by
 * the webhook pipeline into the root `contacts` collection with deterministic
 * ids: contact_<channel>_<senderId>.
 */
export async function getContactForRecipient(
  channel: "messenger" | "instagram" | "whatsapp",
  recipientId: string,
): Promise<PersonalizationContact | null> {
  try {
    const snap = await db()
      .collection("contacts")
      .doc(`contact_${channel}_${recipientId}`)
      .get();
    if (!snap.exists) return null;
    return snap.data() as PersonalizationContact;
  } catch {
    // Personalization is best effort: a lookup failure must never block a send.
    return null;
  }
}

/** Load a contact by phone number (SMS path). Returns the first match. */
export async function getContactForPhone(
  e164: string,
): Promise<PersonalizationContact | null> {
  try {
    const snap = await db()
      .collection("contacts")
      .where("phone", "==", e164)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data() as PersonalizationContact;
  } catch {
    return null;
  }
}
