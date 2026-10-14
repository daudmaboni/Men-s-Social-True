"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Editor from "@/components/studio/Editor";
import { isPlaceId } from "@/lib/studio/places";
import { TOPICS } from "@/lib/content/library";
import type { TopicId } from "@/lib/content/types";

function EditInner() {
  const params = useSearchParams();
  const id = params.get("id");
  // "Add to <card>" opens a new item already set up for that card; ?copy= duplicates an item
  const place = params.get("place");
  const topic = params.get("topic");
  const copy = params.get("copy");
  const preset = {
    place: isPlaceId(place) ? place : null,
    topic: TOPICS.some((t) => t.id === topic) ? (topic as TopicId) : null,
  };
  return <Editor key={id ?? `new-${place}-${topic}-${copy}`} id={id} preset={preset} copyOf={copy} />;
}

export default function EditPage() {
  return (
    <Suspense>
      <EditInner />
    </Suspense>
  );
}
