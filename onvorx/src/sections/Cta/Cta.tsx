import { useI18n } from "../../i18n/i18n";
import { Icon } from "../../components/Icon/Icon";
import { Reveal } from "../../components/Reveal/Reveal";
import "./Cta.css";

export function Cta() {
  const { t } = useI18n();

  return (
    <section className="section cta" data-theme="dark" id="contact">
      <div className="cta__container">
        <Reveal className="cta__card" variant="up">
          <div className="cta__decor" aria-hidden="true">
            <img
              className="cta__rings"
              src="/assets/decor/rings.png"
              alt=""
              width={1254}
              height={1254}
              decoding="async"
            />
            <img
              className="cta__wave-red"
              src="/assets/decor/wave-red-tight.png"
              alt=""
              loading="lazy"
              decoding="async"
            />
          </div>

          <div className="cta__content">
            <span className="eyebrow">{t("cta.eyebrow")}</span>
            <h2 className="h2 cta__title">{t("cta.title")}</h2>
            <span className="cta__dash" aria-hidden="true" />
            <p className="cta__description">{t("cta.description")}</p>
            <a href="#" className="btn cta__button">
              {t("cta.button")}
              <Icon name="arrow-right" size={16} className="btn__arrow" />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
