import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "წესები და პირობები", description: "moarge-ის გამოყენების წესები და პირობები სალონებისთვის და მათი კლიენტებისთვის.", path: "/terms" });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
