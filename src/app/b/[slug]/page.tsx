import { notFound, redirect } from "next/navigation";

// Short booking link for SMS (moarge.com/b/salon-slug), so a message fits in fewer SMS.
export default async function ShortBookingLink({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 60) notFound();
  redirect(`/book?salon=${encodeURIComponent(slug)}`);
}
