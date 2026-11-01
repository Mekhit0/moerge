"use client";

import { useEffect, useRef, useState } from "react";

/** True when the visitor asked their device for less motion. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** True while the element is on screen, so animations stop when nobody can see them. */
export function useOnScreen<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, visible];
}

/**
 * Steps through a demo on a timer. It pauses when told to, when the tab is hidden, and never runs
 * for people who prefer less motion: they move through the steps with the buttons instead.
 */
export function useStepTimer(options: { count: number; interval: number; running: boolean; onWrap?: () => void }) {
  const { count, interval, running, onWrap } = options;
  const [step, setStepState] = useState(0);
  const stepRef = useRef(0);
  const wrapRef = useRef(onWrap);
  useEffect(() => { wrapRef.current = onWrap; }, [onWrap]);

  const setStep = (next: number) => {
    stepRef.current = next;
    setStepState(next);
  };

  useEffect(() => {
    if (!running) return;
    const tick = window.setInterval(() => {
      if (document.hidden) return;
      if (stepRef.current + 1 < count) {
        stepRef.current += 1;
        setStepState(stepRef.current);
      } else {
        stepRef.current = 0;
        setStepState(0);
        wrapRef.current?.();
      }
    }, interval);
    return () => window.clearInterval(tick);
  }, [count, interval, running]);

  return [step, setStep] as const;
}
