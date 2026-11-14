import React from 'react';

interface BrandLogoProps {
  compact?: boolean;
  onClick?: () => void;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ compact = false, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-md px-1 py-0.5 shrink-0 cursor-pointer"
      aria-label="PHYSIX LAB Home"
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden="true"
      >
        <rect width="64" height="64" rx="12" fill="#0B1220" stroke="#1E293B" strokeWidth="2.5" />
        <ellipse
          cx="32"
          cy="32"
          rx="21"
          ry="8.5"
          transform="rotate(-32 32 32)"
          stroke="#06B6D4"
          strokeWidth="2.8"
        />
        <ellipse
          cx="32"
          cy="32"
          rx="21"
          ry="8.5"
          transform="rotate(32 32 32)"
          stroke="#3B82F6"
          strokeWidth="2.8"
        />
        <circle cx="32" cy="32" r="4.8" fill="#F8FAFC" />
        <circle cx="48" cy="21" r="2.75" fill="#06B6D4" />
        <circle cx="16" cy="43" r="2.75" fill="#3B82F6" />
      </svg>
      {!compact && (
        <span className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap">
          PHYSIX <span className="text-cyan-400">LAB</span>
        </span>
      )}
    </button>
  );
};
