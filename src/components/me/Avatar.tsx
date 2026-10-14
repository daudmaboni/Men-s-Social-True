"use client";

import { User } from "lucide-react";
import { initials } from "@/lib/me/profile";

/** His round profile picture: his photo, or his initials, or a plain person icon. */
export default function Avatar({ name, photo, className = "" }: { name: string; photo?: string; className?: string }) {
  const letters = initials(name);
  return (
    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-mint font-bold text-forest-deep ${className}`}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-full w-full object-cover" />
      ) : letters ? (
        letters
      ) : (
        <User className="h-1/2 w-1/2" aria-hidden />
      )}
    </span>
  );
}
