"use client";
import { useEffect, useRef } from "react";

/** Fixed, decorative scene behind the app: drifting light, a receding checkerboard floor, grain and a pointer spotlight. */
export function Backdrop() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(pointer: coarse)").matches) return;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        element.style.setProperty("--mx", `${event.clientX}px`);
        element.style.setProperty("--my", `${event.clientY}px`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div ref={ref} className="backdrop" aria-hidden="true">
      <div className="backdrop-orb gold" />
      <div className="backdrop-orb teal" />
      <div className="backdrop-orb ember" />
      <div className="backdrop-floor" />
      <div className="backdrop-spotlight" />
      <div className="backdrop-grain" />
    </div>
  );
}
