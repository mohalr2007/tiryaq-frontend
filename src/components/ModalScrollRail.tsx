"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";

type Props = {
  targetRef: RefObject<HTMLElement | null>;
  className?: string;
};

export default function ModalScrollRail({ targetRef, className = "" }: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) {
      return;
    }

    const updateState = () => {
      const maxScrollTop = Math.max(target.scrollHeight - target.clientHeight, 0);
      setIsVisible(maxScrollTop > 24);
      setCanScrollUp(target.scrollTop > 8);
      setCanScrollDown(target.scrollTop < maxScrollTop - 8);
      setScrollProgress(maxScrollTop > 0 ? target.scrollTop / maxScrollTop : 0);
    };

    updateState();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateState) : null;

    resizeObserver?.observe(target);
    target.addEventListener("scroll", updateState, { passive: true });
    window.addEventListener("resize", updateState);

    return () => {
      resizeObserver?.disconnect();
      target.removeEventListener("scroll", updateState);
      window.removeEventListener("resize", updateState);
    };
  }, [targetRef]);

  const handleScroll = (direction: "up" | "down") => {
    const target = targetRef.current;
    if (!target) {
      return;
    }

    const scrollAmount = Math.max(target.clientHeight * 0.72, 180);
    target.scrollBy({
      top: direction === "up" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (!isVisible) {
    return null;
  }

  const thumbHeightPercent = 28;
  const thumbTopPercent = scrollProgress * (100 - thumbHeightPercent);

  return (
    <div
      className={`pointer-events-none absolute left-3 top-1/2 z-20 -translate-y-1/2 ${className}`}
      aria-hidden="true"
    >
      <div className="pointer-events-auto flex h-[76%] max-h-[360px] w-11 flex-col items-center rounded-full border border-blue-500/30 bg-[#07112a]/95 p-1.5 shadow-[0_20px_60px_-18px_rgba(37,99,235,0.5)] backdrop-blur-xl">
        <button
          type="button"
          onClick={() => handleScroll("up")}
          disabled={!canScrollUp}
          aria-label="Scroll up"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/18 text-blue-100 transition hover:bg-blue-500/28 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-blue-200/30"
        >
          <ChevronUp size={16} />
        </button>

        <div className="relative my-2 w-3 flex-1 rounded-full bg-white/8">
          <div
            className="absolute left-0.5 right-0.5 rounded-full bg-gradient-to-b from-blue-400 via-blue-500 to-blue-600 shadow-[0_0_18px_rgba(59,130,246,0.55)]"
            style={{ top: `${thumbTopPercent}%`, height: `${thumbHeightPercent}%` }}
          />
        </div>

        <button
          type="button"
          onClick={() => handleScroll("down")}
          disabled={!canScrollDown}
          aria-label="Scroll down"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/18 text-blue-100 transition hover:bg-blue-500/28 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-blue-200/30"
        >
          <ChevronDown size={16} />
        </button>
      </div>
    </div>
  );
}
