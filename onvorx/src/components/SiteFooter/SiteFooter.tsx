import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/i18n";
import { Logo } from "../Logo/Logo";
import { Icon } from "../Icon/Icon";
import "./SiteFooter.css";

interface FooterLink {
  label: string;
  to: string;
}

export function SiteFooter() {
  const { t, tx } = useI18n();
  const navLinks = tx<FooterLink[]>("footer.nav");
  const serviceLinks = tx<FooterLink[]>("footer.services");

  const renderList = (links: FooterLink[]) =>
    links.map((link) => (
      <li key={link.label + link.to} className="site-footer__link-item">
        <Link to={link.to} className="site-footer__link">
          <span>{link.label}</span>
          <Icon name="chevron-right" size={14} className="site-footer__chevron" />
        </Link>
      </li>
    ));

  return (
    <footer className="site-footer" data-theme="dark">
      <div className="site-footer__decor" aria-hidden="true">
        <img
          src="/assets/decor/wave-particles-tight.png"
          alt=""
          loading="lazy"
          decoding="async"
        />
      </div>

      <div className="site-footer__container">
        <div className="site-footer__inner">
          <div className="site-footer__top">
            <div className="site-footer__brand">
              <Link to="/" aria-label="ONVORX — home">
                <Logo />
              </Link>
              <p className="site-footer__tagline">{t("footer.tagline")}</p>
            </div>

            <nav className="site-footer__col" aria-label={t("footer.navTitle")}>
              <h2 className="site-footer__col-title">{t("footer.navTitle")}</h2>
              <ul className="site-footer__links">{renderList(navLinks)}</ul>
            </nav>

            <nav className="site-footer__col" aria-label={t("footer.servicesTitle")}>
              <h2 className="site-footer__col-title">{t("footer.servicesTitle")}</h2>
              <ul className="site-footer__links">{renderList(serviceLinks)}</ul>
            </nav>

            <div className="site-footer__contact">
              <span className="site-footer__contact-divider" aria-hidden="true" />
              <ul className="site-footer__contact-list">
                <li>
                  <a href={`mailto:${t("footer.email")}`} className="site-footer__contact-item">
                    <span className="site-footer__contact-icon">
                      <Icon name="mail" size={18} />
                    </span>
                    {t("footer.email")}
                  </a>
                </li>
                <li>
                  <a
                    href={t("footer.telegramHref")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="site-footer__contact-item"
                  >
                    <span className="site-footer__contact-icon">
                      <Icon name="telegram" size={18} />
                    </span>
                    {t("footer.telegram")}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="site-footer__bottom">
            <p className="site-footer__copyright">{t("footer.copyright")}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
