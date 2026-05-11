import { AppShell } from "@/components/AppShell";
import { BonusClient } from "./BonusClient";

interface Props {
  params: Promise<{ cx: string }>;
}

export default async function BonusPage({ params }: Props) {
  const { cx } = await params;
  return (
    <AppShell>
      <BonusClient cx={cx} />
    </AppShell>
  );
}
