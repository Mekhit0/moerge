"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/components/ui";
import { DeviceFrame, SCENES } from "./Scenes";
import { useOnScreen, usePrefersReducedMotion, useStepTimer } from "./useSceneLoop";

const STORY = ["booking", "calendar", "reminder", "visit", "earnings"] as const;
const STEP_MS = 2300;
const LAST_STEP_MS = 3400; // the finished picture stays a little longer

/**
 * The landing page story: a client books, it lands in the calendar, a reminder goes out, the visit
 * is paid, the owner sees the numbers. Plays by itself while on screen; any tap takes over.
 */
export default function ProductTour() {
  const { lang, t } = useLanguage();
  const reducedMotion = usePrefersReducedMotion();
  const [ref, onScreen] = useOnScreen<HTMLDivElement>();
  const [chapter, setChapter] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const scene = SCENES[STORY[chapter]];
  const count = scene.captions.length;
  const running = onScreen && !paused && !hovering && !reducedMotion;
  const duration = (index: number) => (index === count - 1 ? LAST_STEP_MS : STEP_MS);
  const [step, setStep] = useStepTimer({
    count,
    interval: duration,
    running,
    onWrap: () => setChapter((current) => (current + 1) % STORY.length),
  });
  // Without autoplay, show the finished picture of each chapter.
  const shownStep = reducedMotion && step === 0 ? count - 1 : step;
  const caption = scene.captions[Math.min(shownStep, count - 1)];

  function goTo(next: number) {
    setChapter((next + STORY.length) % STORY.length);
    setStep(0);
  }
  function nextStep() {
    if (shownStep + 1 < count) setStep(shownStep + 1);
    else goTo(chapter + 1);
  }
  function previousStep() {
    if (shownStep > 0) setStep(shownStep - 1);
    else goTo(chapter - 1);
  }

  const Scene = scene.Scene;
  return (
    <div ref={ref} onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)} onBlur={() => setHovering(false)}>
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        {/* Story bars: one per chapter, the current one fills as it plays. */}
        <div className="flex gap-1.5" role="tablist" aria-label={t("ნახეთ, როგორ მუშაობს", "See how it works")}>
          {STORY.map((id, index) => {
            const done = index < chapter;
            const current = index === chapter;
            const from = shownStep / count;
            const to = (shownStep + 1) / count;
            return (
              <button key={id} type="button" role="tab" aria-selected={current} aria-label={SCENES[id].title[lang]} onClick={() => goTo(index)}
                className="group flex-1 py-2">
                <span className="block h-1 overflow-hidden rounded-full bg-stone-200 transition group-hover:bg-stone-300">
                  {done && <span className="block h-full w-full bg-rose-600" />}
                  {current && (
                    <span
                      key={`${chapter}-${shownStep}-${running}`}
                      className={cn("block h-full w-full bg-rose-600", running && "tour-fill")}
                      style={running
                        ? ({ "--fill-from": from, "--fill-to": to, "--fill-ms": `${duration(shownStep)}ms` } as React.CSSProperties)
                        : { transform: `scaleX(${reducedMotion ? to : from || 0.02})`, transformOrigin: "left" }}
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <p className="flex items-baseline gap-2 text-sm font-bold text-stone-900">
          <span className="tabular-nums text-rose-600">{chapter + 1}/{STORY.length}</span>
          {scene.title[lang]}
        </p>

        <div className="mt-3 flex h-[450px] items-center justify-center" aria-hidden="true">
          <div key={scene.id} className="scene-in w-full">
            <DeviceFrame frame={scene.frame}><Scene step={shownStep} /></DeviceFrame>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={previousStep} aria-label={t("წინა", "Previous")}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 transition hover:bg-stone-50"><ChevronLeft className="h-5 w-5" /></button>
          <p key={`${chapter}-${shownStep}`} className="step-in min-h-10 min-w-0 flex-1 text-center text-sm font-semibold leading-snug text-stone-800 flex items-center justify-center" aria-live={running ? "off" : "polite"}>
            {caption[lang]}
          </p>
          {!reducedMotion && (
            <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? t("ჩართვა", "Play") : t("პაუზა", "Pause")}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 transition hover:bg-stone-50">
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
          )}
          <button type="button" onClick={nextStep} aria-label={t("შემდეგი", "Next")}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white transition hover:bg-rose-700"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>
    </div>
  );
}
