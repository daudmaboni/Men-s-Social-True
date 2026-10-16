// The Kayani logo (the K in its ring, on Kayani Green). Used wherever the app shows its badge.
// Brand system "Kayani": use the green square as the app's mark; never recolour or stretch it.

import Image from "next/image";

export default function BrandMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/kayani-logo.png"
      alt="Kayani"
      width={size}
      height={size}
      priority
      className={`shrink-0 rounded-xl ${className}`}
    />
  );
}
