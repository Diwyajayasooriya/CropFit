// ── Color tokens (for use in Three.js materials, not Tailwind) ──
export const COLORS = {
  bg: "#0A0E0D",
  bgDeep: "#060908",
  surface: "#111916",
  green: "#1B5E3B",
  greenLight: "#2D8F5E",
  greenDark: "#0F3D25",
  amber: "#D9A441",
  amberLight: "#E8C06A",
  amberDark: "#B8832F",
  text: "#E8E6E3",
  textMuted: "#8A9A8F",
} as const;

// ── Onboarding steps ──
export interface OnboardingStepData {
  id: number;
  title: string;
  description: string;
  icon: "setup" | "network" | "sensor" | "actuator";
}

export const ONBOARDING_STEPS: OnboardingStepData[] = [
  {
    id: 1,
    title: "Set up your GreenNode",
    description:
      "Place your GreenNode on a flat, dry surface inside or near your greenhouse. Connect the included power adapter to the DC input port on the back of the device.",
    icon: "setup",
  },
  {
    id: 2,
    title: "Connect to your network",
    description:
      "Pair your mobile device with GreenNode over Bluetooth to transmit local Wi-Fi credentials. Enter your network SSID and password to provision the hub securely.",
    icon: "network",
  },
  {
    id: 3,
    title: "Connect a sensor",
    description:
      "Plug your first IoT sensor into any of the available sensor ports. GreenNode will automatically detect the sensor type and begin calibration.",
    icon: "sensor",
  },
  {
    id: 4,
    title: "Connect an actuator",
    description:
      "Attach an actuator (e.g. irrigation valve, ventilation fan) to the actuator port. GreenNode's AI will coordinate it with your sensor data automatically.",
    icon: "actuator",
  },
] as const;
