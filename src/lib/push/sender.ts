// The push sender (Step 79). Runs on the server every 15 minutes (netlify/functions/push-sender.ts).
// 1. Asks the database what is due (push_due, migration 0017): live Studio messages and daily reminders,
//    already filtered by his choices, quiet hours and "did he open the app today".
// 2. Sends each one to his phones through the push service (web-push, signed with our VAPID key).
//    The text is discreet ("Men's Social" + a neutral line) unless he allowed text on his lock screen.
// 3. Tells the database what went (push_mark), so nothing is sent twice, and drops phones that are gone.
// No message content or health data is stored anywhere along the way.
// Kept free of "@/" imports so the hosting bundler can build it on its own.

export type DueRow = {
  subscription_id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  kind: "campaign" | "reminder";
  ref: string;
  title: string;
  body: string;
  link: string;
};

export type SendFn = (
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  opts: { TTL: number; urgency: "normal" | "low"; topic?: string },
) => Promise<unknown>;

export type Db = {
  due(): Promise<DueRow[]>;
  mark(sent: { subscription_id: string; user_id: string; kind: string; ref: string }[], failed: { subscription_id: string; gone: boolean }[]): Promise<void>;
};

/** What the phone receives (read by public/sw.js). */
export function payloadFor(r: DueRow): string {
  return JSON.stringify({ title: r.title, body: r.body, link: r.link, tag: r.kind === "reminder" ? "ms-reminder" : `ms-${r.ref}` });
}

/** Push services allow a short topic so a newer reminder replaces an older one still waiting. */
const topicFor = (r: DueRow) => (r.kind === "reminder" ? "reminder" : undefined);

export async function sendDue(db: Db, send: SendFn, { batch = 20 }: { batch?: number } = {}) {
  const rows = await db.due();
  const sent: { subscription_id: string; user_id: string; kind: string; ref: string }[] = [];
  const failed: { subscription_id: string; gone: boolean }[] = [];
  for (let i = 0; i < rows.length; i += batch) {
    await Promise.all(
      rows.slice(i, i + batch).map(async (r) => {
        try {
          await send({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, payloadFor(r), {
            TTL: r.kind === "reminder" ? 2 * 3600 : 24 * 3600,
            urgency: r.kind === "reminder" ? "low" : "normal",
            topic: topicFor(r),
          });
          sent.push({ subscription_id: r.subscription_id, user_id: r.user_id, kind: r.kind, ref: r.ref });
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          // 404 / 410: the phone uninstalled the app or turned notifications off → forget that phone
          failed.push({ subscription_id: r.subscription_id, gone: code === 404 || code === 410 });
        }
      }),
    );
  }
  if (sent.length || failed.length) await db.mark(sent, failed);
  return { due: rows.length, sent: sent.length, failed: failed.length };
}
