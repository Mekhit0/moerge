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
 * `interval` may differ per step, so the finished picture can stay on screen a little longer.
 */
export function useStepTimer(options: { count: number; interval: number | ((step: number) => number); running: boolean; onWrap?: () => void }) {
  const { count, interval, running, onWrap } = options;
  const [step, setStepState] = useState(0);
  // Bumped to re-arm the timer after a tick that landed while the tab was hidden.
  const [retry, setRetry] = useState(0);
  const wrapRef = useRef(onWrap);
  const intervalRef = useRef(interval);
  useEffect(() => { wrapRef.current = onWrap; }, [onWrap]);
  useEffect(() => { intervalRef.current = interval; }, [interval]);

  useEffect(() => {
    if (!running) return;
    const current = intervalRef.current;
    const ms = typeof current === "function" ? current(step) : current;
    const timer = window.setTimeout(() => {
      if (document.hidden) { setRetry((value) => value + 1); return; }
      if (step + 1 < count) {
        setStepState(step + 1);
      } else {
        setStepState(0);
        wrapRef.current?.();
      }
    }, ms);
    return () => window.clearTimeout(timer);
  }, [count, running, step, retry]);

  return [step, setStepState] as const;
}

/** Counts from 0 up to `value` when `active` turns on; jumps straight there for reduced motion. */
export function useCountUp(value: number, active: boolean, duration = 700): number {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!active) { setShown(0); return; }
    if (reduced) { setShown(value); return; }
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, duration, reduced, value]);
  return shown;
}
