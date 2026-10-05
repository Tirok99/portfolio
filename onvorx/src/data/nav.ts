export interface NavLink {
  /** i18n key for the label */
  key: string;
  to: string;
}

/** Primary navigation shown in the site header. */
export const MAIN_NAV: NavLink[] = [
  { key: "nav.home", to: "/" },
  { key: "nav.services", to: "/services" },
  { key: "nav.projects", to: "/#projects" },
  { key: "nav.about", to: "/about" },
];

/** Routes that render the generic "coming soon" stub for now. */
export const STUB_ROUTES = ["/about"] as const;
