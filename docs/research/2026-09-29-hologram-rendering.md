# Hologram rendering tricks for the walk (improvement scout, 2026-09-29)
King's use: feeds pass 2 of the hologram-walk contest (docs/design/next-level/h/).

1. Fresnel rim + scanline shader material (ektogamat/threejs-holographic-material pattern): fresnelAmount ~0.45,
   scanline size ~8, slow signal speed, blinking optional (off under reduced motion). Effort S.
2. Selective bloom: hologram geometry on its own layer, UI/text never through the composer; threshold 0.7-0.85,
   radius 0.5-1.0. Intel Macs: drop bloom or half-res. Effort M.
3. LineSegments2 + LineMaterial for crisp house edges and streets (instanced; width 1-3 px; vertexColors). Effort M.
4. SDF glow in the fragment shader (smoothstep on distance) for roof hotspots / halos, no textures. Effort M.
5. Camera: expo-out easing, look-ahead framing, each pan < 2 s with a pause at the door; OrbitControls damping 0.05.
6. Perf: cap pixel ratio (King's call: min(dpr, 1.5), adaptive down if frame time > 20 ms), one InstancedMesh for
   25 houses + LineSegments2 edges, labels in DOM/canvas after the composer so text stays crisp.
Watch out: label it a preview ("Sample homes"), keep it a sales tool; shader compile ~100 ms on first load.
Sources: github.com/ektogamat/threejs-holographic-material · threejs.org/docs (UnrealBloomPass, LineSegments2,
LineMaterial) · discourse.threejs.org threads 42606, 36844, 33981, 22740 · donmccurdy.com/2024/02/11/web-texture-formats
