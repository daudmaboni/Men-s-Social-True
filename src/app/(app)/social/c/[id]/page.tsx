// Step 89: this page opens instantly. Its screen is the same for every id (the content is filled in on the
// phone), so it's built once and served from the CDN instead of waiting for a server on every tap.
// Every built-in card and article is built ahead; any other id is built the first time someone opens it, then kept.
import { LIBRARY } from "@/lib/content/library";
import View from "./view";

export const dynamicParams = true;

export function generateStaticParams() {
  return LIBRARY.map((c) => ({ id: c.id }));
}

export default function Page() {
  return <View />;
}
