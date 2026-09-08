import { useI18n } from "../../i18n/i18n";
import { useSiteContent } from "../../content/useSiteContent";
import { Icon, type IconName } from "../../components/Icon/Icon";
import { Reveal } from "../../components/Reveal/Reveal";
import "./HowWork.css";

interface Step {
  index: string;
  title: string;
  sub: string;
  text: string;
}

const STEP_ICONS: IconName[] = ["doc-search", "checklist", "code-window", "headset"];

export function HowWork() {
  const { tx } = useI18n();
  const { section } = useSiteContent();
  const howWork = section("howWork");
  const steps = tx<Step[]>("howWork.steps");

  return (
    <section className="section how-work" data-theme="dark" id="how-we-work">
      <div className="how-work__container">
        <div className="how-work__inner">
          <Reveal className="how-work__header" variant="up">
            <span className="eyebrow">{howWork.eyebrow}</span>
            <h2 className="h2 how-work__title">{howWork.title}</h2>
            <p className="how-work__description">{howWork.body}</p>
          </Reveal>

          <ol className="how-work__steps">
            <span className="how-work__rail" aria-hidden="true" />
            {steps.map((step, i) => (
              <Reveal
                as="li"
                key={step.index}
                className="how-work__step"
                variant="up"
                delay={70 * i}
              >
                <span className="how-work__number">{step.index}</span>
                <span className="how-work__marker">
                  <Icon name={STEP_ICONS[i]} size={34} />
                </span>
                <h3 className="how-work__step-title">{step.title}</h3>
                <p className="how-work__step-sub">{step.sub}</p>
                <p className="how-work__step-text">{step.text}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>

      <div className="how-work__wave" aria-hidden="true">
        <img src="/assets/decor/wave-particles-tight.png" alt="" loading="lazy" decoding="async" />
      </div>
    </section>
  );
}
