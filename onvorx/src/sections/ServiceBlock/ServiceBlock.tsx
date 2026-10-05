import { useLocation } from "react-router-dom";
import { useI18n } from "../../i18n/i18n";
import { useEstimateForm } from "../../components/EstimateForm/useEstimateForm";
import { Reveal } from "../../components/Reveal/Reveal";
import type { ServiceBlockConfig } from "../../data/servicesPage";
import "./ServiceBlock.css";

interface Feature {
  title: string;
  text: string;
}

interface Track {
  label: string;
  title: string;
  features: Feature[];
}

interface ServiceContent {
  title: string;
  body: string;
  tags: string[];
  cta: string;
  pictureAlt?: string;
  features?: Feature[];
  tracks?: Track[];
  get?: { title: string; text: string };
}

interface FeatureListProps {
  features: Feature[];
  icons: string[];
  /** index of this list's first feature in the block-wide icon list */
  iconOffset: number;
  headingLevel: "h3" | "h4";
}

function FeatureList({ features, icons, iconOffset, headingLevel: Heading }: FeatureListProps) {
  return (
    <ul className="service-block__features">
      {features.map((feature, i) => {
        const icon = icons[iconOffset + i];
        return (
          <Reveal as="li" key={i} className="service-block__feature" variant="up" delay={50 * i}>
            <span className="service-block__feature-icon" aria-hidden="true">
              {icon && <img src={icon} alt="" />}
            </span>
            <div className="service-block__feature-body">
              <Heading className="service-block__feature-title">{feature.title}</Heading>
              <p className="service-block__feature-text">{feature.text}</p>
            </div>
          </Reveal>
        );
      })}
    </ul>
  );
}

export function ServiceBlock({ config }: { config: ServiceBlockConfig }) {
  const { t, tx } = useI18n();
  const { open } = useEstimateForm();
  const { pathname } = useLocation();
  const content = tx<ServiceContent>(`servicesPage.${config.contentKey}`);
  const { id, theme, picture } = config;
  const titleId = `${id}-title`;

  // each track continues the block-wide icon list where the previous one ended
  const trackOffsets = (content.tracks ?? []).map((_, i, tracks) =>
    tracks.slice(0, i).reduce((sum, tr) => sum + tr.features.length, 0),
  );

  return (
    <section
      className={`section service-block ${id}`}
      data-theme={theme}
      id={id}
      aria-labelledby={titleId}
    >
      <div className={`${id}__container`}>
        <div className={`service-block__inner${picture ? "" : " service-block__inner--no-picture"}`}>
          <Reveal className="service-block__intro" variant="up">
            <div className="service-block__head">
              <img
                className="service-block__badge"
                src={config.badge}
                alt=""
                width={64}
                height={64}
                loading="lazy"
                decoding="async"
              />
              <span className="service-block__label">
                {config.number} / {t("servicesPage.serviceLabel")}
              </span>
            </div>
            <h2 className="service-block__title" id={titleId}>
              {content.title}
            </h2>
            <p className="service-block__description">{content.body}</p>
            <ul className="service-block__tags">
              {content.tags.map((tag) => (
                <li key={tag} className="service-block__tag">
                  {tag}
                </li>
              ))}
            </ul>
            <button type="button" className="service-block__cta" onClick={() => open(pathname)}>
              {content.cta}
              <img
                className="service-block__cta-arrow"
                src="/assets/services-page/icons/btn-arrow.svg"
                alt=""
              />
            </button>
          </Reveal>

          {picture && (
            <Reveal className="service-block__picture" variant="fade" delay={120}>
              <img
                src={picture.src}
                alt={content.pictureAlt ?? ""}
                width={picture.width}
                height={picture.height}
                loading="lazy"
                decoding="async"
              />
            </Reveal>
          )}

          <div className="service-block__body">
            {content.tracks ? (
              <div className="service-block__tracks">
                {content.tracks.map((track, i) => (
                  <div className="service-block__track" key={i}>
                    <h3 className="service-block__track-head">
                      <span className="service-block__track-label">{track.label}</span>
                      <span className="service-block__track-title">{track.title}</span>
                    </h3>
                    <FeatureList
                      features={track.features}
                      icons={config.featureIcons}
                      iconOffset={trackOffsets[i]}
                      headingLevel="h4"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <FeatureList
                features={content.features ?? []}
                icons={config.featureIcons}
                iconOffset={0}
                headingLevel="h3"
              />
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
