"use client";

import { useState } from "react";
import { getProductImageUploadUrlAction } from "@/app/(dashboard)/products/actions";

type UploadedImage = {
  id: string;
  previewUrl: string;
  publicUrl: string;
  status: "uploading" | "done" | "error";
};

/**
 * Uploads straight to R2 from the browser (src/lib/storage.ts) — the
 * server only ever hands out a short-lived signed URL, never touches the
 * image bytes. Renders a hidden input per successfully uploaded image
 * (`name="imageUrls"`, repeatable) so the surrounding form picks them up
 * as a plain multi-value field on submit, no client-side form-state
 * plumbing needed beyond this component.
 */
export function ImageUploadField({ name = "imageUrls" }: { name?: string }) {
  const [images, setImages] = useState<UploadedImage[]>([]);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return;

    for (const file of Array.from(fileList)) {
      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      setImages((prev) => [...prev, { id, previewUrl, publicUrl: "", status: "uploading" }]);

      try {
        const { uploadUrl, publicUrl } = await getProductImageUploadUrlAction(file.name, file.type);
        const response = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
        setImages((prev) =>
          prev.map((img) => (img.id === id ? { ...img, publicUrl, status: "done" } : img)),
        );
      } catch {
        setImages((prev) => prev.map((img) => (img.id === id ? { ...img, status: "error" } : img)));
      }
    }
  }

  return (
    <div className="space-y-2">
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="block w-full text-sm"
      />
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img) => (
            <div
              key={img.id}
              className="relative h-16 w-16 overflow-hidden rounded-md border border-neutral-200"
            >
              {/* Local blob: preview, not a remote/static asset — next/image
                  doesn't apply here, so a plain <img> is the right call. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.previewUrl} alt="" className="h-full w-full object-cover" />
              {img.status === "uploading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs">
                  …
                </div>
              )}
              {img.status === "error" && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-100/80 text-xs text-red-600">
                  ✕
                </div>
              )}
              {img.status === "done" && <input type="hidden" name={name} value={img.publicUrl} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
