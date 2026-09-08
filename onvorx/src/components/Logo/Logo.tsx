import "./Logo.css";

interface LogoProps {
  className?: string;
  /** "white" for dark surfaces (default), "dark" for light surfaces */
  variant?: "white" | "dark";
  label?: string;
}

const SRC: Record<"white" | "dark", string> = {
  white: "/assets/logo-white.png",
  dark: "/assets/logo-dark.png",
};

/**
 * ONVORX wordmark — official asset from the Figma "Logo" frame.
 * The source PNG has generous transparent padding; the wrapper crops to the
 * mark's tight bounding box so it aligns and scales predictably.
 */
export function Logo({ className = "", variant = "white", label = "ONVORX" }: LogoProps) {
  return (
    <span className={`logo ${className}`.trim()} role="img" aria-label={label}>
      <img className="logo__img" src={SRC[variant]} alt="" width={1024} height={682} />
    </span>
  );
}
