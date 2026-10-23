"use client";

// A photo that costs men little data (Step 85): a phone-sized copy from Netlify's image service,
// loaded only when he scrolls near it, decoded off the main thread, and smaller still with Data Saver.
// Use it instead of a plain <img> for card, reel and article photos.

import { useEffect, useMemo, useState } from "react";
import { cdnOn, imgProps, lowData } from "@/lib/media/image";

export default function Photo({
  src,
  alt = "",
  className,
  fullWidth = true,
  eager = false,
}: {
  src: string | undefined;
  alt?: string;
  className?: string;
  /** Spans the phone screen (cards, reels). False for small thumbnails. */
  fullWidth?: boolean;
  /** The first photo on screen: load it straight away. */
  eager?: boolean;
}) {
  // Data Saver is only known on the phone: checked after the first draw, then the smaller copies are offered
  const [low, setLow] = useState(false);
  useEffect(() => setLow(lowData()), []);
  const props = useMemo(() => imgProps(src, { fullWidth, low, on: cdnOn() }), [src, fullWidth, low]);
  if (!props.src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={eager ? "high" : "low"}
      className={className}
    />
  );
}
