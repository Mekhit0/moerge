import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "გამოწერის გაუქმება", description: "შეხსენებებზე გამოწერის გაუქმება.", path: "/unsubscribe", noIndex: true });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
