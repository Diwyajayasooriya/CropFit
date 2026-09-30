"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useOnboardingStore } from "@/store/onboardingStore";
import { ONBOARDING_STEPS } from "@/lib/constants";
import ProgressBar from "@/components/ui/ProgressBar";
import OnboardingStep from "@/components/sections/OnboardingStep";
import Button from "@/components/ui/Button";

export default function OnboardingPage() {
  const router = useRouter();
  const { currentStep, nextStep, prevStep, complete } = useOnboardingStore();
  const [direction, setDirection] = useState<number>(1);

  const step = ONBOARDING_STEPS[currentStep] || ONBOARDING_STEPS[0];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      complete();
      router.push("/dashboard");
    } else {
      setDirection(1);
      nextStep();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setDirection(-1);
      prevStep();
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E0D] text-[#E8E6E3] flex flex-col justify-between py-8 px-6 relative overflow-hidden">
      {/* Background ambient lighting effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full bg-[#1B5E3B]/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] rounded-full bg-[#D9A441]/5 blur-[100px] pointer-events-none" />

      {/* Top Header & Progress */}
      <header className="relative z-10 w-full max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#111916] border border-[#1B5E3B]/40 flex items-center justify-center shadow-[0_0_10px_rgba(27,94,59,0.3)]">
              <span className="w-2 h-2 rounded-full bg-[#1B5E3B]" />
            </div>
            <span className="font-heading font-semibold text-base tracking-tight text-[#E8E6E3]">
              GreenNode Setup
            </span>
          </div>

          <button
            onClick={() => {
              complete();
              router.push("/dashboard");
            }}
            className="text-xs font-heading uppercase tracking-widest text-[#8A9A8F] hover:text-[#D9A441] transition-colors"
          >
            Skip to Dashboard →
          </button>
        </div>

        {/* Progress Bar */}
        <div className="pt-2">
          <ProgressBar
            currentStep={currentStep}
            totalSteps={ONBOARDING_STEPS.length}
          />
        </div>
      </header>

      {/* Main Step Content */}
      <main className="relative z-10 w-full max-w-xl mx-auto my-auto py-8">
        <AnimatePresence mode="wait" custom={direction}>
          <OnboardingStep key={step.id} step={step} direction={direction} />
        </AnimatePresence>
      </main>

      {/* Bottom Navigation Buttons */}
      <footer className="relative z-10 w-full max-w-md mx-auto pt-6 border-t border-[#1B5E3B]/15">
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            size="md"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={currentStep === 0 ? "opacity-0 pointer-events-none" : ""}
          >
            ← Previous
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={handleNext}
            className="min-w-[140px]"
          >
            {isLastStep ? (
              <span className="flex items-center gap-1.5">
                Finish Setup
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="ml-0.5"
                >
                  <path
                    d="M4 10L8 14L16 6"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                Continue
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="ml-0.5"
                >
                  <path
                    d="M6 10H14M14 10L10 6M14 10L10 14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
}
