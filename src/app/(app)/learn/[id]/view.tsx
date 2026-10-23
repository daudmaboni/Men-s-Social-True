"use client";

import { useParams } from "next/navigation";
import ContentDetail from "@/components/social/ContentDetail";

// Daily lessons opened from the Man tab use the same content page as Discover.
export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  return <ContentDetail id={id} back={{ href: "/man", label: "Man" }} />;
}
