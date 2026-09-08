import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/i18n";
import { Icon } from "../../components/Icon/Icon";
import { Reveal } from "../../components/Reveal/Reveal";
import "./Projects.css";

interface ProjectItem {
  id: string;
  index: string;
  title: string;
  tags: string[];
  text: string;
  /** absolute URL (Supabase Storage) or repo path; falls back to /assets/projects/<id>.png */
  image?: string;
  imageAlt: string;
}

const projectImage = (item: ProjectItem) =>
  item.image || `/assets/projects/${item.id}.png`;

export function Projects() {
  const { t, tx } = useI18n();
  const items = tx<ProjectItem[]>("projects.items");

  return (
    <section className="section projects" data-theme="light" id="projects">
      <div className="projects__container">
        <div className="projects__inner">
          <Reveal className="projects__header" variant="up">
            <div className="projects__intro">
              <span className="eyebrow eyebrow--stacked">
                <span>{t("projects.eyebrow")}</span>
                <span className="eyebrow__line" />
              </span>
              <h2 className="h2 projects__title">{t("projects.title")}</h2>
            </div>
            <p className="projects__lede">{t("projects.lede")}</p>
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
                    <img
                      src={projectImage(item)}
                      alt={item.imageAlt}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="projects__content">
                    <span className="projects__index">{item.index}</span>
                    <h3 className="projects__project-title">{item.title}</h3>
                    <p className="projects__tags">
                      {item.tags.map((tag, k) => (
                        <span key={tag}>
                          {k > 0 && <span className="projects__tag-sep">•</span>}
                          {tag}
                        </span>
                      ))}
                    </p>
                    <p className="projects__text">{item.text}</p>
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
