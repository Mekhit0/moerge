import Image from "next/image";
import type { ProductScreen } from "@/lib/screens";

/** One real screenshot in a light device frame. Phone shots stay narrow, desktop shots fill the width. */
export default function ProductScreenshot({
  screen,
  lang = "ka",
  sizes,
  priority = false,
  className = "",
}: {
  screen: ProductScreen;
  lang?: "ka" | "en";
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const isPhone = screen.height > screen.width;
  return (
    <figure className={`${isPhone ? "w-full max-w-[260px]" : "w-full"} ${className}`}>
      <div
        className={`overflow-hidden border border-stone-200 bg-white shadow-[0_18px_40px_-24px_rgba(68,64,60,0.45)] ${
          isPhone ? "rounded-[1.75rem] p-1.5" : "rounded-2xl p-1"
        }`}
      >
        <Image
          src={screen.src}
          width={screen.width}
          height={screen.height}
          alt={screen.alt[lang]}
          sizes={sizes ?? (isPhone ? "260px" : "(min-width: 1024px) 960px, 100vw")}
          priority={priority}
          className={`h-auto w-full ${isPhone ? "rounded-[1.4rem]" : "rounded-xl"}`}
        />
      </div>
      <figcaption className="mt-3 text-center text-sm font-semibold text-stone-600">{screen.caption[lang]}</figcaption>
    </figure>
  );
}
