"use client";

import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

const TOTAL_FRAMES = 361;
const DEFAULT_FRAME_BASE = "https://cdn.jsdelivr.net/gh/hacksd/3dwebsites@main/frames";
const FRAME_BASE = process.env.NEXT_PUBLIC_FRAME_BASE_URL || DEFAULT_FRAME_BASE;

const beats = [
  { title: "WpDev Keyboard.", subtitle: "Engineered clarity.", start: 0, end: 0.2, align: "center" },
  { title: "Built for Precision.", subtitle: "Every detail, measured.", start: 0.2, end: 0.5, align: "left" },
  { title: "Layered Engineering.", subtitle: "See what’s inside.", start: 0.5, end: 0.82, align: "right" },
  { title: "Assembled. Ready.", subtitle: "Scroll back to replay.", start: 0.82, end: 1, align: "center" },
] as const;

const frameCandidates = (index: number) => {
  const oneBased = index + 1;
  const zeroPad = String(oneBased).padStart(5, "0");
  return [`${zeroPad}.jpg`, `frame_${index}_delay-0.04s.webp`, `${oneBased}.jpg`];
};

function alignClass(align: "left" | "center" | "right") {
  if (align === "left") return "items-start text-left";
  if (align === "right") return "items-end text-right";
  return "items-center text-center";
}

export default function KeyboardScroll() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastDrawnRef = useRef(-1);

  const [images, setImages] = useState<(HTMLImageElement | null)[]>([]);
  const [loadedCount, setLoadedCount] = useState(0);
  const [erroredCount, setErroredCount] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const currentFrame = useTransform(scrollYProgress, (v) => {
    const idx = Math.floor(v * (TOTAL_FRAMES - 1));
    return Math.max(0, Math.min(TOTAL_FRAMES - 1, idx));
  });

  const progressPercent = useMemo(
    () => Math.round((loadedCount / TOTAL_FRAMES) * 100),
    [loadedCount],
  );

  useEffect(() => {
    let isMounted = true;
    const loaded: (HTMLImageElement | null)[] = new Array(TOTAL_FRAMES).fill(null);

    for (let i = 0; i < TOTAL_FRAMES; i += 1) {
      const img = new Image();
      img.decoding = "async";
      const candidates = frameCandidates(i);
      let candidateIndex = 0;
      const tryNext = () => {
        if (candidateIndex >= candidates.length) {
          if (!isMounted) return;
          setLoadedCount((c) => c + 1);
          setErroredCount((c) => c + 1);
          return;
        }
        img.src = `${FRAME_BASE}/${candidates[candidateIndex]}`;
        candidateIndex += 1;
      };
      img.onload = () => {
        if (!isMounted) return;
        loaded[i] = img;
        setLoadedCount((c) => c + 1);
      };
      img.onerror = () => {
        if (!isMounted) return;
        tryNext();
      };
      tryNext();
    }

    setImages(loaded);

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const drawFrame = (frameIdx: number) => {
      const image = images[frameIdx];
      if (!image || !image.complete) return;

      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;

      ctx.fillStyle = "#ececec";
      ctx.fillRect(0, 0, viewportW, viewportH);

      const scale = Math.min(viewportW / image.width, viewportH / image.height);
      const drawW = image.width * scale;
      const drawH = image.height * scale;
      const x = (viewportW - drawW) / 2;
      const y = (viewportH - drawH) / 2;

      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, x, y, drawW, drawH);
      lastDrawnRef.current = frameIdx;
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawFrame(lastDrawnRef.current >= 0 ? lastDrawnRef.current : 0);
    };

    const unsubscribe = currentFrame.on("change", (idx) => {
      if (idx === lastDrawnRef.current) return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => drawFrame(idx));
    });

    resize();
    window.addEventListener("resize", resize);

    return () => {
      unsubscribe();
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [currentFrame, images]);

  const ready = loadedCount >= TOTAL_FRAMES;

  return (
    <section ref={containerRef} className="relative h-[400vh]">
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden bg-fog">
        <canvas ref={canvasRef} className="h-screen w-full" />

        {!ready && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-fog/90">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-black/15 border-t-black/70" />
            <p className="mt-4 text-sm tracking-tight text-black/60">Loading WpDev sequence… {progressPercent}%</p>
          </div>
        )}

        {ready && erroredCount > 0 && (
          <div className="absolute bottom-5 z-20 rounded-md bg-black/5 px-4 py-2 text-xs text-black/70">
            Some frames failed to load ({erroredCount}/{TOTAL_FRAMES}).
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 z-10">
          {beats.map((beat) => (
            <StoryBeat key={beat.title} {...beat} scrollYProgress={scrollYProgress} />
          ))}
        </div>
      </div>
    </section>
  );
}

type StoryBeatProps = {
  title: string;
  subtitle: string;
  start: number;
  end: number;
  align: "left" | "center" | "right";
  scrollYProgress: MotionValue<number>;
};

function StoryBeat({ title, subtitle, start, end, align, scrollYProgress }: StoryBeatProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const unsub = scrollYProgress.on("change", (v) => {
      setActive(v >= start && v <= end);
    });
    return () => unsub();
  }, [end, scrollYProgress, start]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: active ? 1 : 0, y: active ? 0 : 10 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={`absolute inset-x-0 mx-auto flex max-w-6xl px-6 md:px-10 ${alignClass(align)} ${align === "center" ? "top-[12%]" : "top-[18%]"}`}
    >
      <div className="max-w-xl">
        <h2 className="text-3xl font-medium tracking-tight text-black/90 md:text-5xl">{title}</h2>
        <p className="mt-2 text-sm tracking-tight text-black/60 md:text-base">{subtitle}</p>
      </div>
    </motion.div>
  );
}
