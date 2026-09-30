import { create } from "zustand";
import { ONBOARDING_STEPS } from "@/lib/constants";

interface OnboardingState {
  currentStep: number;
  totalSteps: number;
  isComplete: boolean;

  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  reset: () => void;
  complete: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  currentStep: 0,
  totalSteps: ONBOARDING_STEPS.length,
  isComplete: false,

  nextStep: () => {
    const { currentStep, totalSteps } = get();
    if (currentStep < totalSteps - 1) {
      set({ currentStep: currentStep + 1 });
    }
  },

  prevStep: () => {
    const { currentStep } = get();
    if (currentStep > 0) {
      set({ currentStep: currentStep - 1 });
    }
  },

  goToStep: (step) => {
    const { totalSteps } = get();
    if (step >= 0 && step < totalSteps) {
      set({ currentStep: step });
    }
  },

  reset: () => set({ currentStep: 0, isComplete: false }),

  complete: () => set({ isComplete: true }),
}));
