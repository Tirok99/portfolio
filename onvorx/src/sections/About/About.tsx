import { useI18n } from "../../i18n/i18n";
import { useSiteContent } from "../../content/useSiteContent";
import { Icon, type IconName } from "../../components/Icon/Icon";
import { Reveal } from "../../components/Reveal/Reveal";
import "./About.css";

interface Stat {
  index: string;
  title: string;
  text: string;
}

const STAT_ICONS: IconName[] = ["calendar", "folder", "doc-search"];

export function About() {
  const { tx } = useI18n();
  const { section } = useSiteContent();
  const about = section("about");
  const stats = tx<Stat[]>("about.stats");

  return (
    <section className="section about" data-theme="light" id="about">
      <div className="about__container">
        <div className="about__inner">
          <Reveal className="about__intro" variant="left">
            <span className="eyebrow">{about.eyebrow}</span>
            <h2 className="h2 about__title">{about.title}</h2>
            <span className="about__dash" aria-hidden="true" />
            <p className="about__description">{about.body}</p>
          </Reveal>

          <ul className="about__stats">
            {stats.map((stat, i) => (
              <Reveal
                as="li"
                key={stat.index}
                className="about__stat"
                variant="up"
                delay={70 * i}
              >
                <span className="about__stat-icon">
                  <Icon name={STAT_ICONS[i]} size={26} />
                </span>
                <div className="about__stat-body">
                  <span className="about__stat-index">{stat.index}</span>
                  <h3 className="about__stat-title">{stat.title}</h3>
                  <p className="about__stat-text">{stat.text}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
