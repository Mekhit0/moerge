import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "ონლაინ ჯავშნის გვერდის მაგალითი", description: "ნახეთ, როგორ ეწერება კლიენტი სალონში moarge-ით: სერვისი, სპეციალისტი, თავისუფალი დრო და ჯავშნის კოდი.", path: "/book", noIndex: true });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
