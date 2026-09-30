"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import GreenNodeModel from "./GreenNodeModel";
import ParticleField from "./ParticleField";
import { useReducedMotion } from "@/lib/reducedMotion";

export type SceneMode = "landing" | "hero" | "auth";

interface HeroSceneProps {
  mode?: SceneMode;
}

/**
 * Canvas wrapper for the 3D hero scene.
 * In "hero" / "landing" mode the model is centered; in "auth" mode it shifts left.
 */
export default function HeroScene({ mode = "hero" }: HeroSceneProps) {
  const reducedMotion = useReducedMotion();

  // Model position/scale based on mode
  const modelPosition: [number, number, number] =
    mode === "auth" ? [-1.6, 0.05, 0] : [0, 0, 0];
  const modelScale = mode === "auth" ? 0.72 : 1.0;

  return (
    <Canvas
      camera={{ position: [0, 0.5, 4], fov: 45 }}
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      }}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.15} color="#1B5E3B" />
      <directionalLight
        position={[5, 5, 3]}
        intensity={0.6}
        color="#E8E6E3"
      />
      <directionalLight
        position={[-3, 2, -2]}
        intensity={0.3}
        color="#1B5E3B"
      />
      <pointLight
        position={[0, -1, 2]}
        intensity={0.4}
        color="#1B5E3B"
        distance={8}
      />

      <Suspense fallback={null}>
        <GreenNodeModel
          position={modelPosition}
          scale={modelScale}
          reducedMotion={reducedMotion}
        />
        <ParticleField reducedMotion={reducedMotion} />
      </Suspense>
    </Canvas>
  );
}
