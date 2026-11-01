"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui";

/**
 * Fades its content up the first time it scrolls into view. Content is always in the page for
 * search engines and screen readers; with "reduce motion" it simply appears.
 */
export default function Reveal({ children, delay = 0, className, as: Tag = "div" }: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "article";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setSeen(true); observer.disconnect(); }
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref as never} style={{ transitionDelay: seen ? `${delay}ms` : "0ms" }}
      className={cn("transition-all duration-700 ease-out motion-reduce:transition-none", seen ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0", className)}>
      {children}
    </Tag>
  );
}
