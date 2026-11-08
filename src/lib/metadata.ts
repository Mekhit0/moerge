import type { Metadata, Viewport } from "next";
import { getAppUrl } from "./app-url";

export const siteViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#e11d48",
};

export const siteMetadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: {
    default: "moarge | სალონის პროგრამა: ონლაინ ჯავშანი, კალენდარი, კლიენტები",
    template: "%s | moarge",
  },
  description:
    "სალონის მართვის პროგრამა ქართულად: ონლაინ ჯავშანი, კალენდარი, კლიენტების ბაზა, შეხსენებები და შემოსავალი.",
  applicationName: "moarge",
  keywords: [
    "სალონის პროგრამა",
    "სალონის მართვის პროგრამა",
    "ონლაინ ჯავშანი",
    "ონლაინ ჩაწერა",
    "სალონის კალენდარი",
    "კლიენტების ბაზა",
    "სილამაზის სალონი",
    "moarge",
    "მოარგე",
  ],
  authors: [{ name: "moarge" }],
  creator: "moarge",
  publisher: "moarge",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    // SVG for modern browsers, a 48px PNG for search results and older browsers.
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", type: "image/png", sizes: "48x48" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" },
    ],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "ka_GE",
    url: getAppUrl(),
    siteName: "moarge",
    title: "moarge | სალონის პროგრამა: ონლაინ ჯავშანი, კალენდარი, კლიენტები",
    description:
      "სალონის მართვის პროგრამა ქართულად: ონლაინ ჯავშანი, კალენდარი, კლიენტების ბაზა, შეხსენებები და შემოსავალი.",
  },
  twitter: {
    card: "summary_large_image",
    title: "moarge | სალონის პროგრამა: ონლაინ ჯავშანი, კალენდარი, კლიენტები",
    description:
      "სალონის მართვის პროგრამა ქართულად: ონლაინ ჯავშანი, კალენდარი, კლიენტების ბაზა, შეხსენებები და შემოსავალი.",
  },
  // Bing Webmaster Tools ownership token: public by design (also in public/BingSiteAuth.xml).
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
    other: { "msvalidate.01": "158B4EB50C84680543DA9FD33ED68C29" },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};
