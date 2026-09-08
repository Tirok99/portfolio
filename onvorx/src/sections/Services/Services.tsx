import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/i18n";
import { useSiteContent } from "../../content/useSiteContent";
import { Icon } from "../../components/Icon/Icon";
import { Reveal } from "../../components/Reveal/Reveal";
import "./Services.css";

interface ServiceItem {
  id: string;
  title: string;
  text: string;
  featured?: boolean;
  /** optional CMS overrides; otherwise resolved from the known slug map */
  icon?: string;
  preview?: string;
}

/** design assets keyed by service slug */
const ASSETS: Record<string, { icon: string; preview: string }> = {
  "web-development": {
    icon: "/assets/services/icon-web.png",
    preview: "/assets/services/preview-web.png",
  },
  support: {
    icon: "/assets/services/icon-support.png",
    preview: "/assets/services/preview-support.png",
  },
  "business-analysis": {
    icon: "/assets/services/icon-analysis.png",
    preview: "/assets/services/preview-analysis.png",
  },
  "google-ads": {
    icon: "/assets/services/icon-ads.png",
    preview: "/assets/services/preview-ads.png",
  },
};
const FALLBACK = ASSETS["web-development"];

export function Services() {
  const { t, tx } = useI18n();
  const { section } = useSiteContent();
  const services = section("services");
  const items = tx<ServiceItem[]>("services.items");

  return (
    <section className="section services" data-theme="dark" id="services">
      <div className="services__container">
        <div className="services__inner">
          <Reveal className="services__header" variant="up">
            <span className="eyebrow eyebrow--stacked services__eyebrow">
              <span>{services.eyebrow}</span>
              <span className="eyebrow__line" />
            </span>
            <h2 className="h2 services__title">{services.title}</h2>
            <p className="services__description">{services.body}</p>
          </Reveal>

          <div className="services__body">
            <div className="services__hub" aria-hidden="true">
              <img src="/assets/services/hub.png" alt="" loading="lazy" decoding="async" />
            </div>

            <ul className="services__grid">
              {items.map((item, i) => {
                const assets = ASSETS[item.id] ?? FALLBACK;
                return (
                  <Reveal
                    as="li"
                    key={item.id}
                    className="services__cell"
                    variant={i % 2 === 0 ? "left" : "right"}
                    delay={(i % 2) * 90}
                  >
                    <article
                      className={`services__card ${item.featured ? "services__card--featured" : ""}`}
                    >
                      <div className="services__card-content">
                        <div className="services__card-head">
                          <img
                            className="services__card-icon"
                            src={item.icon || assets.icon}
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                          <h3 className="services__card-title">{item.title}</h3>
                        </div>
                        <p className="services__card-text">{item.text}</p>
                        <Link to={`/${item.id}`} className="link-arrow services__card-link">
                          {t("services.linkLabel")}
                          <Icon name="arrow-right" size={15} />
                        </Link>
                      </div>
                      <img
                        className="services__card-preview"
                        src={item.preview || assets.preview}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    </article>
                  </Reveal>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      <div className="services__wave" aria-hidden="true">
        <img src="/assets/decor/wave-particles-tight.png" alt="" loading="lazy" decoding="async" />
      </div>
    </section>
  );
}
