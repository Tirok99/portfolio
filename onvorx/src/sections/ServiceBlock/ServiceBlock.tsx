import { useLocation } from "react-router-dom";
import { useI18n } from "../../i18n/i18n";
import { useSiteContent, type ResolvedSvcCard } from "../../content/useSiteContent";
import { useEstimateForm } from "../../components/EstimateForm/useEstimateForm";
import { Reveal } from "../../components/Reveal/Reveal";
import type { ServiceBlockConfig } from "../../data/servicesPage";
import "./ServiceBlock.css";

function FeatureList({
  features,
  headingLevel: Heading,
}: {
  features: ResolvedSvcCard[];
  headingLevel: "h3" | "h4";
}) {
  return (
    <ul className="service-block__features">
      {features.map((feature, i) => (
        <Reveal as="li" key={i} className="service-block__feature" variant="up" delay={50 * i}>
          <span className="service-block__feature-icon" aria-hidden="true">
            {feature.iconSrc && <img src={feature.iconSrc} alt="" />}
          </span>
          <div className="service-block__feature-body">
            <Heading className="service-block__feature-title">{feature.title}</Heading>
            <p className="service-block__feature-text">{feature.text}</p>
          </div>
        </Reveal>
      ))}
    </ul>
  );
}

export function ServiceBlock({ config }: { config: ServiceBlockConfig }) {
  const { t, tx } = useI18n();
  const { svcSection } = useSiteContent();
  const { open } = useEstimateForm();
  const { pathname } = useLocation();
  const content = svcSection(config.sectionKey);
  const { id, theme } = config;
  const titleId = `${id}-title`;
  const badgeSrc = content.images.badge;
  const pictureSrc = content.images.picture;
  // only the built-in illustration has known dimensions; an upload keeps CSS sizing
  const pictureSize = config.picture && config.picture.src === pictureSrc ? config.picture : undefined;
  const pictureAlt = tx<string | undefined>(`servicesPage.${config.contentKey}.pictureAlt`) ?? "";
  // items are grouped by their own `track`, not by array position
  const tracks = content.tracks.map((head, i) => ({
    ...head,
    features: content.cards.filter((c) => c.track === i),
  }));

  return (
    <section
      className={`section service-block ${id}`}
      data-theme={theme}
      id={id}
      aria-labelledby={titleId}
    >
      <div className={`${id}__container`}>
        <div className={`service-block__inner${pictureSrc ? "" : " service-block__inner--no-picture"}`}>
          <Reveal className="service-block__intro" variant="up">
            <div className="service-block__head">
              {badgeSrc && (
                <img
                  className="service-block__badge"
                  src={badgeSrc}
                  alt=""
                  width={64}
                  height={64}
                  loading="lazy"
                  decoding="async"
                />
              )}
              <span className="service-block__label">
                {config.number} / {t("servicesPage.serviceLabel")}
              </span>
            </div>
            <h2 className="service-block__title" id={titleId}>
              {content.title}
            </h2>
            <p className="service-block__description">{content.body}</p>
            {content.tags.length > 0 && (
              <ul className="service-block__tags">
                {content.tags.map((tag, i) => (
                  <li key={i} className="service-block__tag">
                    {tag}
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="service-block__cta" onClick={() => open(pathname)}>
              {content.ctaLabel}
              <img
                className="service-block__cta-arrow"
                src="/assets/services-page/icons/btn-arrow.svg"
                alt=""
              />
            </button>
          </Reveal>

          {pictureSrc && (
            <Reveal className="service-block__picture" variant="fade" delay={120}>
              <img
                src={pictureSrc}
                alt={pictureAlt}
                {...(pictureSize ? { width: pictureSize.width, height: pictureSize.height } : {})}
                loading="lazy"
                decoding="async"
              />
            </Reveal>
          )}

          <div className="service-block__body">
            {tracks.length > 0 ? (
              <div className="service-block__tracks">
                {tracks.map((track, i) => (
                  <div className="service-block__track" key={i}>
                    <h3 className="service-block__track-head">
                      <span className="service-block__track-label">{track.label}</span>
                      <span className="service-block__track-title">{track.title}</span>
                    </h3>
                    <FeatureList features={track.features} headingLevel="h4" />
                  </div>
                ))}
              </div>
            ) : (
              <FeatureList features={content.cards} headingLevel="h3" />
            )}

            {content.get && (
              <Reveal className="service-block__get" variant="up">
                <p className="service-block__get-eyebrow">{t("servicesPage.whatYouGet")}</p>
                <p className="service-block__get-title">{content.get.title}</p>
                <p className="service-block__get-text">{content.get.text}</p>
              </Reveal>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
