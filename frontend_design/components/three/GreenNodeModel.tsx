"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Cylinder } from "@react-three/drei";
import * as THREE from "three";
import { COLORS } from "@/lib/constants";

interface GreenNodeModelProps {
  modelUrl?: string;
  reducedMotion?: boolean;
  scale?: number;
  position?: [number, number, number];
}

/**
 * Procedural low-poly GreenNode device model.
 * Accepts optional modelUrl for future GLB swap — when provided,
 * useGLTF would replace the procedural geometry.
 */
export default function GreenNodeModel({
  reducedMotion = false,
  scale = 1,
  position = [0, 0, 0],
}: GreenNodeModelProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Fresnel-like rim-light material
  const rimMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        baseColor: { value: new THREE.Color(COLORS.bg) },
        rimColor: { value: new THREE.Color(COLORS.green) },
        rimPower: { value: 2.5 },
        rimIntensity: { value: 1.2 },
        time: { value: 0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 baseColor;
        uniform vec3 rimColor;
        uniform float rimPower;
        uniform float rimIntensity;
        uniform float time;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float rim = 1.0 - max(dot(vViewDir, vNormal), 0.0);
          rim = pow(rim, rimPower) * rimIntensity;
          // subtle time-based pulse
          float pulse = 0.85 + 0.15 * sin(time * 1.5);
          vec3 color = mix(baseColor, rimColor, rim * pulse);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
  }, []);

  // Dark matte material for antenna stems
  const antennaMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: COLORS.surface,
        roughness: 0.9,
        metalness: 0.1,
      }),
    []
  );

  // Glowing green tips for antennas
  const tipMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: COLORS.green,
        emissive: COLORS.green,
        emissiveIntensity: 2.0,
        roughness: 0.3,
        metalness: 0.2,
      }),
    []
  );

  useFrame((state) => {
    if (!groupRef.current) return;

    // Update shader time uniform
    rimMaterial.uniforms.time.value = state.clock.elapsedTime;

    if (!reducedMotion) {
      // Slow auto-rotation
      groupRef.current.rotation.y += 0.003;
    }

    // Smooth lerp towards target position and scale
    const targetX = position[0];
    const targetY =
      position[1] + (reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.8) * 0.12);
    const targetZ = position[2];
    const lerpFactor = reducedMotion ? 0.15 : 0.04;

    groupRef.current.position.x = THREE.MathUtils.lerp(
      groupRef.current.position.x,
      targetX,
      lerpFactor
    );
    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y,
      targetY,
      lerpFactor
    );
    groupRef.current.position.z = THREE.MathUtils.lerp(
      groupRef.current.position.z,
      targetZ,
      lerpFactor
    );

    const curScale = groupRef.current.scale.x;
    const newScale = THREE.MathUtils.lerp(curScale, scale, lerpFactor);
    groupRef.current.scale.set(newScale, newScale, newScale);
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]} scale={scale}>
      {/* Main body — rounded box */}
      <RoundedBox
        args={[1.6, 1.0, 1.0]}
        radius={0.12}
        smoothness={4}
        material={rimMaterial}
      />

      {/* Top panel — slightly raised surface line */}
      <mesh position={[0, 0.52, 0]}>
        <boxGeometry args={[1.4, 0.04, 0.85]} />
        <meshStandardMaterial
          color={COLORS.greenDark}
          emissive={COLORS.green}
          emissiveIntensity={0.3}
          roughness={0.7}
        />
      </mesh>

      {/* Antenna Left */}
      <group position={[-0.4, 0.54, 0]} rotation={[0, 0, Math.PI * 0.08]}>
        <Cylinder
          args={[0.02, 0.025, 0.65, 8]}
          position={[0, 0.325, 0]}
          material={antennaMaterial}
        />
        {/* Glowing tip */}
        <mesh position={[0, 0.68, 0]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <primitive object={tipMaterial} attach="material" />
        </mesh>
      </group>

      {/* Antenna Right */}
      <group position={[0.4, 0.54, 0]} rotation={[0, 0, -Math.PI * 0.08]}>
        <Cylinder
          args={[0.02, 0.025, 0.65, 8]}
          position={[0, 0.325, 0]}
          material={antennaMaterial}
        />
        {/* Glowing tip */}
        <mesh position={[0, 0.68, 0]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <primitive object={tipMaterial} attach="material" />
        </mesh>
      </group>

      {/* Front indicator strip — emissive green line */}
      <mesh position={[0, -0.1, 0.505]}>
        <boxGeometry args={[1.2, 0.06, 0.01]} />
        <meshStandardMaterial
          color={COLORS.green}
          emissive={COLORS.green}
          emissiveIntensity={1.5}
          roughness={0.3}
        />
      </mesh>

      {/* Subtle bottom shadow plane */}
      <mesh
        position={[0, -0.52, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[2.0, 1.5]} />
        <meshStandardMaterial
          color={COLORS.greenDark}
          transparent
          opacity={0.15}
        />
      </mesh>
    </group>
  );
}
