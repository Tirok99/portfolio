import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "target"
  | "users"
  | "document"
  | "sitemap"
  | "check-circle"
  | "code-window"
  | "wrench"
  | "bar-chart"
  | "doc-search"
  | "checklist"
  | "headset"
  | "calendar"
  | "folder"
  | "mail"
  | "telegram"
  | "chevron-right"
  | "arrow-right"
  | "lock"
  | "menu"
  | "close";

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number | string;
  title?: string;
}

/* All glyphs authored on a 24×24 grid, stroke-based, inherit `currentColor`. */
const PATHS: Record<IconName, ReactNode> = {
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.4" />
      <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="7.5" r="3.6" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M15.5 4.4a3.6 3.6 0 0 1 0 6.9M17 20a6.5 6.5 0 0 0-3-5.5" />
    </>
  ),
  document: (
    <>
      <path d="M6 2.5h7l5 5V21.5H6z" />
      <path d="M13 2.5v5h5" />
      <path d="M9 12.5h6M9 16h6M9 8.9h2" />
    </>
  ),
  sitemap: (
    <>
      <rect x="9" y="2.5" width="6" height="5" rx="1.4" />
      <rect x="2.5" y="16.5" width="6" height="5" rx="1.4" />
      <rect x="9" y="16.5" width="6" height="5" rx="1.4" />
      <rect x="15.5" y="16.5" width="6" height="5" rx="1.4" />
      <path d="M12 7.5v4M5.5 16.5v-3a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v3M12 12.5v4" />
    </>
  ),
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M7.5 12.2l3.2 3.2 6.1-6.6" />
    </>
  ),
  "code-window": (
    <>
      <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
      <path d="M2.5 8.5h19" />
      <path d="M9.5 12l-2.2 2.4 2.2 2.4M14.5 12l2.2 2.4-2.2 2.4" />
    </>
  ),
  wrench: (
    <>
      <path d="M15.4 6.6a4.6 4.6 0 0 1-6 6L4 18l2 2 5.4-5.4a4.6 4.6 0 0 0 6-6l-2.6 2.6-2.4-.6-.6-2.4z" />
    </>
  ),
  "bar-chart": (
    <>
      <path d="M4 20h16" />
      <rect x="5" y="12" width="3.4" height="6" rx="1" />
      <rect x="10.3" y="8" width="3.4" height="10" rx="1" />
      <rect x="15.6" y="4.5" width="3.4" height="13.5" rx="1" />
    </>
  ),
  "doc-search": (
    <>
      <path d="M6 2.5h8l4 4V15" />
      <path d="M14 2.5v4h4" />
      <path d="M6 2.5V21.5h7" />
      <circle cx="15.5" cy="16.5" r="3.2" />
      <path d="M17.9 18.9L21 22" />
    </>
  ),
  checklist: (
    <>
      <rect x="4.5" y="3.5" width="15" height="17" rx="2" />
      <rect x="9" y="1.8" width="6" height="3.4" rx="1.2" />
      <path d="M7.8 9.2l1.4 1.4 2.4-2.6M14 9.5h3M7.8 14.4l1.4 1.4 2.4-2.6M14 14.7h3" />
    </>
  ),
  headset: (
    <>
      <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
      <rect x="2.5" y="12.5" width="4" height="7" rx="1.6" />
      <rect x="17.5" y="12.5" width="4" height="7" rx="1.6" />
      <path d="M19.5 19.5v1a3 3 0 0 1-3 3H13" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 10h17M8 2.5v4M16 2.5v4" />
      <path d="M7.5 14h1.5M11.5 14H13M15.5 14H17M7.5 17.5h1.5M11.5 17.5H13" />
    </>
  ),
  folder: (
    <>
      <path d="M3 6.5a2 2 0 0 1 2-2h4l2.2 2.4H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  mail: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M3.5 6.5L12 13l8.5-6.5" />
    </>
  ),
  telegram: (
    <>
      <path d="M21.6 4.3 2.9 11.6c-1 .4-1 1.8 0 2.1l4.7 1.5 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.5 4.5 3.3c.7.5 1.6.1 1.8-.7L23 5.6c.2-1-.7-1.7-1.4-1.3Z" />
      <path d="m7.6 15.2 9.6-7.6-6.8 8.9-.1 3.6" />
    </>
  ),
  "chevron-right": <path d="M9 5l7 7-7 7" />,
  "arrow-right": (
    <>
      <path d="M4 12h15" />
      <path d="M13 5l7 7-7 7" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="11" rx="2.5" />
      <path d="M7.5 10.5V7.5a4.5 4.5 0 0 1 9 0v3" />
    </>
  ),
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  close: <path d="M5 5l14 14M19 5L5 19" />,
};

export function Icon({ name, size = 24, title, ...rest }: IconProps) {
  const glyph = PATHS[name];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      {...rest}
    >
      {glyph}
    </svg>
  );
}
