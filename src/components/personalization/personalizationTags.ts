/**
 * Canonical personalization tag list for the frontend picker.
 * Mirrors PERSONALIZATION_TAGS in functions/src/personalization.ts;
 * keep the two in sync when adding tags.
 */
export interface PersonalizationTag {
  /** The tag as typed, without braces, e.g. "first_name". */
  tag: string;
  /** Human readable label shown in the picker. */
  label: string;
  /** Short hint shown under the label in the picker. */
  hint: string;
}

export const PERSONALIZATION_TAGS: PersonalizationTag[] = [
  { tag: 'first_name', label: 'First name', hint: 'Contact first name' },
  { tag: 'last_name', label: 'Last name', hint: 'Contact last name' },
  { tag: 'full_name', label: 'Full name', hint: 'Contact full name' },
  { tag: 'email', label: 'Email', hint: 'Contact email address' },
  { tag: 'phone', label: 'Phone', hint: 'Contact phone number' },
  { tag: 'company', label: 'Company', hint: 'Contact company' },
  { tag: 'job_title', label: 'Job title', hint: 'Contact job title' },
  { tag: 'city', label: 'City', hint: 'Contact city' },
  { tag: 'state', label: 'State', hint: 'Contact state' },
  { tag: 'country', label: 'Country', hint: 'Contact country' },
  { tag: 'zip_code', label: 'ZIP code', hint: 'Contact ZIP or postal code' },
  { tag: 'booking_event', label: 'Booking event', hint: 'Name of the latest booking event' },
  { tag: 'booking_date', label: 'Booking date', hint: 'Date of the latest booking' },
  { tag: 'booking_time', label: 'Booking time', hint: 'Time of the latest booking' },
  { tag: 'booking_status', label: 'Booking status', hint: 'Status of the latest booking' },
];

/** Wrap a tag name in the {{ }} syntax the send paths resolve. */
export function tagSyntax(tag: string): string {
  return `{{${tag}}}`;
}
