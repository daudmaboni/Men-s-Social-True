"use client";

// Kito's face (Step 67): the waving robot, in Kayani green. Small sizes use the lighter file.

export default function KitoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={size > 48 ? "/brand/kito-192.png" : "/brand/kito-96.png"}
      alt=""
      aria-hidden
      width={size}
      height={size}
      draggable={false}
      className={`shrink-0 select-none rounded-full bg-[#f8f5ec] ring-1 ring-forest/25 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
