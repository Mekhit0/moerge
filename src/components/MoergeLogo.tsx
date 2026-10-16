import React from "react";

export interface MoergeLogoProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "full" | "icon";
  theme?: "dark" | "light" | "white";
  showSubtitle?: boolean;
}

const SIZE_MAP = {
  xs: { icon: 24, text: "text-base", sub: "text-[8px]" },
  sm: { icon: 32, text: "text-lg", sub: "text-[9px]" },
  md: { icon: 40, text: "text-xl", sub: "text-[10px]" },
  lg: { icon: 48, text: "text-2xl", sub: "text-[11px]" },
  xl: { icon: 60, text: "text-3xl", sub: "text-[12px]" },
};

export default function MoergeLogo({
  className = "",
  size = "md",
  variant = "full",
  theme = "dark",
  showSubtitle = true,
}: MoergeLogoProps) {
  const { icon: iconDim, text: textClass, sub: subClass } = SIZE_MAP[size];

  const textColor =
    theme === "white"
      ? "text-white"
      : theme === "light"
      ? "text-rose-950"
      : "text-stone-900";

  const subtitleColor =
    theme === "white" ? "text-rose-200" : "text-rose-600";

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Precision Vector Iconmark */}
      <svg
        width={iconDim}
        height={iconDim}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-sm transition-transform duration-200 hover:scale-[1.03]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="moerge_bg_grad"
            x1="2"
            y1="2"
            x2="46"
            y2="46"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="45%" stopColor="#e11d48" />
            <stop offset="100%" stopColor="#9f1239" />
          </linearGradient>

          <linearGradient
            id="moerge_star_grad"
            x1="21"
            y1="7"
            x2="27"
            y2="17"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>

          <linearGradient
            id="moerge_m_grad"
            x1="12"
            y1="12"
            x2="36"
            y2="36"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#ffe4e6" />
          </linearGradient>

          <filter id="moerge_drop" x="-10%" y="-10%" width="125%" height="125%">
            <feDropShadow
              dx="0"
              dy="1.5"
              stdDeviation="1.5"
              floodColor="#4c0519"
              floodOpacity="0.3"
            />
          </filter>
        </defs>

        {/* Outer Squircle Container */}
        <rect
          x="2"
          y="2"
          width="44"
          height="44"
          rx="13"
          fill="url(#moerge_bg_grad)"
        />

        {/* Subtle Luxury Inset Border */}
        <rect
          x="2.5"
          y="2.5"
          width="43"
          height="43"
          rx="12.5"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="1"
        />

        {/* Intertwined Architectural M */}
        <g filter="url(#moerge_drop)">
          <path
            d="M12 34V18.5C12 14.9 14.9 12 18.5 12C20.8 12 22.8 13.2 24 15.1C25.2 13.2 27.2 12 29.5 12C33.1 12 36 14.9 36 18.5V34C36 34.6 35.6 35 35 35H32C31.4 35 31 34.6 31 34V20C31 18.3 29.7 17 28 17C26.3 17 25 18.3 25 20V32C25 32.6 24.6 33 24 33C23.4 33 23 32.6 23 32V20C23 18.3 21.7 17 20 17C18.3 17 17 18.3 17 20V34C17 34.6 16.6 35 16 35H13C12.4 35 12 34.6 12 34Z"
            fill="url(#moerge_m_grad)"
          />
        </g>

        {/* Salon Sparkle Apex */}
        <path
          d="M24 7.2L24.9 9.8C25.1 10.3 25.5 10.7 26 10.9L28.6 11.8L26 12.7C25.5 12.9 25.1 13.3 24.9 13.8L24 16.4L23.1 13.8C22.9 13.3 22.5 12.9 22 12.7L19.4 11.8L22 10.9C22.5 10.7 22.9 10.3 23.1 9.8L24 7.2Z"
          fill="url(#moerge_star_grad)"
        />
      </svg>

      {/* Typography Wordmark */}
      {variant === "full" && (
        <div className="flex flex-col leading-none">
          <span
            className={`font-black tracking-tight ${textClass} ${textColor} font-sans`}
          >
            MOERGE
          </span>
          {showSubtitle && (
            <span
              className={`font-extrabold uppercase tracking-[0.22em] ${subClass} ${subtitleColor} mt-0.5`}
            >
              SALON SUITE
            </span>
          )}
        </div>
      )}
    </div>
  );
}
