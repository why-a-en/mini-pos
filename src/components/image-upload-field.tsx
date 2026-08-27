"use client";

import { useState } from "react";
import { getProductImageUploadUrlAction } from "@/app/(dashboard)/products/actions";
import { useFieldControlId } from "@/components/ui/field";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

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
 *
 * Styling note: this was the one control that never got the design-system
 * pass — it carried Tailwind's stock palette (neutral-200 borders, a red
 * error chip, white scrims) into a system that is deliberately hueless, and
 * generic text-xs/text-sm instead of the type scale. In-progress and failed
 * states now use the system's own density devices: `ds-working` sweeps light
 * across the tile that is uploading, and a failure is marked by the same
 * hatch that marks every other destructive/cancelled surface.
 */
export function ImageUploadField({ name = "imageUrls" }: { name?: string }) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  // Adopts the id its Field generated, so the "IMAGES" label actually points
  // at this control instead of dangling.
  const controlId = useFieldControlId();

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
        setImages((prev) => prev.map((img) => (img.id === id ? { ...img, publicUrl, status: "done" } : img)));
      } catch {
        setImages((prev) => prev.map((img) => (img.id === id ? { ...img, status: "error" } : img)));
      }
    }
  }

  return (
    <div className="grid gap-2">
      <input
        id={controlId}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className={cn(
          "block w-full cursor-pointer font-ui text-small text-text-muted outline-none",
          // The native button is styled through file: rather than hidden
          // behind a proxy control — it keeps the input keyboard-reachable
          // and labelled with no JS. Tones and timings match Button's
          // secondary variant, including the press, so this doesn't read as
          // a foreign control dropped into the form.
          "file:mr-3 file:cursor-pointer file:rounded-sm file:border file:border-line-strong file:bg-transparent",
          "file:h-(--control-h-sm) file:px-3 file:font-ui file:text-[13px] file:font-semibold file:text-text-strong",
          "file:transition-[background,color,scale] file:duration-fast file:ease-standard",
          "hover:file:bg-surface-invert hover:file:text-text-invert active:file:scale-95",
          "focus-visible:file:shadow-[var(--focus-ring)]",
        )}
      />

      {images.length > 0 && (
        <ul className="flex list-none flex-wrap gap-2 p-0">
          {images.map((img) => (
            <li
              key={img.id}
              className={cn(
                "relative size-16 overflow-hidden rounded-sm border border-line-hairline bg-surface-sunken",
                img.status === "uploading" && "ds-working",
              )}
            >
              {/* Local blob: preview, not a remote/static asset — next/image
                  doesn't apply here, so a plain <img> is the right call. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.previewUrl} alt="" className={cn("size-full object-cover", img.status !== "done" && "opacity-60")} />

              {img.status === "uploading" && <span className="sr-only">Uploading…</span>}

              {img.status === "error" && (
                <span
                  className="absolute inset-0 flex items-center justify-center bg-danger-wash/85 text-danger"
                  title="Upload failed"
                >
                  <span aria-hidden="true" className="ds-hatch absolute inset-x-0 bottom-0 h-2" />
                  <Icon name="triangle-alert" size={16} />
                  <span className="sr-only">Upload failed</span>
                </span>
              )}

              {img.status === "done" && <input type="hidden" name={name} value={img.publicUrl} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
