"use client";

import { useEffect, useState } from "react";

/** Counts a number up from 0 when it appears, like Fernly's stat cards. */
export default function CountUp({
  to,
  duration = 900,
  delay = 0,
}: {
  to: number;
  duration?: number;
  delay?: number;
}) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    let start: number | null = null;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // fast start, soft landing

    const tick = (now: number) => {
      if (start === null) start = now + delay;
      const t = Math.min(Math.max((now - start) / duration, 0), 1);
      setValue(Math.round(ease(t) * to));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, duration, delay]);

  return <span className="tabular-nums">{value}</span>;
}
