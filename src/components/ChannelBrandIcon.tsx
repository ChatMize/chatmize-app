import React from 'react';

export type BrandChannel = 'messenger' | 'instagram' | 'whatsapp' | 'web' | string;

interface ChannelBrandIconProps {
  channel: BrandChannel;
  className?: string;
  title?: string;
}

/**
 * Real channel brand icons (no generic placeholders).
 * Messenger / Instagram / WhatsApp are inline SVGs in official brand colors;
 * webchat renders the ChatMize head logo served from /chatmize-head.png.
 */
export const ChannelBrandIcon: React.FC<ChannelBrandIconProps> = ({
  channel,
  className = 'w-3.5 h-3.5',
  title,
}) => {
  const c = (channel || '').toLowerCase();

  if (c === 'web') {
    return (
      <img
        src="/chatmize-head.png"
        alt={title || 'Webchat'}
        title={title || 'Webchat'}
        className={`${className} rounded-full object-cover`}
      />
    );
  }

  if (c === 'messenger') {
    return (
      <svg viewBox="0 0 48 48" className={className} role="img" aria-label={title || 'Messenger'}>
        {title ? <title>{title}</title> : null}
        <defs>
          <linearGradient id="cm-msg-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#00B2FF" />
            <stop offset="55%" stopColor="#A033FF" />
            <stop offset="100%" stopColor="#FF5280" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="22" fill="url(#cm-msg-grad)" />
        <path
          d="M25.6 11c-7.6 0-13.1 5-13.1 11.2 0 3.5 1.9 6.6 4.9 8.7-.2 1.2-1.2 4.6-4.5 6.1 3.4.3 5.9-1.3 7-2.5 1.3.3 2.7.4 4.1.4 7.6 0 13.1-5 13.1-11.2S33.2 11 25.6 11z"
          fill="#fff"
          opacity="0.98"
        />
        <path
          d="M27.5 17.5l-6.6 7.4c-.4.4-.4 1 0 1.3l1.4 1.2c.3.3.8.3 1.1 0l1.9-2.1.5 4.9c.1.5.6.8 1 .6l1.8-.9c.4-.2.5-.7.3-1.1l-4.6-9.9c-.3-.6-1-.8-1.4-.4z"
          fill="url(#cm-msg-grad)"
        />
      </svg>
    );
  }

  if (c === 'instagram') {
    return (
      <svg viewBox="0 0 48 48" className={className} role="img" aria-label={title || 'Instagram'}>
        {title ? <title>{title}</title> : null}
        <defs>
          <linearGradient id="cm-ig-grad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#FEDA75" />
            <stop offset="35%" stopColor="#FA7E1E" />
            <stop offset="60%" stopColor="#D62976" />
            <stop offset="80%" stopColor="#962FBF" />
            <stop offset="100%" stopColor="#4F5BD5" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="40" height="40" rx="11" fill="url(#cm-ig-grad)" />
        <rect x="13" y="13" width="22" height="22" rx="6" fill="none" stroke="#fff" strokeWidth="3" />
        <circle cx="24" cy="24" r="5.5" fill="none" stroke="#fff" strokeWidth="3" />
        <circle cx="31" cy="17" r="2.2" fill="#fff" />
      </svg>
    );
  }

  if (c === 'whatsapp') {
    return (
      <svg viewBox="0 0 48 48" className={className} role="img" aria-label={title || 'WhatsApp'}>
        {title ? <title>{title}</title> : null}
        <circle cx="24" cy="24" r="22" fill="#25D366" />
        <path
          d="M24 10.5c-7.5 0-13.5 6-13.5 13.5 0 2.5.7 4.9 2 6.9L10.7 37l6.3-1.7c2 .9 4.1 1.4 7 1.4 7.5 0 13.5-6 13.5-13.5S31.5 10.5 24 10.5z"
          fill="#fff"
        />
        <path
          d="M20.3 16.2c-.4 0-1 .1-1.5.7-.5.6-1.9 1.9-1.9 4.6s2 5.3 2.2 5.7c.3.4 3.7 5.9 9.2 7.9 4.6 1.7 5.5 1.4 6.5 1.3 1-.1 3.2-1.3 3.7-2.6.4-1.3.4-2.4.3-2.6-.1-.2-.4-.4-.9-.6l-4.3-2.1c-.5-.2-.8-.3-1.1 0l-2 2.4c-.4.4-.7.5-1.1.3-1.7-.7-3.4-2.3-4.5-3.9-.4-.6-.8-1.3-.3-2.1.4-.7 1-1.8 1.4-2.4.4-.6.5-1 .3-1.5l-1.9-4.5c-.4-.9-.8-.8-1.1-.8h-.7z"
          fill="#25D366"
        />
      </svg>
    );
  }

  // Unknown channel: neutral chat glyph (never a brand placeholder).
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label={title || 'Chat'}>
      {title ? <title>{title}</title> : null}
      <circle cx="24" cy="24" r="22" fill="#0ea5e9" />
      <path
        d="M14 18h20v12H24l-6 5v-5h-4V18z"
        fill="#fff"
      />
    </svg>
  );
};

export default ChannelBrandIcon;
