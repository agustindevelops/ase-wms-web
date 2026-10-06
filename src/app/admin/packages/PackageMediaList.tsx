"use client";

import {
  MEDIA_ACCEPT,
  uploadMediaFile,
  validateMediaFile,
} from "@/lib/api/uploadMedia";
import {
  ChangeEvent,
  Dispatch,
  DragEvent,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import type { PackageMedia } from "./packageTypes";

export type MediaLine = {
  key: string;
  name: string;
  type: "image" | "video";
  previewUrl: string | null;
  status: "uploading" | "ready" | "error";
  progress: number;
  fileId: string | null;
  error: string | null;
  /** Kept for retry; null for media that was already saved. */
  file: File | null;
};

export function initialMediaLines(media: PackageMedia[] = []): MediaLine[] {
  return media.map((row, index) => ({
    key: row.id,
    name: `${row.type === "video" ? "Video" : "Photo"} ${index + 1}`,
    type: row.type,
    previewUrl: row.url,
    status: "ready",
    progress: 1,
    fileId: row.fileId,
    error: null,
    file: null,
  }));
}

type Props = {
  lines: MediaLine[];
  setLines: Dispatch<SetStateAction<MediaLine[]>>;
  disabled: boolean;
};

export default function PackageMediaList({ lines, setLines, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const controllers = useRef(new Map<string, AbortController>());
  const objectUrls = useRef(new Set<string>());
  const dragIndex = useRef<number | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  useEffect(() => {
    const pending = controllers.current;
    const urls = objectUrls.current;
    return () => {
      pending.forEach((controller) => controller.abort());
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const patch = (key: string, next: Partial<MediaLine>) =>
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...next } : line)),
    );

  const startUpload = (key: string, file: File) => {
    const controller = new AbortController();
    controllers.current.set(key, controller);
    patch(key, { status: "uploading", progress: 0, error: null });
    uploadMediaFile(
      file,
      (progress) => patch(key, { progress }),
      controller.signal,
    )
      .then((uploaded) =>
        patch(key, { status: "ready", progress: 1, fileId: uploaded.fileId }),
      )
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") {
          return;
        }
        patch(key, {
          status: "error",
          error: cause instanceof Error ? cause.message : "Upload failed",
        });
      })
      .finally(() => controllers.current.delete(key));
  };

  const addFiles = (files: FileList | File[]) => {
    const added: Array<{ line: MediaLine; file: File }> = [];
    for (const file of Array.from(files)) {
      const invalid = validateMediaFile(file);
      const previewUrl = invalid ? null : URL.createObjectURL(file);
      if (previewUrl) objectUrls.current.add(previewUrl);
      added.push({
        file,
        line: {
          key: `upload-${crypto.randomUUID()}`,
          name: file.name,
          type: file.type.startsWith("video/") ? "video" : "image",
          previewUrl,
          status: invalid ? "error" : "uploading",
          progress: 0,
          fileId: null,
          error: invalid,
          file,
        },
      });
    }
    setLines((current) => [...current, ...added.map((row) => row.line)]);
    for (const { line, file } of added) {
      if (line.status === "uploading") startUpload(line.key, file);
    }
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) addFiles(event.target.files);
    event.target.value = "";
  };

  const remove = (line: MediaLine) => {
    controllers.current.get(line.key)?.abort();
    if (line.file && line.previewUrl) {
      URL.revokeObjectURL(line.previewUrl);
      objectUrls.current.delete(line.previewUrl);
    }
    setLines((current) => current.filter((row) => row.key !== line.key));
  };

  const move = (from: number, to: number) => {
    setLines((current) => {
      if (to < 0 || to >= current.length || from === to) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const isFileDrag = (event: DragEvent) =>
    Array.from(event.dataTransfer.types).includes("Files");

  const onZoneDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(event) || disabled) return;
    event.preventDefault();
    setDropActive(true);
  };

  const onZoneDrop = (event: DragEvent<HTMLDivElement>) => {
    setDropActive(false);
    if (!isFileDrag(event) || disabled) return;
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  };

  const onRowDrop = (event: DragEvent<HTMLLIElement>, index: number) => {
    if (dragIndex.current === null) return;
    event.preventDefault();
    move(dragIndex.current, index);
    dragIndex.current = null;
    setOverIndex(null);
  };

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-brown-700">Photos and videos</p>

      {lines.length > 0 ? (
        <ol className="mb-3 space-y-2">
          {lines.map((line, index) => (
            <li
              key={line.key}
              draggable={!disabled}
              onDragStart={(event) => {
                dragIndex.current = index;
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(event) => {
                if (dragIndex.current === null) return;
                event.preventDefault();
                setOverIndex(index);
              }}
              onDragLeave={() => setOverIndex(null)}
              onDrop={(event) => onRowDrop(event, index)}
              onDragEnd={() => {
                dragIndex.current = null;
                setOverIndex(null);
              }}
              className={`flex items-center gap-3 rounded-lg border bg-white px-3 py-2 ${
                overIndex === index ? "border-green-500" : "border-brown-100"
              }`}
            >
              <span
                aria-hidden
                className="cursor-grab select-none text-brown-400"
                title="Drag to reorder"
              >
                ⋮⋮
              </span>
              <span className="w-5 text-right text-xs text-brown-500">{index + 1}</span>
              <MediaThumb line={line} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-brown-800">{line.name}</p>
                {line.status === "uploading" ? (
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brown-100">
                      <div
                        className="h-full bg-green-500 transition-[width]"
                        style={{ width: `${Math.round(line.progress * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-brown-500">
                      {line.progress >= 1
                        ? "Verifying…"
                        : `${Math.round(line.progress * 100)}%`}
                    </span>
                  </div>
                ) : line.status === "error" ? (
                  <p className="text-xs text-peach-700" role="alert">
                    {line.error}
                  </p>
                ) : (
                  <p className="text-xs text-brown-500">
                    {line.type === "video" ? "Video" : "Photo"}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-3 text-sm">
                {line.status === "error" && line.file && line.previewUrl ? (
                  <button
                    type="button"
                    onClick={() => line.file && startUpload(line.key, line.file)}
                    className="font-medium text-green-700 hover:underline"
                  >
                    Retry
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => move(index, index - 1)}
                  disabled={disabled || index === 0}
                  aria-label={`Move ${line.name} up`}
                  className="text-brown-600 hover:underline disabled:opacity-40"
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => move(index, index + 1)}
                  disabled={disabled || index === lines.length - 1}
                  aria-label={`Move ${line.name} down`}
                  className="text-brown-600 hover:underline disabled:opacity-40"
                >
                  Down
                </button>
                <button
                  type="button"
                  onClick={() => remove(line)}
                  disabled={disabled}
                  className="font-medium text-peach-700 hover:underline disabled:opacity-40"
                >
                  {line.status === "uploading" ? "Cancel" : "Remove"}
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      <div
        onDragOver={onZoneDragOver}
        onDragLeave={() => setDropActive(false)}
        onDrop={onZoneDrop}
        className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center ${
          dropActive ? "border-green-500 bg-green-50" : "border-brown-200"
        }`}
      >
        <p className="text-sm text-brown-700">Drop photos or videos here</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="rounded-full border border-brown-300 px-4 py-2 text-sm font-medium text-brown-700 hover:bg-brown-100 disabled:opacity-50"
        >
          Add media
        </button>
        <p className="text-xs text-brown-500">
          JPEG, PNG, WebP up to 15 MB · MP4, WebM, MOV up to 250 MB
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={MEDIA_ACCEPT}
          className="hidden"
          onChange={onInputChange}
        />
      </div>
    </div>
  );
}

function MediaThumb({ line }: { line: MediaLine }) {
  const box = "h-14 w-20 shrink-0 rounded-md bg-brown-100 object-cover";
  if (!line.previewUrl) {
    return (
      <div className={`${box} flex items-center justify-center text-xs text-brown-500`}>
        {line.type === "video" ? "Video" : "Photo"}
      </div>
    );
  }
  const thumb =
    line.type === "video" ? (
      <video
        src={`${line.previewUrl}#t=0.1`}
        muted
        playsInline
        preload="metadata"
        className={box}
      />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={line.previewUrl} alt="" className={box} />
    );
  return (
    <a
      href={line.previewUrl}
      target="_blank"
      rel="noreferrer"
      draggable={false}
      className="relative"
      title="Open in a new tab"
    >
      {thumb}
      {line.type === "video" ? (
        <span className="absolute inset-0 flex items-center justify-center text-lg text-white drop-shadow">
          ▶
        </span>
      ) : null}
    </a>
  );
}
