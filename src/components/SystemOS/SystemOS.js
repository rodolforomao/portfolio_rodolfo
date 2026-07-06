import React from "react";
import Hero from "./Hero";
import Terminal from "./Terminal";
import StatsPanel from "./StatsPanel";
import Timeline from "./Timeline";
import Lab from "./Lab";
import ChallengeArena from "./ChallengeArena";
import DeveloperMode from "./DeveloperMode";
import "./SystemOS.css";

// Shell da seção /system (Web OS). Fases 1-4 completas.
function SystemOS() {
  return (
    <div className="system-os">
      <Hero />
      <section className="system-os-section">
        <Terminal />
      </section>
      <section className="system-os-section">
        <StatsPanel />
      </section>
      <section className="system-os-section">
        <Timeline />
      </section>
      <section className="system-os-section">
        <Lab />
      </section>
      <section className="system-os-section">
        <ChallengeArena />
      </section>
      <DeveloperMode />
    </div>
  );
}

export default SystemOS;
