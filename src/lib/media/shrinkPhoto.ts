// Step 93: a photo straight from the phone, made ready for upload.
// Phone photos are often 4–12 MB; this makes a sharp JPEG about 1600 px on the long side (usually under 500 KB),
// turned the right way up, so it uploads fast and loads fast on men's phones.

const LONG_SIDE = 1600;
const QUALITY = 0.85;
const MAX_INPUT = 25 * 1024 * 1024;
const MAX_UPLOAD = 3 * 1024 * 1024; // what Studio's image upload accepts

/** The size to draw at: never bigger than the photo, long side at most `max`. */
export function fitSize(width: number, height: number, max = LONG_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function shrinkPhoto(file: File): Promise<File> {
  if (file.size > MAX_INPUT) throw new Error("That photo is too large. Choose one under 25 MB.");
  const ok = /^image\/(jpeg|png|webp)$/.test(file.type);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // This browser can't open it (some iPhone HEIC photos): send it as it is if it's already fine
    if (ok && file.size <= MAX_UPLOAD) return file;
    throw new Error("This phone's photo format isn't supported here. Choose a JPG or PNG photo, or take a screenshot of it.");
  }

  // Already small and light: keep the original
  if (ok && file.size <= 600 * 1024 && Math.max(bitmap.width, bitmap.height) <= LONG_SIDE) {
    bitmap.close();
    return file;
  }

  const { width, height } = fitSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't prepare the photo. Try again.");
  ctx.fillStyle = "#fff"; // see-through PNGs get a white background, not black
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", QUALITY));
  if (!blob) throw new Error("Couldn't prepare the photo. Try again.");
  const name = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
}
