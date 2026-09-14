import { useSiteContent } from "../../content/useSiteContent";
import { Reveal } from "../../components/Reveal/Reveal";
import "./About.css";

export function About() {
  const { section } = useSiteContent();
  const about = section("about");
  const stats = about.cards ?? [];

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
                key={i}
                className="about__stat"
                variant="up"
                delay={70 * i}
              >
                <span className="about__stat-icon">
                  {stat.iconSrc && <img src={stat.iconSrc} alt="" width={26} height={26} />}
                </span>
                <div className="about__stat-body">
                  <span className="about__stat-index">{String(i + 1).padStart(2, '0')}</span>
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
