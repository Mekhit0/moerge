import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "ჩემი ჯავშანი", description: "ნახეთ, გადაიტანეთ ან გააუქმეთ თქვენი ჯავშანი ჯავშნის კოდით.", path: "/manage-booking", noIndex: true });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
