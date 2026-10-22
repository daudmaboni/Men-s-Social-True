import { redirect } from "next/navigation";

// The old Homepage editor (Featured insight, For you, Explore topics…) is gone: men's Discover is now
// reels + "do this" cards. Step 71 moved this to Studio → Discover.
export default function OldHomepagePreview() {
  redirect("/studio/discover");
}
