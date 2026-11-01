"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/components/ui";
import { DeviceFrame, SCENES } from "./Scenes";
import { useOnScreen, usePrefersReducedMotion, useStepTimer } from "./useSceneLoop";

const STORY = ["booking", "calendar", "reminder", "visit", "earnings"] as const;
const STEP_MS = 2200;

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
  const running = onScreen && !paused && !hovering && !reducedMotion;
  const [step, setStep] = useStepTimer({
    count: scene.captions.length,
    interval: STEP_MS,
    running,
    onWrap: () => setChapter((current) => (current + 1) % STORY.length),
  });
  // Without autoplay, show the finished picture of each chapter.
  const shownStep = reducedMotion && step === 0 ? scene.captions.length - 1 : step;
  const caption = scene.captions[Math.min(shownStep, scene.captions.length - 1)];

  function goTo(next: number) {
    setChapter((next + STORY.length) % STORY.length);
    setStep(0);
  }
  function nextStep() {
    if (shownStep + 1 < scene.captions.length) setStep(shownStep + 1);
    else goTo(chapter + 1);
  }

  const Scene = scene.Scene;
  return (
    <div ref={ref} className="relative" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)} onBlur={() => setHovering(false)}>
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-rose-200/50 via-rose-100/30 to-amber-100/40 blur-2xl" />
      <div className="rounded-[2rem] border border-rose-100 bg-white/80 p-4 shadow-2xl shadow-rose-950/10 backdrop-blur sm:p-5">
        <div className="flex gap-1.5 overflow-x-auto pb-3 no-scrollbar" role="tablist" aria-label={t("ნახეთ, როგორ მუშაობს", "See how it works")}>
          {STORY.map((id, index) => (
            <button key={id} type="button" role="tab" aria-selected={index === chapter} onClick={() => goTo(index)}
              className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition", index === chapter ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-800 hover:bg-rose-100")}>
              {index + 1}. {SCENES[id].title[lang]}
            </button>
          ))}
        </div>

        <div className="flex h-[460px] items-center justify-center" aria-hidden="true">
          <div key={scene.id} className="step-in w-full">
            <DeviceFrame frame={scene.frame}><Scene step={shownStep} /></DeviceFrame>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={() => goTo(chapter - 1)} aria-label={t("წინა", "Previous")}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 hover:bg-rose-50"><ChevronLeft className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-sm font-semibold text-stone-900" aria-live={running ? "off" : "polite"}>{caption[lang]}</p>
            <div className="mt-2 flex justify-center gap-1">
              {scene.captions.map((_, index) => (
                <span key={index} className={cn("h-1.5 rounded-full transition-all duration-300", index === shownStep ? "w-6 bg-rose-600" : "w-1.5 bg-rose-200")} />
              ))}
            </div>
          </div>
          {!reducedMotion && (
            <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? t("ჩართვა", "Play") : t("პაუზა", "Pause")}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 hover:bg-rose-50">
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
          )}
          <button type="button" onClick={nextStep} aria-label={t("შემდეგი", "Next")}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white hover:bg-rose-700"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>
    </div>
  );
}
