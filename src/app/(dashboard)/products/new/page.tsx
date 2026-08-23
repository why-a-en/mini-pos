import { Field, fieldInputClass } from "@/components/form-field";
import { createProductAction } from "../actions";

// Core fields only — Modifiers are attached on the product's own page
// right after this (docs/PRD.md §6.1), so "create a product" is really a
// short flow: this form, then straight into attaching/creating modifiers.
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
        <Field label="Source marketplace">
          <select name="sourceMarketplace" defaultValue="" className={fieldInputClass}>
            <option value="">Not sure yet</option>
            <option value="lazada">Lazada</option>
            <option value="tiktok_shop">TikTok Shop</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Source URL (optional, but the Supplier will thank you)">
          <input name="sourceUrl" type="url" placeholder="https://…" className={fieldInputClass} />
        </Field>
        <Field label="Price in MMK (optional)">
          <input name="price" type="number" step="0.01" min="0" className={fieldInputClass} />
        </Field>
        {/*
          TODO: image upload UI. src/lib/storage.ts already has direct-to-R2
          presigned upload ready to wire up — the UX for it (single vs
          multi-image, reordering) is a question for /prototype, not decided
          here.
        */}
        <button
          type="submit"
          className="min-h-11 w-full rounded-md bg-neutral-900 px-3 text-base font-medium text-white"
        >
          Save and continue
        </button>
      </form>
    </div>
  );
}
