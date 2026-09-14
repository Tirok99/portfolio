import { useLocation } from "react-router-dom";
import { useI18n } from "../../i18n/i18n";
import { useSiteContent } from "../../content/useSiteContent";
import { useEstimateForm } from "../../components/EstimateForm/useEstimateForm";
import { Reveal } from "../../components/Reveal/Reveal";
import "./Hero.css";

export function Hero() {
  const { t } = useI18n();
  const { section } = useSiteContent();
  const { open } = useEstimateForm();
  const { pathname } = useLocation();
  const hero = section("hero");
  const cards = hero.cards;
  const launch = hero.launch;

  return (
    <section className="section hero" data-theme="dark" id="top">
      <div className="hero__decor" aria-hidden="true">
        <img className="hero__wave hero__wave--left" src="/assets/decor/wave-grey-tight.png" alt="" />
      </div>

      <div className="hero__container">
        <div className="hero__inner">
          <div className="hero__body">
            <Reveal className="hero__eyebrow eyebrow eyebrow--stacked" variant="up">
              <span>{hero.eyebrow}</span>
              <span className="eyebrow__line" />
            </Reveal>
            <Reveal as="h1" className="hero__title h1" variant="up" delay={60}>
              {hero.title}
            </Reveal>
            <Reveal as="p" className="hero__description" variant="up" delay={120}>
              {hero.body}
            </Reveal>
            <Reveal variant="up" delay={180}>
              <button
                type="button"
                className="btn hero__cta"
                onClick={() => open(pathname)}
              >
                {hero.ctaLabel}
              </button>
            </Reveal>
          </div>

          <div className="hero__visual">
            <img
              className="hero__radar"
              src="/assets/hero/radar.png"
              alt={t("hero.visualAlt")}
              loading="eager"
              decoding="async"
            />
            <img
              className="hero__central-decor"
              src="/assets/hero/central-decor.png"
              alt={t("hero.visualAlt")}
              loading="lazy"
              decoding="async"
            />

            <ul className="hero__cards">
              {cards.map((card, i) => (
                <Reveal
                  as="li"
                  key={card.title}
                  className="hero__card-cell"
                  variant="left"
                  delay={70 * i}
                >
                  <div className="hero__card">
                    <span className="hero__card-icon">
                      <img src={card.iconSrc} alt="" width={22} height={22} />
                    </span>
                    <span className="hero__card-body">
                      <span className="hero__card-title">{card.title}</span>
                      <span className="hero__card-text">{card.text}</span>
                    </span>
                  </div>
                </Reveal>
              ))}
            </ul>

            <Reveal className="hero__launch" variant="right" delay={260}>
              <span className="hero__launch-icon">
                {launch && <img src={launch.iconSrc} alt="" width={22} height={22} />}
              </span>
              <span className="hero__launch-title">{launch?.title}</span>
              <span className="hero__launch-text">{launch?.text}</span>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
