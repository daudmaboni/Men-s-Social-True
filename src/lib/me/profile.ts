// His basic profile: name (kept as `nickname` in the Social data), photo, age range and region.
// All optional, private to him, saved on the phone and in his account. Nothing here is shown to other men
// except his name (and only when he posts without "anonymous").

export interface Profile {
  /** Small square JPEG as a data URL (resized on the phone, ~20 KB). */
  photo?: string;
  ageRange?: AgeRange;
  region?: string;
  /** When he last changed it — the newest version wins when phone and account differ. */
  updatedAt?: string;
}

export const AGE_RANGES = ["18–24", "25–34", "35–44", "45–54", "55+"] as const;
export type AgeRange = (typeof AGE_RANGES)[number];

/** Tanzania's regions, plus a choice for men elsewhere. */
export const REGIONS = [
  "Arusha", "Dar es Salaam", "Dodoma", "Geita", "Iringa", "Kagera", "Katavi", "Kigoma", "Kilimanjaro", "Lindi",
  "Manyara", "Mara", "Mbeya", "Morogoro", "Mtwara", "Mwanza", "Njombe", "Pemba North", "Pemba South", "Pwani",
  "Rukwa", "Ruvuma", "Shinyanga", "Simiyu", "Singida", "Songwe", "Tabora", "Tanga", "Unguja North",
  "Unguja South", "Mjini Magharibi", "Outside Tanzania",
] as const;

export const NAME_MAX = 24;

/** Problem with a name, or null if it's fine. Names are shown in Community, so no contact details. */
export function nameProblem(name: string): string | null {
  const n = name.trim();
  if (/\d{6,}|@|https?:|www\./i.test(n)) return "Please don't use phone numbers, emails or links.";
  if (n.length > NAME_MAX) return "Keep it under 24 letters.";
  return null;
}

/** Keeps only known values, so bad or old data never breaks the screen. */
export function cleanProfile(v: unknown): Profile {
  if (!v || typeof v !== "object") return {};
  const p = v as Record<string, unknown>;
  const out: Profile = {};
  if (typeof p.photo === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(p.photo) && p.photo.length < 400_000) out.photo = p.photo;
  if (AGE_RANGES.includes(p.ageRange as AgeRange)) out.ageRange = p.ageRange as AgeRange;
  if (typeof p.region === "string" && (REGIONS as readonly string[]).includes(p.region)) out.region = p.region;
  if (typeof p.updatedAt === "string") out.updatedAt = p.updatedAt;
  return out;
}

/** Phone and account both have a profile: keep the one he changed last. */
export function newestProfile(local: Profile, remote: Profile): Profile {
  if (!remote.updatedAt) return local;
  if (!local.updatedAt) return remote;
  return local.updatedAt >= remote.updatedAt ? local : remote;
}

/** Initials for the round picture when he hasn't added a photo. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Turns a chosen photo into a small square JPEG (centre-cropped), so it saves fast and stays light. */
export async function photoToDataUrl(file: File, size = 320): Promise<string> {
  if (!/^image\//.test(file.type)) throw new Error("Choose a photo (JPG, PNG or WebP).");
  if (file.size > 15 * 1024 * 1024) throw new Error("That photo is too large. Choose one under 15 MB.");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Couldn't open that photo. Try another one.");
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't prepare the photo on this phone.");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}
