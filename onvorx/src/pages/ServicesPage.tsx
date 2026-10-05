import { ServicesHero } from "../sections/ServicesHero/ServicesHero";
import { ServiceBlock } from "../sections/ServiceBlock/ServiceBlock";
import { AiBuild } from "../sections/AiBuild/AiBuild";
import { Cta } from "../sections/Cta/Cta";
import { SERVICE_BLOCKS } from "../data/servicesPage";
import { useSiteContent } from "../content/useSiteContent";

export function ServicesPage() {
  const { svcSection } = useSiteContent();
  const cta = svcSection("svcCta");

  return (
    <>
      <ServicesHero />
      <ServiceBlock config={SERVICE_BLOCKS.webDevelopment} />
      <AiBuild />
      <ServiceBlock config={SERVICE_BLOCKS.websiteSupport} />
      <ServiceBlock config={SERVICE_BLOCKS.businessAnalysis} />
      <ServiceBlock config={SERVICE_BLOCKS.googleAds} />
      <Cta
        content={{ eyebrow: cta.eyebrow, title: cta.title, body: cta.body, ctaLabel: cta.ctaLabel }}
      />
    </>
  );
}
