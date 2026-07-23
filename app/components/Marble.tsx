"use client";

import { useTexture } from "@react-three/drei";
import { forwardRef, useMemo } from "react";
import * as THREE from "three";
import { MARBLE_RADIUS } from "@/lib/physics";

type MarbleProps = {
  code: string;
  hue: number;
  radius?: number;
} & React.ComponentProps<"mesh">;

// A glossy 3D marble wrapped with a country's flag. The flag PNG is mapped onto
// a high-poly sphere and finished with a clearcoat so it reads like polished
// glass. A faint hue-tinted emissive gives each marble its own inner glow.
const Marble = forwardRef<THREE.Mesh, MarbleProps>(function Marble(
  { code, hue, radius = MARBLE_RADIUS, ...props },
  ref,
) {
  const tex = useTexture(`/flags/${code}.png`);
  const emissive = useMemo(
    () => new THREE.Color().setHSL(hue / 360, 0.9, 0.5),
    [hue],
  );

  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.center.set(0.5, 0.5);
  }, [tex]);

  return (
    <mesh ref={ref} castShadow {...props}>
      <sphereGeometry args={[radius, 64, 64]} />
      <meshPhysicalMaterial
        map={tex}
        roughness={0.14}
        metalness={0}
        clearcoat={1}
        clearcoatRoughness={0.06}
        envMapIntensity={1.15}
        emissive={emissive}
        emissiveIntensity={0.06}
      />
    </mesh>
  );
});

export default Marble;
