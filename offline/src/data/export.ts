import { strToU8, zipSync } from "fflate";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { listBadges, listGallery, listProfiles, listProgress } from "./store";

/**
 * Local data export + sharing for the offline app.
 *
 * The app is fully on-device (IndexedDB, no server). This bundles every
 * profile's activity — progress, badges, and gallery creations (images decoded
 * to real files) — into a single zip and hands it to the OS share sheet, so a
 * parent can send the usage data to a chat like Discord. Nothing leaves the
 * device unless the user picks a share target.
 */

export type ShareResult = "shared" | "empty" | "canceled";

/** Decode a `data:` URL into raw bytes + a file extension, or null if malformed. */
function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; ext: string } | null {
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || comma === -1) return null;

  const header = dataUrl.slice(5, comma);
  const payload = dataUrl.slice(comma + 1);
  const mime = header.split(";")[0] || "application/octet-stream";
  const ext = mime.split("/")[1]?.split("+")[0] || "bin";

  let bytes: Uint8Array;
  if (header.includes(";base64")) {
    const binary = atob(payload);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  } else {
    bytes = strToU8(decodeURIComponent(payload));
  }
  return { bytes, ext };
}

/** Base64-encode bytes in chunks (avoids arg-count limits on large arrays). */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Filename-safe local timestamp, e.g. 20260622-1830. */
function timestamp(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`
  );
}

/** Build a zip of all on-device data; null when there is nothing to export. */
async function buildExportZip(): Promise<Uint8Array | null> {
  const profiles = await listProfiles();
  if (profiles.length === 0) return null;

  const files: Record<string, Uint8Array> = {};

  const exportedProfiles = await Promise.all(
    profiles.map(async (profile) => {
      const [progress, badges, gallery] = await Promise.all([
        listProgress(profile.id),
        listBadges(profile.id),
        listGallery(profile.id),
      ]);

      const galleryMeta = gallery.map((item) => {
        const decoded = dataUrlToBytes(item.imageDataUrl);
        let image: string | undefined;
        if (decoded) {
          image = `images/${item.id}.${decoded.ext}`;
          files[image] = decoded.bytes;
        }
        return {
          id: item.id,
          questId: item.questId,
          missionId: item.missionId,
          caption: item.caption,
          createdAt: item.createdAt,
          image,
        };
      });

      return { ...profile, progress, badges, gallery: galleryMeta };
    }),
  );

  const manifest = {
    app: "Katalis",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    platform: Capacitor.getPlatform(),
    profileCount: exportedProfiles.length,
    profiles: exportedProfiles,
  };
  files["katalis-data.json"] = strToU8(JSON.stringify(manifest, null, 2));

  return zipSync(files, { level: 6 });
}

/** True when a thrown share error is just a user cancellation, not a failure. */
function isCancel(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, message } = error as { name?: string; message?: string };
  if (name === "AbortError") return true;
  return typeof message === "string" && /cancel/i.test(message);
}

/**
 * Bundle all on-device data into a zip and share it via the OS share sheet.
 * Returns "empty" when there is no data, "canceled" when the user dismisses the
 * share sheet, and "shared" otherwise. Throws only on a real failure.
 */
export async function shareAppData(): Promise<ShareResult> {
  const zip = await buildExportZip();
  if (!zip) return "empty";

  const filename = `katalis-data-${timestamp()}.zip`;
  const title = "Katalis data";
  const text = "Katalis app data export";

  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({
      path: filename,
      data: bytesToBase64(zip),
      directory: Directory.Cache,
    });
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
    try {
      await Share.share({ title, text, files: [uri] });
    } catch (error) {
      if (isCancel(error)) return "canceled";
      throw error;
    }
    return "shared";
  }

  // Web (dev/browser): prefer the Web Share API with the file, else download.
  const file = new File([new Uint8Array(zip)], filename, { type: "application/zip" });
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return "shared";
    } catch (error) {
      if (isCancel(error)) return "canceled";
      throw error;
    }
  }

  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return "shared";
}
