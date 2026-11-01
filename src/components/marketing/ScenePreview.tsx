"use client";

import React from "react";
import { DeviceFrame, SCENES } from "@/components/tour/Scenes";
import { useOnScreen, usePrefersReducedMotion, useStepTimer } from "@/components/tour/useSceneLoop";

/** One product scene playing on its own while on screen. Decorative: the page text says the same. */
export default function ScenePreview({ scene }: { scene: keyof typeof SCENES }) {
  const info = SCENES[scene];
  const reducedMotion = usePrefersReducedMotion();
  const [ref, onScreen] = useOnScreen<HTMLDivElement>();
  const [step] = useStepTimer({ count: info.captions.length, interval: 2400, running: onScreen && !reducedMotion });
  const shown = reducedMotion ? info.captions.length - 1 : step;
  const Scene = info.Scene;
  return (
    <div ref={ref} aria-hidden="true" className={info.frame === "phone" ? "mx-auto w-[232px]" : "mx-auto w-full max-w-[480px]"}>
      <DeviceFrame frame={info.frame}><Scene step={shown} /></DeviceFrame>
    </div>
  );
}
