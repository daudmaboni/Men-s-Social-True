"use client";

import CoursePage from "@/components/course/CoursePage";
import MembersOnly from "@/components/course/MembersOnly";

// The course on the Man tab (Step 48). Like the Man tab itself, it needs an account.
export default function Page() {
  return (
    <MembersOnly>
      <CoursePage />
    </MembersOnly>
  );
}
