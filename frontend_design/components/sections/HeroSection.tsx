"use client";

import { motion } from "framer-motion";
import Button from "@/components/ui/Button";
import { fadeInUp, staggerContainer, fadeIn } from "@/lib/animations";

interface HeroSectionProps {
  onGetStarted: () => void;
}

export default function HeroSection({ onGetStarted }: HeroSectionProps) {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex flex-col items-center justify-center px-6"
    >
      {/* Content overlay — positioned above the 3D canvas */}
      <motion.div
        className="relative z-10 text-center max-w-3xl mx-auto"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* Main headline */}
        <motion.h1
          variants={fadeInUp}
          className="font-heading text-6xl sm:text-7xl md:text-8xl font-bold tracking-tight text-gn-text mb-4"
        >
          GreenNode
          <span className="text-gn-green">.</span>
        </motion.h1>

        {/* Subheading */}
        <motion.p
          variants={fadeInUp}
          className="font-heading text-xl sm:text-2xl md:text-3xl text-gn-text-muted font-light mb-12"
        >
          Let it care. Grow at leisure.
        </motion.p>

        {/* CTA */}
        <motion.div variants={fadeInUp}>
          <Button
            variant="primary"
            size="lg"
            onClick={onGetStarted}
            id="get-started-btn"
          >
            Get Started
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              className="ml-1"
            >
              <path
                d="M6 10H14M14 10L10 6M14 10L10 14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Button>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2"
      >
        <span className="text-xs text-gn-text-dim font-body tracking-widest uppercase">
          Scroll to explore
        </span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-5 h-8 rounded-full border border-gn-text-dim flex items-start justify-center pt-1.5"
        >
          <div className="w-1 h-1.5 rounded-full bg-gn-text-muted" />
        </motion.div>
      </motion.div>
    </section>
  );
}
