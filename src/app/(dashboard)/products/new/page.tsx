import { Field, fieldInputClass } from "@/components/form-field";
import { ImageUploadField } from "@/components/image-upload-field";
import { createProductAction } from "../actions";

// Everything on one form, visible up front — no separate step to notice or
// miss (see docs/PRD.md §6.1: attaching a Modifier happens "without
// leaving the form"). A second Modifier, or attaching an existing one
// instead of creating new, still happens on the product's own page after
// this — this form covers the common single-modifier case inline.
export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-lg font-semibold">Add a product</h1>
      <form action={createProductAction} className="space-y-4">
        <Field label="Name">
          <input name="name" required className={fieldInputClass} />
        </Field>
        <Field label="Description">
          <textarea name="description" required rows={3} className={fieldInputClass} />
        </Field>
        <Field label="Images">
          <ImageUploadField />
        </Field>
        <Field label="Source URL (link to the exact Lazada/TikTok Shop listing)">
          <input name="sourceUrl" type="url" placeholder="https://…" className={fieldInputClass} />
        </Field>
        <Field label="Price in MMK (optional)">
          <input name="price" type="number" step="0.01" min="0" className={fieldInputClass} />
        </Field>

        <fieldset className="space-y-3 rounded-lg border border-neutral-200 p-3">
          <legend className="px-1 text-sm font-medium">Modifier (optional)</legend>
          <Field label="Name (e.g. Color, Size)">
            <input name="modifierName" className={fieldInputClass} />
          </Field>
          <Field label="Options, comma-separated (e.g. Black, White, Red)">
            <input name="modifierOptions" className={fieldInputClass} />
          </Field>
        </fieldset>

        <button
          type="submit"
          className="min-h-11 w-full rounded-md bg-neutral-900 px-3 text-base font-medium text-white"
        >
          Save product
        </button>
      </form>
    </div>
  );
}
