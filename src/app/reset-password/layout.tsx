import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "პაროლის აღდგენა", description: "ახალი პაროლის შექმნა.", path: "/reset-password", noIndex: true });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
