import React from 'react';

export function ChatMizeLogo({ className = '', showBeta = true }: { className?: string; showBeta?: boolean }) {
  return (
    <span className={`relative inline-block flex-shrink-0 ${className}`}>
      <img
        src="/chatmize-head.png"
        alt="ChatMize"
        className="w-full h-full"
        draggable={false}
      />
      {showBeta && (
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-[0.25em] text-red-500 leading-none select-none">
          beta
        </span>
      )}
    </span>
  );
}
