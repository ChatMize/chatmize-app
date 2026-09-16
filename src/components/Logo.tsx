import React from 'react';

export function ChatMizeLogo({ className = '' }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="20" x2="0" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00d2ff" /> {/* Cyan */}
          <stop offset="1" stopColor="#0066ff" /> {/* Deep Blue */}
        </linearGradient>
      </defs>
      
      {/* Left Antenna */}
      <path d="M 28 35 L 20 18" stroke="url(#logo-gradient)" strokeWidth="8" strokeLinecap="round" />
      <circle cx="17" cy="14" r="8" fill="url(#logo-gradient)" />

      {/* Right Antenna */}
      <path d="M 72 35 L 80 18" stroke="url(#logo-gradient)" strokeWidth="8" strokeLinecap="round" />
      <circle cx="83" cy="14" r="8" fill="url(#logo-gradient)" />

      {/* Main Head */}
      <rect x="12" y="32" width="76" height="60" rx="20" fill="url(#logo-gradient)" />
      {/* Darker Inner Edge / Shadow */}
      <rect x="12" y="32" width="76" height="60" rx="20" fill="none" stroke="#0044aa" strokeWidth="2" opacity="0.4" />

      {/* Left Eye */}
      <circle cx="32" cy="54" r="9" fill="#ffffff" />

      {/* Right Eye */}
      <circle cx="68" cy="54" r="9" fill="#ffffff" />

      {/* Smile (Solid Dark Blue crescent) */}
      <path d="M 30 70 Q 50 90 70 70 Q 50 78 30 70 Z" fill="#004488" />
    </svg>
  );
}
