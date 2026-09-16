import React from 'react';

export function ChatMizeLogo({ className = '' }: { className?: string }) {
  return (
    <img
      src="/chatmize-head.png"
      alt="ChatMize"
      className={className}
      draggable={false}
    />
  );
}
