"use client";

import { useParams } from "next/navigation";
import ContentDetail from "@/components/social/ContentDetail";

export default function SocialContentPage() {
  const { id } = useParams<{ id: string }>();
  return <ContentDetail id={id} back={{ href: "/social", label: "Discover" }} />;
}
