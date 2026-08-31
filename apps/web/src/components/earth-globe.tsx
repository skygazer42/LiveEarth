"use client";

import { Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { RankingEntry } from "@liveearth/domain/types";

const OUTLINES: Array<Array<[number, number]>> = [
  [[-168, 68], [-142, 60], [-125, 48], [-117, 32], [-98, 18], [-82, 25], [-66, 44], [-83, 58], [-110, 70], [-145, 72], [-168, 68]],
  [[-81, 12], [-72, -10], [-64, -24], [-57, -38], [-70, -55], [-77, -35], [-81, 12]],
  [[-12, 36], [2, 52], [28, 70], [63, 70], [104, 55], [140, 50], [160, 62], [178, 48], [143, 35], [118, 22], [96, 8], [78, 22], [54, 16], [37, 33], [18, 36], [-12, 36]],
  [[-17, 34], [10, 37], [34, 30], [51, 12], [42, -16], [28, -34], [12, -35], [1, -10], [-17, 14], [-17, 34]],
  [[112, -11], [132, -12], [153, -26], [145, -42], [117, -36], [112, -11]],
  [[-52, 82], [-20, 76], [-26, 61], [-48, 60], [-52, 82]],
];

function latLngToVector(latitude: number, longitude: number, radius = 1.012): THREE.Vector3 {
  const lat = THREE.MathUtils.degToRad(latitude);
  const lng = THREE.MathUtils.degToRad(longitude);
  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.sin(lng),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.cos(lng),
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

function GlobeScene({
  entries,
  selectedIndex,
  onSelect,
}: {
  entries: RankingEntry[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const world = useRef<THREE.Group>(null);
  const reducedMotion = useReducedMotion();
  const selected = entries[selectedIndex] ?? entries[0];
  const target = useMemo(() => {
    if (!selected) return { x: 0, y: 0 };
    return {
      x: THREE.MathUtils.degToRad(-selected.scene.latitude * 0.72),
      y: THREE.MathUtils.degToRad(-selected.scene.longitude),
    };
  }, [selected]);

  useFrame((_state, delta) => {
    if (!world.current) return;
    const alpha = reducedMotion ? 1 : 1 - Math.exp(-delta * 10);
    world.current.rotation.x = THREE.MathUtils.lerp(world.current.rotation.x, target.x, alpha);
    world.current.rotation.y = THREE.MathUtils.lerp(world.current.rotation.y, target.y, alpha);
  });

  const latitudeLines = useMemo(
    () =>
      [-60, -30, 0, 30, 60].map((lat) =>
        Array.from({ length: 73 }, (_, index) => latLngToVector(lat, index * 5 - 180, 1.003)),
      ),
    [],
  );
  const longitudeLines = useMemo(
    () =>
      [-120, -60, 0, 60, 120, 180].map((lng) =>
        Array.from({ length: 37 }, (_, index) => latLngToVector(index * 5 - 90, lng, 1.003)),
      ),
    [],
  );
  const outlineLines = useMemo(
    () => OUTLINES.map((outline) => outline.map(([lng, lat]) => latLngToVector(lat, lng, 1.008))),
    [],
  );

  useEffect(
    () => () => {
      document.body.style.cursor = "";
    },
    [],
  );

  return (
    <>
      <ambientLight intensity={0.42} />
      <directionalLight color="#f1dcc1" intensity={3.1} position={[3, 2, 4]} />
      <directionalLight color="#587b85" intensity={0.6} position={[-4, -1, -2]} />
      <group ref={world} rotation={[0.18, -0.7, -0.06]}>
        <mesh>
          <sphereGeometry args={[1, 96, 96]} />
          <meshStandardMaterial color="#13282d" roughness={0.94} metalness={0.02} />
        </mesh>
        <mesh scale={1.045}>
          <sphereGeometry args={[1, 64, 64]} />
          <meshBasicMaterial color="#88aab1" transparent opacity={0.075} side={THREE.BackSide} />
        </mesh>

        {latitudeLines.map((points, index) => (
          <Line key={`lat-${index}`} points={points} color="#8fa4a3" opacity={0.13} transparent lineWidth={0.45} />
        ))}
        {longitudeLines.map((points, index) => (
          <Line key={`lng-${index}`} points={points} color="#8fa4a3" opacity={0.1} transparent lineWidth={0.45} />
        ))}
        {outlineLines.map((points, index) => (
          <Line key={`land-${index}`} points={points} color="#cab99d" opacity={0.54} transparent lineWidth={1.1} />
        ))}

        {entries.map((entry, index) => {
          const point = latLngToVector(entry.scene.latitude, entry.scene.longitude, 1.025);
          const active = index === selectedIndex;
          return (
            <group
              key={entry.scene.id}
              position={point}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(index);
              }}
              onPointerOver={(event) => {
                event.stopPropagation();
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                document.body.style.cursor = "";
              }}
            >
              <mesh>
                <sphereGeometry args={[0.045, 16, 16]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
              <mesh scale={active ? 1.6 : 1}>
                <sphereGeometry args={[active ? 0.018 : 0.011, 16, 16]} />
                <meshBasicMaterial color={active ? "#ff755f" : "#e7dfcd"} />
              </mesh>
              {active ? (
                <mesh>
                  <sphereGeometry args={[0.038, 18, 18]} />
                  <meshBasicMaterial color="#ff755f" transparent opacity={0.16} depthWrite={false} />
                </mesh>
              ) : null}
            </group>
          );
        })}
      </group>
      <OrbitControls enablePan={false} enableZoom minDistance={2.1} maxDistance={4.6} rotateSpeed={0.35} />
    </>
  );
}

export function EarthGlobe({
  entries,
  selectedIndex,
  onSelect,
}: {
  entries: RankingEntry[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 3.15], fov: 38 }}
      dpr={[1, 1.7]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <GlobeScene entries={entries} selectedIndex={selectedIndex} onSelect={onSelect} />
    </Canvas>
  );
}
