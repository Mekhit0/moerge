import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "კონფიდენციალურობის პოლიტიკა", description: "როგორ ინახავს და იცავს moarge სალონების და მათი კლიენტების მონაცემებს.", path: "/privacy" });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
