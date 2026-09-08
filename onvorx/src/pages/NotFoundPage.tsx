import { Link } from "react-router-dom";
import { useI18n } from "../i18n/i18n";
import { Icon } from "../components/Icon/Icon";
import "./InfoPage.css";

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <section className="section info-page" data-theme="dark">
      <div className="page__container">
        <div className="info-page__inner">
          <span className="info-page__code">{t("notFound.code")}</span>
          <h1 className="h1 info-page__title">{t("notFound.title")}</h1>
          <p className="info-page__text">{t("notFound.text")}</p>
          <Link to="/" className="link-arrow">
            {t("notFound.back")}
            <Icon name="arrow-right" size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
