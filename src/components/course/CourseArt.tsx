import { Headphones } from "lucide-react";

/** Course artwork drawn in the app's colours (follows Green / Blue / Red and dark mode). */
export default function CourseArt({ className = "", icon = true, size = 28 }: { className?: string; icon?: boolean; size?: number }) {
  return (
    <div className={`relative overflow-hidden bg-forest text-mint-strong ${className}`} aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <g fill="none" stroke="currentColor" strokeWidth="7">
          <circle cx="86" cy="18" r="46" opacity="0.18" />
          <circle cx="86" cy="18" r="30" opacity="0.3" />
          <circle cx="86" cy="18" r="14" opacity="0.5" />
        </g>
        <path d="M0 100 C 30 70, 60 92, 100 74 L100 100 Z" fill="currentColor" opacity="0.16" />
      </svg>
      {icon && (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <Headphones size={size} strokeWidth={2.2} />
        </div>
      )}
    </div>
  );
}
