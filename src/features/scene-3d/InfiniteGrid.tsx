import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

/**
 * Grid line colours derived from the 3D background: a small step lighter on dark backgrounds and
 * darker on light ones, so the grid stays a quiet guide in both themes. Mixed in sRGB (screen)
 * space: in linear space a few percent toward white is a big visible jump on dark colours.
 */
export function gridColors(background: string): [THREE.Color, THREE.Color] {
  const bg = new THREE.Color(background).getRGB(new THREE.Color(), THREE.SRGBColorSpace);
  const dark = 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b < 0.45;
  const to = dark ? 1 : 0;
  const mix = (t: number) => new THREE.Color().setRGB(bg.r + (to - bg.r) * t, bg.g + (to - bg.g) * t, bg.b + (to - bg.b) * t, THREE.SRGBColorSpace);
  return dark ? [mix(0.16), mix(0.08)] : [mix(0.22), mix(0.11)];
}

const VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAGMENT = /* glsl */ `
uniform vec3 uMinor;
uniform vec3 uMajor;
uniform vec3 uCentre;
uniform float uFade;
varying vec3 vWorld;
// Anti-aliased line strength for a grid of the given spacing (screen-space width via fwidth).
float grid(vec2 p, float spacing) {
  vec2 q = p / spacing;
  vec2 g = abs(fract(q - 0.5) - 0.5) / fwidth(q);
  return 1.0 - min(min(g.x, g.y), 1.0);
}
void main() {
  float minor = grid(vWorld.xz, 1.0);
  float major = grid(vWorld.xz, 5.0);
  float d = length(vWorld.xz - uCentre.xz);
  float fade = 1.0 - smoothstep(uFade * 0.25, uFade, d);
  float a = max(minor * 0.7, major) * fade;
  if (a < 0.003) discard;
  gl_FragColor = vec4(mix(uMinor, uMajor, major), a);
}`;

/**
 * Ground grid that looks infinite: 1 m lines with stronger 5 m lines, drawn by a shader on one
 * large plane and fading out with distance from the orbit target (farther when zoomed out), so
 * there is no hard edge. It writes no depth, so it never casts ambient occlusion or hides objects.
 */
export function InfiniteGrid({ background }: { background: string }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target?: THREE.Vector3 } | null;
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        // Pushed back in depth so floors and the ground always win (no flicker where they overlap).
        polygonOffset: true,
        polygonOffsetFactor: 4,
        polygonOffsetUnits: 4,
        uniforms: {
          uMinor: { value: new THREE.Color() },
          uMajor: { value: new THREE.Color() },
          uCentre: { value: new THREE.Vector3() },
          uFade: { value: 40 },
        },
      }),
    [],
  );
  useEffect(() => {
    const [major, minor] = gridColors(background);
    material.uniforms.uMajor.value.copy(major);
    material.uniforms.uMinor.value.copy(minor);
  }, [material, background]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    const c = controls?.target ?? camera.position;
    material.uniforms.uCentre.value.copy(c);
    // Fade radius grows with the viewing distance so a zoomed-out plan still has its grid.
    material.uniforms.uFade.value = Math.max(25, camera.position.distanceTo(c) * 2.2);
  });
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} material={material} raycast={() => null} renderOrder={-1}>
      <planeGeometry args={[2000, 2000]} />
    </mesh>
  );
}
