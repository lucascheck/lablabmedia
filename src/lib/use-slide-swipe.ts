import { useRef, useState } from "react";

/**
 * Swipe/arraste horizontal pra navegar entre slides renderizados um por vez
 * (SlideRenderer). Diferente do InstagramMockup, aqui não existe uma "tira"
 * de imagens pra deslocar — então o arraste move só o slide atual, com
 * resistência elástica, e ao soltar decide se troca de slide.
 */
export function useSlideSwipe({
  index,
  total,
  onIndexChange,
  width,
}: {
  index: number;
  total: number;
  onIndexChange: (next: number) => void;
  /** Largura visível do slide, usada pro limite elástico e pro threshold. */
  width: number;
}) {
  const [dragging, setDragging] = useState(false);
  const [dragDx, setDragDx] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const pointerId = useRef<number | null>(null);
  const horizontal = useRef<boolean | null>(null);
  // Flag em ref, não em state: num gesto rápido os eventos podem chegar antes
  // do React re-renderizar, e um guard baseado em state veria valor velho e
  // ignoraria o arraste. O state existe só pra animação.
  const active = useRef(false);
  // Mesma razão: o valor final do arraste é lido no pointerup.
  const dxRef = useRef(0);

  const threshold = Math.max(40, width * 0.18);

  const reset = () => {
    active.current = false;
    dxRef.current = 0;
    pointerId.current = null;
    horizontal.current = null;
    setDragging(false);
    setDragDx(0);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (total <= 1) return;
    active.current = true;
    dxRef.current = 0;
    pointerId.current = e.pointerId;
    startX.current = e.clientX;
    startY.current = e.clientY;
    horizontal.current = null;
    setDragging(true);
    setDragDx(0);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!active.current || pointerId.current !== e.pointerId) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    // Decide uma vez se o gesto é horizontal (swipe) ou vertical (scroll da
    // página) — assim não sequestramos o scroll no celular.
    if (horizontal.current === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      horizontal.current = Math.abs(dx) > Math.abs(dy);
      if (!horizontal.current) {
        reset();
        return;
      }
    }

    // Nas pontas o arraste "resiste" em vez de sair andando à toa.
    const atStart = index === 0 && dx > 0;
    const atEnd = index === total - 1 && dx < 0;
    const limited = atStart || atEnd ? dx * 0.25 : dx;
    const clamped = Math.max(-width, Math.min(width, limited));
    dxRef.current = clamped;
    setDragDx(clamped);
  };

  const finish = () => {
    if (!active.current) return;
    const dx = dxRef.current;
    let next = index;
    if (dx <= -threshold) next = Math.min(total - 1, index + 1);
    else if (dx >= threshold) next = Math.max(0, index - 1);
    reset();
    if (next !== index) onIndexChange(next);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    finish();
  };

  return {
    dragging,
    dragDx,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
