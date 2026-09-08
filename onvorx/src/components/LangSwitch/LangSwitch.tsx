import { useI18n, type Lang } from "../../i18n/i18n";
import "./LangSwitch.css";

const OPTIONS: Lang[] = ["en", "uk"];

export function LangSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useI18n();

  return (
    <div
      className={`lang-switch ${className}`.trim()}
      role="group"
      aria-label={t("lang.label")}
    >
      {OPTIONS.map((code, i) => (
        <span key={code} className="lang-switch__item">
          {i > 0 && <span className="lang-switch__sep" aria-hidden="true">|</span>}
          <button
            type="button"
            className={`lang-switch__btn ${lang === code ? "is-active" : ""}`}
            aria-pressed={lang === code}
            onClick={() => setLang(code)}
          >
            {t(`lang.${code}`)}
          </button>
        </span>
      ))}
    </div>
  );
}
