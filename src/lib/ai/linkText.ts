// Reading a web page for the Card maker: only public https pages, never the server's own network,
// at most 1.5 MB, scripts and styles removed, text only.

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|\[?f[cd][0-9a-f]{2}:)/i;

export function safeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (PRIVATE_HOST.test(u.hostname) || /^\d+$/.test(u.hostname.replace(/\./g, ""))) return null; // no IP addresses
    return u;
  } catch {
    return null;
  }
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n+/g, "\n")
    .trim();
}

export async function pageText(url: URL): Promise<string> {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(12_000), headers: { "user-agent": "Mozilla/5.0 (Men's Social card maker)" } });
  if (!res.ok) throw new Error(`the site answered ${res.status}`);
  const finalUrl = safeUrl(res.url || url.toString());
  if (!finalUrl) throw new Error("it redirected somewhere not allowed");
  const type = res.headers.get("content-type") ?? "";
  if (!/text\/html|text\/plain|application\/xhtml/.test(type)) throw new Error("it isn't a web page");
  const reader = res.body?.getReader();
  if (!reader) return "";
  let html = "";
  const dec = new TextDecoder();
  for (let size = 0; ; ) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    html += dec.decode(value, { stream: true });
    if (size > 1_500_000) break;
  }
  return htmlToText(html).slice(0, 20000);
}
