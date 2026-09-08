import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/i18n";
import { useSiteContent } from "../../content/useSiteContent";
import { Icon } from "../../components/Icon/Icon";
import { Reveal } from "../../components/Reveal/Reveal";
import "./Projects.css";

export function Projects() {
  const { t } = useI18n();
  const { section, projectsHome } = useSiteContent();
  const projects = section("projects");
  const items = projectsHome();

  return (
    <section className="section projects" data-theme="light" id="projects">
      <div className="projects__container">
        <div className="projects__inner">
          <Reveal className="projects__header" variant="up">
            <div className="projects__intro">
              <span className="eyebrow eyebrow--stacked">
                <span>{projects.eyebrow}</span>
                <span className="eyebrow__line" />
              </span>
              <h2 className="h2 projects__title">{projects.title}</h2>
            </div>
            <p className="projects__lede">{projects.body}</p>
            <a href="#" className="btn btn--outline projects__view-all">
              {t("projects.viewAll")}
              <Icon name="arrow-right" size={16} className="btn__arrow" />
            </a>
          </Reveal>

          <ul className="projects__list">
            {items.map((item, i) => (
              <Reveal as="li" key={item.id} className="projects__row" variant="up">
                <article
                  className={`projects__item ${i % 2 === 1 ? "projects__item--reverse" : ""}`}
                >
                  <div className="projects__media">
                    {item.imageSrc ? (
                      <img
                        src={item.imageSrc}
                        alt={item.imageAlt}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span className="projects__media-empty" aria-hidden="true" />
                    )}
                  </div>
                  <div className="projects__content">
                    <span className="projects__index">{item.indexLabel}</span>
                    <h3 className="projects__project-title">{item.title}</h3>
                    <p className="projects__tags">
                      {item.tags.map((tag, k) => (
                        <span key={tag}>
                          {k > 0 && <span className="projects__tag-sep">•</span>}
                          {tag}
                        </span>
                      ))}
                    </p>
                    <p className="projects__text">{item.description}</p>
                    <Link to={`/projects/${item.id}`} className="link-arrow">
                      {t("projects.viewProject")}
                      <Icon name="arrow-right" size={15} />
                    </Link>
                  </div>
                </article>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
