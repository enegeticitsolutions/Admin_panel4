import React from "react";
import HeroSection from "../components/home/HeroSection";
import VideoSection from "../components/home/VideoSection";
import ChallengeSection from "../components/home/ChallengeSection";
import ProcessSection from "../components/home/ProcessSection";
import ServicesSection from "../components/home/ServicesSection";
import TestimonialsSection from "../components/home/TestimonialsSection";
import AppCtaSection from "../components/home/AppCtaSection";
import FaqSection from "../components/home/FaqSection";

/**
 * HomePage Component - Aggregates landing page sections
 */
const HomePage = ({ openForm }) => {
  return (
    <main>
      <HeroSection openForm={openForm} />
      <VideoSection />
      <ChallengeSection />
      <ProcessSection />
      <ServicesSection openForm={openForm} />
      {/* <TestimonialsSection /> */}
      <AppCtaSection />
      <FaqSection />
    </main>
  );
};

export default HomePage;
