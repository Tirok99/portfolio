import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useI18n } from "../../i18n/i18n";
import { MAIN_NAV } from "../../data/nav";
import { Logo } from "../Logo/Logo";
import { LangSwitch } from "../LangSwitch/LangSwitch";
import { Icon } from "../Icon/Icon";
import { useEstimateForm } from "../EstimateForm/useEstimateForm";
import "./SiteHeader.css";

export function SiteHeader() {
  const { t } = useI18n();
  const location = useLocation();
  const { open } = useEstimateForm();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // close the drawer on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    document.body.classList.toggle("no-scroll", menuOpen);
    return () => document.body.classList.remove("no-scroll");
  }, [menuOpen]);

  return (
    <header
      className={`site-header ${scrolled ? "is-scrolled" : ""} ${menuOpen ? "is-open" : ""}`}
      data-theme="dark"
    >
      <div className="site-header__container">
        <div className="site-header__bar">
          <Link to="/" className="site-header__logo" aria-label="ONVORX — home">
            <Logo />
          </Link>

          <nav className="site-header__nav" aria-label={t("nav.menu")}>
            <ul className="site-header__nav-list">
              {MAIN_NAV.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="site-header__nav-link">
                    {t(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="site-header__actions">
            <button
              type="button"
              className="btn btn--outline site-header__cta"
              onClick={() => open(location.pathname)}
            >
              {t("nav.cta")}
            </button>
            <LangSwitch className="site-header__lang" />
            <button
              type="button"
              className="site-header__burger"
              aria-expanded={menuOpen}
              aria-controls="site-menu"
              aria-label={menuOpen ? t("nav.close") : t("nav.menu")}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Icon name={menuOpen ? "close" : "menu"} size={24} />
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <>
          <div id="site-menu" className="site-header__drawer">
            <nav aria-label={t("nav.menu")}>
              <ul className="site-header__drawer-list">
                <li>
                  <Link to="/" className="site-header__drawer-link">
                    {t("nav.home")}
                  </Link>
                </li>
                {MAIN_NAV.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} className="site-header__drawer-link">
                      {t(item.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <button
              type="button"
              className="btn site-header__drawer-cta"
              onClick={() => open(location.pathname)}
            >
              {t("nav.cta")}
            </button>
            <LangSwitch className="site-header__drawer-lang" />
          </div>

          <button
            type="button"
            className="site-header__scrim"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setMenuOpen(false)}
          />
        </>
      )}
    </header>
  );
}
