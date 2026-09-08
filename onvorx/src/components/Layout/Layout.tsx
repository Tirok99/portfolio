import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { DocumentHead } from "../DocumentHead/DocumentHead";
import { SiteHeader } from "../SiteHeader/SiteHeader";
import { SiteFooter } from "../SiteFooter/SiteFooter";
import { EstimateFormProvider } from "../EstimateForm/useEstimateForm";
import { EstimateForm } from "../EstimateForm/EstimateForm";
import { useI18n } from "../../i18n/i18n";
import "./Layout.css";

function useRouteScroll() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, hash]);
}

export function Layout() {
  const { t } = useI18n();
  useRouteScroll();

  return (
    <EstimateFormProvider>
      <DocumentHead />
      <a href="#main" className="skip-link">
        {t("nav.skip")}
      </a>
      <SiteHeader />
      <main id="main">
        <Outlet />
      </main>
      <SiteFooter />
      <EstimateForm />
    </EstimateFormProvider>
  );
}
