import { brandIconPng } from "@/lib/brand-icon";

// Built once at deploy time.
export const dynamic = "force-static";

export function GET() {
  return brandIconPng(512);
}
