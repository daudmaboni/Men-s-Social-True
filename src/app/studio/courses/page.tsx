"use client";

import CourseBuilder from "@/components/studio/CourseBuilder";
import { useStudio } from "@/components/admin/AdminShell";

export default function CoursesPage() {
  const { can } = useStudio();
  return <CourseBuilder can={can} />;
}
