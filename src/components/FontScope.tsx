"use client";

// The app and the Studio each keep their own font style and text size (Step 66).
// The first page gets it before painting (themeBoot.ts); this keeps it right when he moves between them.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { applyScope } from "@/lib/fonts";

export default function FontScope() {
  const path = usePathname();
  useEffect(() => {
    applyScope(path ?? "/");
  }, [path]);
  return null;
}
