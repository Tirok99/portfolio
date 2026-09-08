import { Hero } from "../sections/Hero/Hero";
import { Services } from "../sections/Services/Services";
import { Projects } from "../sections/Projects/Projects";
import { HowWork } from "../sections/HowWork/HowWork";
import { About } from "../sections/About/About";
import { Cta } from "../sections/Cta/Cta";

export function HomePage() {
  return (
    <>
      <Hero />
      <Services />
      <Projects />
      <HowWork />
      <About />
      <Cta />
    </>
  );
}
