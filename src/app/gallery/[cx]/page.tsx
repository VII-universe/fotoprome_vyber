import { GalleryClient } from "./GalleryClient";

interface Props {
  params: Promise<{ cx: string }>;
}

export default async function GalleryPage({ params }: Props) {
  const { cx } = await params;
  return <GalleryClient cx={cx} />;
}
