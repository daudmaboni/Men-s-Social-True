"use client";

// Signing out: cover the screen first, then do the sign-out, then load the Welcome page fresh.
// Without the cover, the current page re-draws as "signed out" (e.g. the locked Me tab or the
// Studio log-in) for a moment before the Welcome page appears.

export async function leaveTo(path: string, work: () => Promise<unknown>) {
  try {
    const cover = document.createElement("div");
    cover.className = "leaving-cover";
    cover.setAttribute("aria-hidden", "true");
    document.body.appendChild(cover);
  } catch {}
  try {
    await work();
  } finally {
    // A full page load also clears anything still held in memory from the signed-in session
    window.location.replace(path);
  }
}
