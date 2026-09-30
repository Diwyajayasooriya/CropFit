"use client";

import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import TabToggle from "@/components/ui/TabToggle";
import { slideInRight } from "@/lib/animations";
import { signUp, signIn } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";

interface FormErrors {
  username?: string;
  password?: string;
  activationKey?: string;
  general?: string;
}

export default function AuthPanel() {
  const router = useRouter();
  const { login } = useAuthStore();

  const [tabIndex, setTabIndex] = useState(0);
  const isSignUp = tabIndex === 0;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [activationKey, setActivationKey] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!username.trim()) {
      newErrors.username = "Username is required";
    } else if (username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (isSignUp && !activationKey.trim()) {
      newErrors.activationKey = "Activation key is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      if (isSignUp) {
        const res = await signUp({
          username: username.trim(),
          password,
          activationKey: activationKey.trim(),
        });
        login(res.token, res.user.username);
      } else {
        const res = await signIn({
          username: username.trim(),
          password,
        });
        login(res.token, res.user.username);
      }

      // Navigate to onboarding on success
      router.push("/onboarding");
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setErrors({
        general: apiErr?.message ?? "Something went wrong. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      variants={slideInRight}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="w-full max-w-md mx-auto lg:mx-0"
    >
      {/* Panel */}
      <div className="relative p-8 rounded-3xl border border-gn-green/15 bg-gn-surface/70 backdrop-blur-xl">
        {/* Decorative glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-gn-green/8 blur-[60px] pointer-events-none" />

        {/* Guide copy */}
        <p className="text-sm text-gn-text-muted font-body mb-6 leading-relaxed">
          {isSignUp
            ? "Every GreenNode ships with a unique activation key. You\u2019ll find it printed on the label inside the box."
            : "Welcome back. Sign in to access your GreenNode dashboard."}
        </p>

        {/* Tab toggle */}
        <TabToggle
          options={["Sign Up", "Sign In"]}
          activeIndex={tabIndex}
          onChange={(i) => {
            setTabIndex(i);
            setErrors({});
          }}
        />

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={errors.username}
            autoComplete="username"
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            autoComplete={isSignUp ? "new-password" : "current-password"}
          />

          {/* Activation key — only on Sign Up */}
          <AnimatePresence mode="wait">
            {isSignUp && (
              <motion.div
                key="activation-key"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              >
                <Input
                  label="Activation Key"
                  value={activationKey}
                  onChange={(e) => setActivationKey(e.target.value)}
                  error={errors.activationKey}
                  accent
                  autoComplete="off"
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* General error */}
          {errors.general && (
            <p className="text-sm text-red-400 font-body text-center">
              {errors.general}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full mt-2"
            disabled={loading}
          >
            {loading
              ? "Processing..."
              : isSignUp
                ? "Create Account"
                : "Sign In"}
          </Button>
        </form>
      </div>
    </motion.div>
  );
}
