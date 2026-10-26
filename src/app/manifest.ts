import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "moarge salon manager",
    short_name: "moarge",
    description: "Salon bookings, staff schedules, and client management.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#fdf8f6",
    theme_color: "#e11d48",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}

