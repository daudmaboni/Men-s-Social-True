"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import StudioGate from "@/components/studio/StudioGate";
import Editor from "@/components/studio/Editor";

function EditInner() {
  const id = useSearchParams().get("id");
  return <StudioGate>{() => <Editor key={id ?? "new"} id={id} />}</StudioGate>;
}

export default function EditPage() {
  return (
    <Suspense>
      <EditInner />
    </Suspense>
  );
}
