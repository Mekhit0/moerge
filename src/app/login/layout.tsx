import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "შესვლა და რეგისტრაცია", description: "შედით moarge-ის სალონის პანელში ან დაარეგისტრირეთ სალონი 30 დღით უფასოდ.", path: "/login", noIndex: true });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
