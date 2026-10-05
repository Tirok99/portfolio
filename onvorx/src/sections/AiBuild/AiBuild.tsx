import { useI18n } from "../../i18n/i18n";
import { Reveal } from "../../components/Reveal/Reveal";
import "./AiBuild.css";

const ASSETS = "/assets/services-page";

export function AiBuild() {
  const { t, tx } = useI18n();
  const stack = tx<string[]>("servicesPage.aiBuild.stack") ?? [];

  return (
    <section className="section ai-build" data-theme="dark" id="ai-build" aria-labelledby="ai-build-title">
      <div className="ai-build__container">
        <div className="ai-build__inner">
          <Reveal className="ai-build__content" variant="up">
            <div className="ai-build__badge-row">
              <span className="ai-build__pill">{t("servicesPage.aiBuild.badge")}</span>
              <h2 className="ai-build__title" id="ai-build-title">
                {t("servicesPage.aiBuild.title")}
              </h2>
            </div>
            <p className="ai-build__description">{t("servicesPage.aiBuild.body")}</p>
            <p className="ai-build__stack">
              {/* separator lives inside the item it follows, so a wrap never
                  starts a line with "/" */}
              {stack.map((item, i) => (
                <span key={item} className="ai-build__stack-item">
                  {item}
                  {i < stack.length - 1 && (
                    <span className="ai-build__stack-sep" aria-hidden="true">
                      /
                    </span>
                  )}
                </span>
              ))}
            </p>
            {/* TODO: point at the AI Build case study once the projects pages exist */}
            <a className="ai-build__link" href="#ai-build">
              {t("servicesPage.aiBuild.link")}
              <img className="ai-build__link-arrow" src={`${ASSETS}/icons/link-arrow.svg`} alt="" />
            </a>
          </Reveal>

          <Reveal
            className="ai-build__mockups"
            variant="fade"
            delay={120}
          >
            <div role="img" aria-label={t("servicesPage.aiBuild.mockupsAlt")} className="ai-build__stage">
              <img
                className="ai-build__mockup ai-build__mockup--site"
                src={`${ASSETS}/ai-mockup-site.png`}
                alt=""
                width={1357}
                height={931}
                loading="lazy"
                decoding="async"
              />
              <img
                className="ai-build__mockup ai-build__mockup--admin"
                src={`${ASSETS}/ai-mockup-admin.png`}
                alt=""
                width={1107}
                height={497}
                loading="lazy"
                decoding="async"
              />
              <img
                className="ai-build__mockup ai-build__mockup--bot"
                src={`${ASSETS}/ai-mockup-bot.png`}
                alt=""
                width={370}
                height={548}
                loading="lazy"
                decoding="async"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
