// Step 89: this page opens instantly. Its screen is the same for every lessonId (the content is filled in on the
// phone), so it's built once and served from the CDN instead of waiting for a server on every tap.
// Every lesson of the course is built ahead; any other lessonId is built the first time someone opens it, then kept.
import { WAZIMU_OUTLINE } from "@/lib/course/wazimu";
import View from "./view";

export const dynamicParams = true;

export function generateStaticParams() {
  return WAZIMU_OUTLINE.modules.flatMap((m) => m.lessons.map((l) => ({ lessonId: l.id })));
}

export default function Page() {
  return <View />;
}
