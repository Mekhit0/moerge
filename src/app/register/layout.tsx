import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "რეგისტრაცია", description: "დაარეგისტრირეთ სალონი moarge-ში.", path: "/register", noIndex: true });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
