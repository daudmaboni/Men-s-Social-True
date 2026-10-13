"use client";

import StudioGate from "@/components/studio/StudioGate";
import ContentList from "@/components/studio/ContentList";

export default function StudioPage() {
  return <StudioGate>{() => <ContentList />}</StudioGate>;
}
