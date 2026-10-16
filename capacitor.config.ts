// The Android app (Step 57). It's a thin native shell around the live website, so the app is always the
// latest version without a Play Store update; the native part adds what a website can't do (sleep detection).
// Set the address of your live site once: CAP_SERVER_URL=https://your-site.vercel.app npx cap sync android

import type { CapacitorConfig } from "@capacitor/cli";

const url = process.env.CAP_SERVER_URL || "https://menssocial.netlify.app";

const config: CapacitorConfig = {
  appId: "tz.kayani.menssocial",
  appName: "Men's Social",
  // Shown only if the site can't load (no internet on first open)
  webDir: "capacitor/www",
  server: {
    url,
    cleartext: false,
    // Pages of the live site open inside the app; anything else opens in the browser
    allowNavigation: [new URL(url).host],
  },
  android: {
    backgroundColor: "#f5f0e6",
  },
};

export default config;
