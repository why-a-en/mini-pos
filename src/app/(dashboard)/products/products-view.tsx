"use client";

import { useState } from "react";
import { Screen, ScrollBody, Toolbar } from "@/components/ui/screen";
import { TopBar } from "@/components/ui/top-bar";
import { IconButton } from "@/components/ui/icon-button";
import { SearchField } from "@/components/ui/search-field";
import { ProductRow } from "@/components/ui/product-row";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";

export interface ProductRowData {
  id: string;
  name: string;
  price: string | null;
  sourceUrl: string | null;
  archived: boolean;
  image?: string;
  modifiers: string[];
}

function formatPrice(price: string | null): string | undefined {
  if (!price) return undefined;
  return `${Number(price).toLocaleString()} MMK`;
}

export function ProductsView({ products, canCreate }: { products: ProductRowData[]; canCreate: boolean }) {
  const [q, setQ] = useState("");
  const query = q.toLowerCase();
  const filtered = products.filter((p) => p.name.toLowerCase().includes(query));
  const active = filtered.filter((p) => !p.archived);
  const archived = filtered.filter((p) => p.archived);

  return (
    <Screen>
      <TopBar
        backHref="/home"
        title="Products"
        eyebrow={`${products.length} products`}
        right={
          canCreate ? <IconButton icon="plus" label="Add product" href="/products/new" variant="solid" /> : null
        }
      />
      <Toolbar>
        <SearchField value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ("")} placeholder="Search products" />
      </Toolbar>
      <ScrollBody>
        {filtered.length === 0 ? (
          <EmptyState
            icon="package"
            title={q ? "No match." : "No products yet."}
            body={q ? "Nothing in the catalog under that name." : "Add the first one to get started."}
          />
        ) : (
          <>
            {active.length > 0 && <SectionHeader right={`${active.length} active`}>Active</SectionHeader>}
            {active.map((p) => (
              <ProductRow
                key={p.id}
                href={`/products/${p.id}`}
                name={p.name}
                meta={formatPrice(p.price)}
                image={p.image}
                modifiers={p.modifiers}
                sourceUrl={p.sourceUrl}
              />
            ))}
            {archived.length > 0 && <SectionHeader>Archived</SectionHeader>}
            {archived.map((p) => (
              <ProductRow key={p.id} href={`/products/${p.id}`} name={p.name} meta={formatPrice(p.price)} image={p.image} modifiers={p.modifiers} archived />
            ))}
          </>
        )}
      </ScrollBody>
    </Screen>
  );
}
