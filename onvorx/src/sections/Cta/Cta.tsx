import { useLocation } from "react-router-dom";
import { useSiteContent } from "../../content/useSiteContent";
import { useEstimateForm } from "../../components/EstimateForm/useEstimateForm";
import { Icon } from "../../components/Icon/Icon";
import { Reveal } from "../../components/Reveal/Reveal";
import "./Cta.css";

export function Cta() {
  const { section } = useSiteContent();
  const cta = section("cta");
  const { open } = useEstimateForm();
  const { pathname } = useLocation();

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
            <span className="eyebrow">{cta.eyebrow}</span>
            <h2 className="h2 cta__title">{cta.title}</h2>
            <span className="cta__dash" aria-hidden="true" />
            <p className="cta__description">{cta.body}</p>
            <button
              type="button"
              className="btn cta__button"
              onClick={() => open(pathname)}
            >
              {cta.ctaLabel}
              <Icon name="arrow-right" size={16} className="btn__arrow" />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
