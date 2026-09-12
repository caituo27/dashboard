import { useEffect, useRef } from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "framer-motion";

const dashboardTransition = { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

export function DashboardNumber({ value, prefix = "", suffix = "", decimals = 0 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const element = useRef<HTMLSpanElement>(null);
  const visible = useInView(element, { once: true });
  const reducedMotion = useReducedMotion();
  const current = useMotionValue(value);
  const hasAnimated = useRef(false);
  const format = (number: number) => `${prefix}${number.toLocaleString("zh-CN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
  const display = useTransform(current, format);

  useEffect(() => {
    if (!visible || reducedMotion) {
      current.set(value);
      return;
    }
    if (!hasAnimated.current) current.set(0);
    hasAnimated.current = true;
    const animation = animate(current, value, dashboardTransition);
    return () => animation.stop();
  }, [current, value, visible, reducedMotion]);

  return <span ref={element} aria-label={format(value)}><motion.span aria-hidden="true">{display}</motion.span></span>;
}

export function DashboardBar({ ratio, horizontal = false, title }: { ratio: number; horizontal?: boolean; title?: string }) {
  const reducedMotion = useReducedMotion();
  const scale = Math.max(0, Math.min(1, ratio));
  const property = horizontal ? "scaleX" : "scaleY";
  return <motion.div
    className={horizontal ? "dashboard-funnel-fill" : "dashboard-bar"}
    title={title}
    initial={reducedMotion ? false : { [property]: 0 }}
    whileInView={{ [property]: scale }}
    viewport={{ once: true }}
    transition={reducedMotion ? { duration: 0 } : dashboardTransition}
    style={{ height: "100%", ...(horizontal ? { width: "100%" } : {}), transformOrigin: horizontal ? "left center" : "center bottom" }}
  />;
}
