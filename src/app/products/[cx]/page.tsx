import { AppShell } from "@/components/AppShell";
import { ProductConfigClient } from "./ProductConfigClient";

interface Props {
  params: Promise<{ cx: string }>;
  searchParams: Promise<{ product?: string }>;
}

export default async function ProductPage({ params, searchParams }: Props) {
  const { cx } = await params;
  const { product } = await searchParams;
  return (
    <AppShell>
      <ProductConfigClient cx={cx} initialProduct={product ?? null} />
    </AppShell>
  );
}
