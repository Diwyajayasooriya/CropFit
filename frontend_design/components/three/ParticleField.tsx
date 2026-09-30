"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { COLORS } from "@/lib/constants";

interface ParticleFieldProps {
  count?: number;
  reducedMotion?: boolean;
}

/**
 * Subtle floating particles that drift upward to suggest "growth."
 * Low GPU cost (~200 points, no textures).
 */
export default function ParticleField({
  count = 200,
  reducedMotion = false,
}: ParticleFieldProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 8; // x
      pos[i * 3 + 1] = (Math.random() - 0.5) * 6; // y
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6; // z
      vel[i] = 0.002 + Math.random() * 0.005; // upward speed
    }

    return { positions: pos, velocities: vel };
  }, [count]);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: COLORS.green,
        size: 0.02,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    []
  );

  useFrame(() => {
    if (reducedMotion || !pointsRef.current) return;

    const posArray = pointsRef.current.geometry.attributes.position
      .array as Float32Array;

    for (let i = 0; i < count; i++) {
      posArray[i * 3 + 1] += velocities[i]; // drift up

      // Reset particle when it goes above the field
      if (posArray[i * 3 + 1] > 3) {
        posArray[i * 3 + 1] = -3;
        posArray[i * 3] = (Math.random() - 0.5) * 8;
        posArray[i * 3 + 2] = (Math.random() - 0.5) * 6;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} material={material}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
    </points>
  );
}
