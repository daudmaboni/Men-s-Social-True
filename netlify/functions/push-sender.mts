// Phone notifications (Step 79): Netlify runs this every 15 minutes on the live site.
// It needs these settings in Netlify → Project configuration → Environment variables:
//   NEXT_PUBLIC_SUPABASE_URL       (already there)
//   SUPABASE_SERVICE_ROLE_KEY      Supabase → Project Settings → API keys → service_role (secret, server only)
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY   from `npx web-push generate-vapid-keys`
//   VAPID_PRIVATE_KEY              the private half (secret, server only)
//   VAPID_SUBJECT                  mailto: an address the push services can reach, e.g. mailto:hello@kayaniherbs.co.tz
// Without them it does nothing (and says so in the function log).

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { sendDue, type DueRow } from "../../src/lib/push/sender.ts";

export const config = { schedule: "*/15 * * * *" };

export default async function handler() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:hello@example.com";
  if (!url || !service || !pub || !priv) {
    console.log("push-sender: not set up yet (Supabase service key or VAPID keys missing)");
    return new Response("not configured", { status: 200 });
  }
  webpush.setVapidDetails(subject, pub, priv);
  const sb = createClient(url, service, { auth: { persistSession: false } });
  const result = await sendDue(
    {
      async due() {
        const { data, error } = await sb.rpc("push_due");
        if (error) throw new Error(error.message);
        return (data ?? []) as DueRow[];
      },
      async mark(sent, failed) {
        const { error } = await sb.rpc("push_mark", { p_sent: sent, p_failed: failed });
        if (error) throw new Error(error.message);
      },
    },
    (sub, payload, opts) => webpush.sendNotification(sub, payload, opts),
  );
  console.log("push-sender:", JSON.stringify(result));
  return new Response(JSON.stringify(result), { status: 200, headers: { "content-type": "application/json" } });
}
