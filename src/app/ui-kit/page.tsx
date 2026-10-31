import { notFound } from "next/navigation";
import type { Metadata } from "next";
import UiKitPreview from "./UiKitPreview";

export const metadata: Metadata = { title: "UI kit", robots: { index: false, follow: false } };

// Developer preview of the shared components. Never served in production.
export default function UiKitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiKitPreview />;
}
