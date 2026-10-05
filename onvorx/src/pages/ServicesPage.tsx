import { useI18n } from "../i18n/i18n";
import { ServicesHero } from "../sections/ServicesHero/ServicesHero";
import { ServiceBlock } from "../sections/ServiceBlock/ServiceBlock";
import { AiBuild } from "../sections/AiBuild/AiBuild";
import { Cta } from "../sections/Cta/Cta";
import { SERVICE_BLOCKS } from "../data/servicesPage";

export function ServicesPage() {
  const { t } = useI18n();

  return (
    <>
      <ServicesHero />
      <ServiceBlock config={SERVICE_BLOCKS.webDevelopment} />
      <AiBuild />
      <ServiceBlock config={SERVICE_BLOCKS.websiteSupport} />
      <ServiceBlock config={SERVICE_BLOCKS.businessAnalysis} />
      <ServiceBlock config={SERVICE_BLOCKS.googleAds} />
      <Cta
        content={{
          eyebrow: t("servicesPage.cta.eyebrow"),
          title: t("servicesPage.cta.title"),
          body: t("servicesPage.cta.body"),
          ctaLabel: t("servicesPage.cta.button"),
        }}
      />
    </>
  );
}
