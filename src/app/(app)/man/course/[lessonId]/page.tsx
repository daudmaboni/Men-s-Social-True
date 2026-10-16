"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import LessonPage from "@/components/course/LessonPage";
import MembersOnly from "@/components/course/MembersOnly";

export default function Page() {
  const { lessonId } = useParams<{ lessonId: string }>();
  return (
    <MembersOnly>
      <Suspense fallback={<div className="h-72 animate-pulse rounded-[28px] bg-forest-deep/15" />}>
        <LessonPage id={lessonId} />
      </Suspense>
    </MembersOnly>
  );
}
