import { useI18n } from "../../i18n/i18n";
import { useSiteContent } from "../../content/useSiteContent";
import { AI_BUILD_MOCKUPS } from "../../data/servicesPage";
import { Reveal } from "../../components/Reveal/Reveal";
import "./AiBuild.css";

const ASSETS = "/assets/services-page";

export function AiBuild() {
  const { t } = useI18n();
  const { svcSection } = useSiteContent();
  const ai = svcSection("svcAiBuild");
  const mockups = (["site", "admin", "bot"] as const).map((slot) => ({
    slot,
    src: ai.images[slot],
    // only the built-in files have known dimensions; uploads keep CSS sizing
    size: ai.images[slot] === AI_BUILD_MOCKUPS[slot].src ? AI_BUILD_MOCKUPS[slot] : undefined,
  }));

  return (
    <section className="section ai-build" data-theme="dark" id="ai-build" aria-labelledby="ai-build-title">
      <div className="ai-build__container">
        <div className="ai-build__inner">
          <Reveal className="ai-build__content" variant="up">
            <div className="ai-build__badge-row">
              {ai.eyebrow && <span className="ai-build__pill">{ai.eyebrow}</span>}
              <h2 className="ai-build__title" id="ai-build-title">
                {ai.title}
              </h2>
            </div>
            <p className="ai-build__description">{ai.body}</p>
            <p className="ai-build__stack">
              {/* separator lives inside the item it follows, so a wrap never
                  starts a line with "/" */}
              {ai.stack.map((item, i) => (
                <span key={i} className="ai-build__stack-item">
                  {item}
                  {i < ai.stack.length - 1 && (
                    <span className="ai-build__stack-sep" aria-hidden="true">
                      /
                    </span>
                  )}
                </span>
              ))}
            </p>
            {/* TODO: point at the AI Build case study once the projects pages exist */}
            <a className="ai-build__link" href="#ai-build">
              {ai.ctaLabel}
              <img className="ai-build__link-arrow" src={`${ASSETS}/icons/link-arrow.svg`} alt="" />
            </a>
          </Reveal>

          <Reveal
            className="ai-build__mockups"
            variant="fade"
            delay={120}
          >
            <div role="img" aria-label={t("servicesPage.aiBuild.mockupsAlt")} className="ai-build__stage">
              {mockups.map(
                (m) =>
                  m.src && (
                    <img
                      key={m.slot}
                      className={`ai-build__mockup ai-build__mockup--${m.slot}`}
                      src={m.src}
                      alt=""
                      {...(m.size ? { width: m.size.width, height: m.size.height } : {})}
                      loading="lazy"
                      decoding="async"
                    />
                  ),
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
