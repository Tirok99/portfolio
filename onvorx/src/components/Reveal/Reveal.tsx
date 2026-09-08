import { useEffect, useState, type ElementType, type ReactNode } from "react";
import { useReveal } from "../../hooks/useReveal";
import "./Reveal.css";

interface RevealProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** stagger delay in ms */
  delay?: number;
  /** animation direction */
  variant?: "up" | "fade" | "left" | "right";
}

export function Reveal({
  children,
  as: Tag = "div",
  className = "",
  delay = 0,
  variant = "up",
}: RevealProps) {
  const { ref, visible } = useReveal<HTMLElement>();
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!visible || settled) return;
    const id = window.setTimeout(() => setSettled(true), 1000 + delay);
    return () => window.clearTimeout(id);
  }, [visible, settled, delay]);

  return (
    <Tag
      ref={ref}
      className={[
        "reveal",
        `reveal--${variant}`,
        visible && "is-visible",
        settled && "is-settled",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={delay && !settled ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
