import { wisFetch } from "@/lib/api/wisFetch";

/** Mirrors src/lib/storage/config.ts (server-only). */
export const MEDIA_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MEDIA_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const MEDIA_ACCEPT = [...MEDIA_IMAGE_TYPES, ...MEDIA_VIDEO_TYPES].join(",");
const MAX_IMAGE_BYTES = 15_000_000;
const MAX_VIDEO_BYTES = 250_000_000;

export type UploadedMedia = {
  fileId: string;
  type: "image" | "video";
  contentType: string;
};

function formatMb(bytes: number): string {
  return `${Math.round(bytes / 1_000_000)} MB`;
}

/** Returns an error message, or null when the file can be uploaded. */
export function validateMediaFile(file: File): string | null {
  const isImage = MEDIA_IMAGE_TYPES.includes(file.type);
  const isVideo = MEDIA_VIDEO_TYPES.includes(file.type);
  if (!isImage && !isVideo) {
    return "Use a JPEG, PNG, or WebP image, or an MP4, WebM, or MOV video";
  }
  const max = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > max) {
    return `${isVideo ? "Videos" : "Images"} can be up to ${formatMb(max)}`;
  }
  return null;
}

function putWithProgress(
  url: string,
  file: File,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded / event.total);
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));
    xhr.onabort = () => reject(new DOMException("Upload canceled", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

/** Sign → direct PUT to storage → server verification. */
export async function uploadMediaFile(
  file: File,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<UploadedMedia> {
  const invalid = validateMediaFile(file);
  if (invalid) {
    throw new Error(invalid);
  }

  const signRes = await wisFetch("/api/img/upload", {
    method: "POST",
    body: JSON.stringify({ content_type: file.type, byte_size: file.size }),
    signal,
  });
  const signJson = await signRes.json();
  if (!signRes.ok) {
    throw new Error(signJson.message ?? "Could not start upload");
  }

  await putWithProgress(signJson.upload_url as string, file, onProgress, signal);

  const verifyRes = await wisFetch("/api/img/verify", {
    method: "POST",
    body: JSON.stringify({ file_id: signJson.file_id }),
  });
  const verifyJson = await verifyRes.json();
  if (!verifyRes.ok) {
    throw new Error(verifyJson.message ?? "File verification failed");
  }

  return {
    fileId: signJson.file_id as string,
    type: MEDIA_VIDEO_TYPES.includes(file.type) ? "video" : "image",
    contentType: file.type,
  };
}
