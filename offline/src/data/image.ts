/**
 * Browser image helpers for the offline build. Used to capture and shrink
 * photos before sending them to Gemini — keeps the multimodal upload small and
 * fast (and cheap on a usage-capped key).
 */

/** Read a File into a data URL. */
export function fileToDataUrl(file: File): Promise<string> {
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
  reader.readAsDataURL(file);
  return promise;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const { promise, resolve, reject } = Promise.withResolvers<HTMLImageElement>();
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error("Image decode failed"));
  img.src = src;
  return promise;
}

/**
 * Downscale a data URL so its longest side is at most `maxDim`, re-encoded as
 * JPEG. Returns the original URL unchanged if it's already small enough or if
 * canvas is unavailable. Safe for AI upload payloads.
 */
export async function downscaleDataUrl(dataUrl: string, maxDim = 1024, quality = 0.82): Promise<string> {
  const img = await loadImage(dataUrl);
  const longest = Math.max(img.width, img.height);
  if (longest <= maxDim) return dataUrl;

  const scale = maxDim / longest;
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}
