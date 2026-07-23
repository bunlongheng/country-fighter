"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense } from "react";
import Marble from "./Marble";
import Studio from "./Studio";

// A single freely-rotatable marble shown before the match. Drag to spin it;
// left alone it slowly auto-rotates so it always looks alive.
export default function MarblePreview({
  code,
  hue,
}: {
  code: string;
  hue: number;
}) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 3], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
    >
      <Suspense fallback={null}>
        <Studio />
        <Marble code={code} hue={hue} radius={1} />
      </Suspense>
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate
        autoRotateSpeed={1.6}
        rotateSpeed={0.9}
      />
    </Canvas>
  );
}
