import { readFileSync } from "fs";
import path from "path";
import { ImageResponse } from "next/og";

/**
 * The moarge "M" tile as a PNG of the given size, drawn from src/app/icon.svg so there is one source
 * for the mark. For browsers and search engines that want a raster icon (favicon.ico, Apple touch
 * icon, the logo in structured data).
 */
export function brandIconPng(size: number): ImageResponse {
  const svg = readFileSync(path.join(process.cwd(), "src/app/icon.svg"), "utf8");
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    (<div style={{ width: "100%", height: "100%", display: "flex" }}><img src={src} width={size} height={size} alt="" /></div>),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400, immutable" } }
  );
}
