import type { Metadata, Viewport } from "next";

export const siteViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#e11d48",
};

export const siteMetadata: Metadata = {
  metadataBase: new URL("https://moerge.vercel.app"),
  title: {
    default: "MOERGE | სალონის ჭკვიანი ჯავშნები და ავტომატური შეხსენებები",
    template: "%s | MOERGE",
  },
  description:
    "MOERGE — სალონის მართვის, ონლაინ ჯავშნების და კლიენტების ავტომატური შეხსენებების თანამედროვე პლატფორმა. გაზარდეთ განმეორებითი ვიზიტები +40%-ით, აღმოფხვერით ქაოსი და დაიცავით გრაფიკი გადაფარვებისგან.",
  keywords: [
    "სალონის მართვა",
    "ონლაინ ჯავშანი",
    "სალონის პროგრამა",
    "სალონის განრიგი",
    "ავტომატური შეხსენებები",
    "კლიენტების დაბრუნება",
    "ეპილაციის სალონი",
    "სილამაზის სალონი",
    "salon booking software georgia",
    "moerge",
  ],
  authors: [{ name: "MOERGE" }],
  creator: "MOERGE",
  publisher: "MOERGE",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ka_GE",
    url: "https://moerge.vercel.app",
    siteName: "MOERGE",
    title: "MOERGE | სალონის ჭკვიანი ჯავშნები და ავტომატური შეხსენებები",
    description:
      "სალონის მართვის, ონლაინ ჯავშნების და კლიენტების ავტომატური შეხსენებების თანამედროვე პლატფორმა საქართველოში.",
  },
  twitter: {
    card: "summary_large_image",
    title: "MOERGE | სალონის ჭკვიანი ჯავშნები და ავტომატური შეხსენებები",
    description:
      "გაზარდეთ თქვენი სალონის განმეორებითი ვიზიტები და დაიცავით გრაფიკი გადაფარვებისგან.",
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
