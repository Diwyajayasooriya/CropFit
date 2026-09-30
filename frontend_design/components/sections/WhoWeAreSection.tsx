"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/lib/animations";

export default function WhoWeAreSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });

  const teamMembers = [
    "Intelligent Systems Design",
    "Embedded IoT Architecture",
    "Machine Learning & Edge AI",
    "Full-Stack Cloud Integration",
    "Hardware Interface Engineering",
  ];

  return (
    <section
      id="who-we-are"
      ref={sectionRef}
      className="relative py-32 px-6 overflow-hidden"
    >
      {/* Subtle gradient separator */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gn-green/30 to-transparent" />

      <motion.div
        className="max-w-5xl mx-auto"
        variants={staggerContainer}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
      >
        {/* Label */}
        <motion.span
          variants={fadeInUp}
          className="inline-block text-sm font-heading text-gn-amber tracking-[0.2em] uppercase mb-6"
        >
          Who We Are
        </motion.span>

        {/* Headline */}
        <motion.h2
          variants={fadeInUp}
          className="font-heading text-4xl sm:text-5xl md:text-6xl font-bold text-gn-text mb-8 leading-tight"
        >
          Blue
          <span className="text-gn-green">Circle</span>
        </motion.h2>

        {/* Description */}
        <motion.p
          variants={fadeInUp}
          className="text-lg sm:text-xl text-gn-text-muted max-w-3xl leading-relaxed mb-16"
        >
          Five undergraduates in Computer Engineering at the University of
          Peradeniya, building GreenNode — an AI-integrated IoT orchestration
          hub designed to transform greenhouse management from labor-intensive
          guesswork into intelligent, autonomous care.
        </motion.p>

        {/* Expertise chips */}
        <motion.div
          variants={fadeInUp}
          className="flex flex-wrap gap-3"
        >
          {teamMembers.map((expertise) => (
            <div
              key={expertise}
              className={[
                "px-5 py-2.5 rounded-full border border-gn-green/20",
                "bg-gn-green-muted/50 text-gn-text-muted text-sm font-body",
                "transition-all duration-500",
                "hover:border-gn-green/40 hover:text-gn-text hover:bg-gn-green-muted",
              ].join(" ")}
            >
              {expertise}
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
