import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/i18n";
import { useSiteContent } from "../../content/useSiteContent";
import { Reveal } from "../../components/Reveal/Reveal";
import { SERVICES_HERO_CARDS } from "../../data/servicesPage";
import "./ServicesHero.css";

export function ServicesHero() {
  const { t } = useI18n();
  const { svcSection } = useSiteContent();
  const hero = svcSection("svcHero");

  return (
    <section className="section services-hero" data-theme="dark" id="top">
      <div className="services-hero__container">
        <div className="services-hero__decor" aria-hidden="true">
          <img
            className="services-hero__radar"
            src="/assets/services-page/hero-radar.webp"
            alt=""
            width={1110}
            height={1110}
            loading="eager"
            decoding="async"
          />
          <img
            className="services-hero__wave"
            src="/assets/decor/wave-grey-tight.webp"
            alt=""
            width={1470}
            height={360}
            decoding="async"
          />
        </div>

        <div className="services-hero__inner">
          <div className="services-hero__intro">
            <Reveal className="services-hero__eyebrow" variant="up">
              <span>{hero.eyebrow}</span>
              <span className="services-hero__eyebrow-line" />
            </Reveal>
            <Reveal as="h1" className="services-hero__title" variant="up" delay={60}>
              {hero.title}
            </Reveal>
            <Reveal as="p" className="services-hero__description" variant="up" delay={120}>
              {hero.body}
            </Reveal>
          </div>

          <ul className="services-hero__cards" aria-label={t("servicesPage.hero.cardsLabel")}>
            {SERVICES_HERO_CARDS.map((card, i) => {
              const content = hero.cards[i];
              if (!content) return null;
              return (
                <Reveal
                  as="li"
                  key={card.anchor}
                  className="services-hero__card-cell"
                  variant="up"
                  delay={180 + 70 * i}
                >
                  <Link to={{ hash: `#${card.anchor}` }} className="services-hero__card">
                    <span className="services-hero__card-head">
                      <span className="services-hero__card-icon">
                        {content.iconSrc && <img src={content.iconSrc} alt="" />}
                      </span>
                      <span className="services-hero__card-title">{content.title}</span>
                      <span className="services-hero__card-arrow">
                        <img src="/assets/services-page/icons/hero-arrow.svg" alt="" />
                      </span>
                    </span>
                    <span className="services-hero__card-tags">
                      {content.tags.map((tag, j) => (
                        <span key={j} className="services-hero__card-tag">
                          {tag}
                        </span>
                      ))}
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
