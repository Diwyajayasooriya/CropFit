import type { Transition, Variants } from "framer-motion";

// ── Easing Presets ──
export const easeGN: [number, number, number, number] = [0.4, 0, 0.2, 1];
export const easeGNSlow: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

// ── Transition Presets ──
export const transitionSlow: Transition = {
  duration: 1.0,
  ease: easeGNSlow,
};

export const transitionMedium: Transition = {
  duration: 0.6,
  ease: easeGN,
};

export const transitionFast: Transition = {
  duration: 0.4,
  ease: easeGN,
};

// ── Common Variants ──
export const fadeInUp: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitionSlow,
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: transitionSlow,
  },
};

export const slideInRight: Variants = {
  hidden: {
    opacity: 0,
    x: 60,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitionMedium,
  },
  exit: {
    opacity: 0,
    x: -40,
    transition: transitionFast,
  },
};

export const slideInLeft: Variants = {
  hidden: {
    opacity: 0,
    x: -60,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitionMedium,
  },
  exit: {
    opacity: 0,
    x: 40,
    transition: transitionFast,
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

export const scaleIn: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transitionSlow,
  },
};
