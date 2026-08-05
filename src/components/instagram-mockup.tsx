import { useState, useRef, useEffect } from "react";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Slide = { id: string; url: string };

type Props = {
  slides: Slide[];
  username: string;
  avatarUrl: string | null;
  caption: string;
  theme: "light" | "dark";
  className?: string;
  /** Controlled index (optional) */
  currentIndex?: number;
  onIndexChange?: (i: number) => void;
};

export function InstagramMockup({
  slides,
  username,
  avatarUrl,
  caption,
  theme,
  className,
  currentIndex,
  onIndexChange,
}: Props) {
  const [internalIdx, setInternalIdx] = useState(0);
  const total = slides.length;
  const rawIdx = currentIndex ?? internalIdx;
  const idx = total > 0 ? Math.max(0, Math.min(total - 1, rawIdx)) : 0;

  const setIdx = (n: number) => {
    const clamped = Math.max(0, Math.min(total - 1, n));
    if (onIndexChange) onIndexChange(clamped);
    if (currentIndex === undefined) setInternalIdx(clamped);
  };

  // Keep internal in sync if controlled value changes from outside
  useEffect(() => {
    if (currentIndex !== undefined) setInternalIdx(currentIndex);
  }, [currentIndex]);

  // If slides count shrinks below idx, snap back
  useEffect(() => {
    if (idx > total - 1 && total > 0) setIdx(total - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const goto = (n: number) => setIdx(n);

  const isDark = theme === "dark";

  // ===== Swipe / drag handling =====
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragDx, setDragDx] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const pointerId = useRef<number | null>(null);
  const axisLocked = useRef<"none" | "x" | "y">("none");
  const widthRef = useRef(0);
  // Flags em ref, não em state: num flick rápido os eventos chegam antes do
  // React re-renderizar, e um guard baseado em state descartaria o gesto.
  const active = useRef(false);
  const dxRef = useRef(0);

  const onPointerDown = (e: React.PointerEvent) => {
    if (total <= 1) return;
    active.current = true;
    dxRef.current = 0;
    pointerId.current = e.pointerId;
    startX.current = e.clientX;
    startY.current = e.clientY;
    axisLocked.current = "none";
    widthRef.current = trackRef.current?.clientWidth ?? 0;
    setDragging(true);
    setDragDx(0);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!active.current || pointerId.current !== e.pointerId) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (axisLocked.current === "none") {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        axisLocked.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (axisLocked.current === "x") {
          // capture so we keep getting events even if pointer leaves
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }
      }
    }

    if (axisLocked.current === "x") {
      e.preventDefault();
      const w = widthRef.current || 1;
      // Limit drag to a single slide width with elastic resistance beyond it
      let next = dx;
      const max = w; // one slide width
      if (next > max) next = max + (next - max) * 0.2;
      if (next < -max) next = -max + (next + max) * 0.2;
      // extra resistance at edges
      if (idx === 0 && next > 0) next = next * 0.35;
      if (idx === total - 1 && next < 0) next = next * 0.35;
      dxRef.current = next;
      setDragDx(next);
    }
  };

  const endDrag = () => {
    if (!active.current) return;
    const w = widthRef.current || 1;
    const threshold = Math.min(80, w * 0.18);
    const dx = dxRef.current;
    let target = idx;
    if (dx <= -threshold) target = idx + 1;
    else if (dx >= threshold) target = idx - 1;
    active.current = false;
    dxRef.current = 0;
    setDragging(false);
    setDragDx(0);
    pointerId.current = null;
    axisLocked.current = "none";
    if (target !== idx) goto(target);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    endDrag();
  };

  return (
    <div
      className={cn(
        "w-full max-w-[420px] mx-auto rounded-xl overflow-hidden shadow-2xl border select-none",
        isDark
          ? "bg-black border-neutral-800 text-white"
          : "bg-white border-neutral-200 text-neutral-900",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full p-[1.5px] bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 shrink-0">
            <div
              className={cn(
                "w-full h-full rounded-full overflow-hidden border-2",
                isDark ? "border-black" : "border-white",
              )}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
              ) : (
                <div
                  className={cn("w-full h-full", isDark ? "bg-neutral-700" : "bg-neutral-200")}
                />
              )}
            </div>
          </div>
          <span className="font-semibold text-sm truncate">{username || "your_username"}</span>
        </div>
        <MoreHorizontal className="h-5 w-5 shrink-0" />
      </div>

      {/* Image area 4:5 with swipe */}
      <div
        ref={trackRef}
        className={cn(
          "relative aspect-[4/5] overflow-hidden touch-pan-y",
          isDark ? "bg-neutral-900" : "bg-neutral-100",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: "pan-y" }}
      >
        {total === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Faça upload de imagens
          </div>
        ) : (
          <>
            {/* Sliding track */}
            <div
              className="absolute inset-0 flex"
              style={{
                transform: `translate3d(calc(${-idx * (100 / total)}% + ${dragDx}px), 0, 0)`,
                transition: dragging ? "none" : "transform 320ms cubic-bezier(0.22, 0.61, 0.36, 1)",
                width: `${total * 100}%`,
              }}
            >
              {slides.map((s, i) => (
                <div key={s.id} className="relative h-full" style={{ width: `${100 / total}%` }}>
                  <img
                    src={s.url}
                    alt={`Slide ${i + 1}`}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    draggable={false}
                  />
                </div>
              ))}
            </div>

            {total > 1 && (
              <div className="absolute top-2.5 right-2.5 bg-black/60 text-white text-xs font-medium rounded-full px-2 py-0.5 backdrop-blur pointer-events-none">
                {idx + 1}/{total}
              </div>
            )}
            {total > 1 && idx > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goto(idx - 1);
                }}
                className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-neutral-900 items-center justify-center shadow hover:bg-white z-10"
                aria-label="Anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {total > 1 && idx < total - 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goto(idx + 1);
                }}
                className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-neutral-900 items-center justify-center shadow hover:bg-white z-10"
                aria-label="Próximo"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between px-3 pt-2.5">
        <div className="flex items-center gap-3.5">
          <Heart className="h-6 w-6" strokeWidth={1.8} />
          <MessageCircle className="h-6 w-6" strokeWidth={1.8} />
          <Send className="h-6 w-6" strokeWidth={1.8} />
        </div>
        {total > 1 && (
          <div className="flex items-center gap-1">
            {Array.from({ length: total }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goto(i)}
                aria-label={`Ir para slide ${i + 1}`}
                className={cn(
                  "rounded-full transition-all",
                  i === idx
                    ? "w-1.5 h-1.5 bg-sky-500"
                    : isDark
                      ? "w-1.5 h-1.5 bg-neutral-600"
                      : "w-1.5 h-1.5 bg-neutral-300",
                )}
              />
            ))}
          </div>
        )}
        <Bookmark className="h-6 w-6" strokeWidth={1.8} />
      </div>

      {/* Likes + caption */}
      <div className="px-3 pt-2 pb-3 text-sm">
        <div className="font-semibold">1.234 curtidas</div>
        {caption && (
          <div className="mt-0.5 leading-snug">
            <span className="font-semibold mr-1.5">{username || "your_username"}</span>
            <span className="whitespace-pre-wrap">{caption}</span>
          </div>
        )}
        <div
          className={cn(
            "mt-1 text-xs uppercase tracking-wide",
            isDark ? "text-neutral-500" : "text-neutral-400",
          )}
        >
          há 2 minutos
        </div>
      </div>
    </div>
  );
}
