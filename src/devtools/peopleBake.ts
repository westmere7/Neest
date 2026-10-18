/**
 * People bake (runs in the browser, driven by tools/bake-people.mjs; never imported by the app).
 *
 * Takes a rigged CC0 character (Quaternius Ultimate Modular Men/Women, shared 62-bone rig), scales
 * it to a stature (children: larger head and shorter legs on the rig), aims its bones along a
 * HumanPose (`humanPoseTargets`, the same data as the procedural figures), bakes the skinned mesh
 * into static geometry split by material slot (skin, hair, top, bottoms, shoes, accent) and returns
 * a small GLB: positions + indices only, standing on y = 0 and centred on the footprint.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { humanPoseTargets, type HumanAge, type HumanPose } from '@/data/assets/humanParts';

export interface BakeJob {
  id: string;
  /** Source character GLB as base64. */
  source: string;
  stature: number;
  age?: HumanAge;
  pose: HumanPose;
}

export interface BakeResult {
  id: string;
  glb: string;
  size: [number, number, number];
  /** Height of the underside of the pelvis (the seat a sitting pose fits). */
  seat: number;
  slots: string[];
  tris: number;
}

const AGE_SCALE: Record<HumanAge, { head: number; leg: number }> = {
  adult: { head: 1, leg: 1 },
  senior: { head: 1, leg: 0.98 },
  teen: { head: 1.04, leg: 0.98 },
  child: { head: 1.2, leg: 0.9 },
  toddler: { head: 1.42, leg: 0.78 },
};

const v3 = (a: [number, number, number]) => new THREE.Vector3(a[0], a[1], a[2]);
const worldPos = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
const worldQuat = (o: THREE.Object3D) => o.getWorldQuaternion(new THREE.Quaternion());

/** Rotates a bone by a world-space rotation about its own pivot. */
function turnWorld(bone: THREE.Object3D, q: THREE.Quaternion) {
  const target = q.clone().multiply(worldQuat(bone));
  const parent = bone.parent ? worldQuat(bone.parent) : new THREE.Quaternion();
  bone.quaternion.copy(parent.invert().multiply(target));
  bone.updateMatrixWorld(true);
}

const basisQuat = (f: [number, number, number][]) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(v3(f[0]), v3(f[1]), v3(f[2])));

function partOf(mesh: THREE.Object3D): string {
  for (let o: THREE.Object3D | null = mesh; o; o = o.parent) {
    const m = o.name.replace(/_\d+$/, '').match(/_(Body|Feet|Head|Legs|Pants)$/);
    if (m) return m[1] === 'Pants' ? 'Legs' : m[1];
  }
  return '';
}

/** Loads, scales and poses a character, then returns its baked slot meshes as a GLB. */
export async function bakePerson(job: BakeJob): Promise<BakeResult> {
  const bytes = Uint8Array.from(atob(job.source), (c) => c.charCodeAt(0));
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(bytes.buffer, '');
  const scene = gltf.scene;
  const skinned: THREE.SkinnedMesh[] = [];
  scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh && partOf(o)) skinned.push(o as THREE.SkinnedMesh);
  });
  const bone = (name: string) => {
    // GLTFLoader sanitises node names ("UpperLeg.L" → "UpperLegL").
    const b = scene.getObjectByName(name) ?? scene.getObjectByName(name.replace(/[.:/[\]]/g, ''));
    if (!b) throw new Error(`${job.id}: bone ${name} missing`);
    return b;
  };
  scene.updateMatrixWorld(true);
  // Face +z with the character's left on +x.
  if (worldPos(bone('UpperLeg.L')).x < worldPos(bone('UpperLeg.R')).x) scene.rotation.y = Math.PI;
  const age = AGE_SCALE[job.age ?? 'adult'];
  bone('Head').scale.multiplyScalar(age.head);
  for (const s of ['L', 'R']) bone(`UpperLeg.${s}`).scale.multiplyScalar(age.leg);
  scene.updateMatrixWorld(true);

  // Rest state, to undo the measuring pose.
  const restState: [THREE.Object3D, THREE.Vector3, THREE.Quaternion][] = [];
  scene.traverse((o) => restState.push([o, o.position.clone(), o.quaternion.clone()]));
  const restore = () => {
    for (const [o, p, q] of restState) {
      o.position.copy(p);
      o.quaternion.copy(q);
    }
    scene.updateMatrixWorld(true);
  };

  // Rest measurements: each segment's direction in its bone's local frame and its length. The
  // feet are IK-style bones parented to the root, so they are placed at the end of the shins.
  const rest = new Map<string, { dir: THREE.Vector3; len: number }>();
  const footFwd: Record<string, THREE.Vector3> = {};
  // Palms face the body at rest: remember that direction in the wrist frame.
  const palm: Record<string, THREE.Vector3> = {};
  const measureRest = () => {
    const measure = (from: string, to: string) => {
      const d = worldPos(bone(to)).sub(worldPos(bone(from)));
      rest.set(from, { len: d.length(), dir: d.normalize().applyQuaternion(worldQuat(bone(from)).invert()) });
    };
    for (const s of ['L', 'R']) {
      palm[s] = new THREE.Vector3(s === 'L' ? -1 : 1, 0, 0).applyQuaternion(worldQuat(bone(`Wrist.${s}`)).invert());
      measure(`UpperArm.${s}`, `LowerArm.${s}`);
      measure(`LowerArm.${s}`, `Wrist.${s}`);
      measure(`Wrist.${s}`, `Middle1.${s}`);
      measure(`UpperLeg.${s}`, `LowerLeg.${s}`);
      measure(`LowerLeg.${s}`, `Foot.${s}`);
      footFwd[s] = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuat(bone(`Foot.${s}`)).invert());
    }
  };
  const aimRest = (name: string, dir: THREE.Vector3) => {
    const b = bone(name);
    const cur = rest.get(name)!.dir.clone().applyQuaternion(worldQuat(b)).normalize();
    turnWorld(b, new THREE.Quaternion().setFromUnitVectors(cur, dir.clone().normalize()));
  };

  const applyPose = (pose: HumanPose) => {
    const T = humanPoseTargets(pose);
    const qP = basisQuat(T.P);
    const qC = basisQuat(T.C);
    const qH = basisQuat(T.H);
    turnWorld(bone('Hips'), qP);
    const third = new THREE.Quaternion().slerp(qC.clone().multiply(qP.clone().invert()), 1 / 3);
    for (const n of ['Abdomen', 'Torso', 'Chest']) turnWorld(bone(n), third);
    const half = new THREE.Quaternion().slerp(qH.clone().multiply(qC.clone().invert()), 0.5);
    turnWorld(bone('Neck'), half);
    turnWorld(bone('Head'), half);
    for (const [s, arm, leg] of [
      ['L', T.armL, T.legL],
      ['R', T.armR, T.legR],
    ] as const) {
      aimRest(`UpperArm.${s}`, v3(arm.upper));
      aimRest(`LowerArm.${s}`, v3(arm.fore));
      aimRest(`Wrist.${s}`, v3(arm.fore));
      // Twist the forearm about its axis so the palm faces down when the forearm is level, and the
      // body when it hangs (minimal-arc aiming alone can leave palms turned up).
      const fore = v3(arm.fore).normalize();
      const want = new THREE.Vector3(s === 'L' ? -1 : 1, 0, 0).applyQuaternion(qC).lerp(new THREE.Vector3(0, -1, 0), THREE.MathUtils.clamp(1 - Math.abs(fore.y) * 1.3, 0, 1));
      const flat = (v: THREE.Vector3) => v.clone().sub(fore.clone().multiplyScalar(v.dot(fore))).normalize();
      const now = flat(palm[s].clone().applyQuaternion(worldQuat(bone(`Wrist.${s}`))));
      const tgt = flat(want);
      if (now.lengthSq() > 0.5 && tgt.lengthSq() > 0.5) {
        const ang = Math.atan2(now.clone().cross(tgt).dot(fore), now.dot(tgt));
        turnWorld(bone(`LowerArm.${s}`), new THREE.Quaternion().setFromAxisAngle(fore, ang));
      }
      aimRest(`UpperLeg.${s}`, v3(leg.thigh));
      aimRest(`LowerLeg.${s}`, v3(leg.shin));
      const foot = bone(`Foot.${s}`);
      const ankle = worldPos(bone(`LowerLeg.${s}`)).add(v3(leg.shin).normalize().multiplyScalar(rest.get(`LowerLeg.${s}`)!.len));
      foot.position.copy(foot.parent!.worldToLocal(ankle));
      foot.updateMatrixWorld(true);
      const cur = footFwd[s].clone().applyQuaternion(worldQuat(foot)).normalize();
      turnWorld(foot, new THREE.Quaternion().setFromUnitVectors(cur, v3(leg.foot).normalize()));
    }
    scene.updateMatrixWorld(true);
  };

  // Stature is measured standing straight (the rig rests with slightly bent knees), then scaled.
  measureRest();
  applyPose({});
  const standing = bakedBox(skinned);
  restore();
  scene.scale.multiplyScalar(job.stature / (standing.max.y - standing.min.y));
  scene.updateMatrixWorld(true);
  measureRest();
  applyPose(job.pose);

  // Bake: skinned vertices in world space, grouped by slot.
  const bodyTris = new Map<string, number>();
  for (const m of skinned) {
    if (partOf(m) !== 'Body' || /^Skin/i.test(m.material && (m.material as THREE.Material).name)) continue;
    const name = (m.material as THREE.Material).name;
    bodyTris.set(name, (bodyTris.get(name) ?? 0) + (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3);
  }
  const mainTop = [...bodyTris.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const slotOf = (m: THREE.SkinnedMesh): string => {
    const mat = (m.material as THREE.Material).name;
    const part = partOf(m);
    if (/^Skin/i.test(mat)) return 'skin';
    if (part === 'Head') return 'hair';
    if (part === 'Feet') return 'shoes';
    if (part === 'Body') return mat === mainTop ? 'top' : 'accent';
    return 'bottoms';
  };
  const bySlot = new Map<string, { pos: number[]; idx: number[] }>();
  const v = new THREE.Vector3();
  for (const m of skinned) {
    m.skeleton.update();
    const slot = slotOf(m);
    const acc = bySlot.get(slot) ?? { pos: [], idx: [] };
    bySlot.set(slot, acc);
    const base = acc.pos.length / 3;
    const n = m.geometry.getAttribute('position').count;
    for (let i = 0; i < n; i++) {
      m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld);
      acc.pos.push(v.x, v.y, v.z);
    }
    const index = m.geometry.index;
    if (index) for (let i = 0; i < index.count; i++) acc.idx.push(base + index.getX(i));
    else for (let i = 0; i < n; i++) acc.idx.push(base + i);
  }
  // Stand on the floor, centred.
  const box = new THREE.Box3();
  for (const { pos } of bySlot.values()) for (let i = 0; i < pos.length; i += 3) box.expandByPoint(v.set(pos[i], pos[i + 1], pos[i + 2]));
  const shift = new THREE.Vector3(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  const hipY = (worldPos(bone('UpperLeg.L')).y + worldPos(bone('UpperLeg.R')).y) / 2;
  const seat = Math.max(0, Math.round((hipY + shift.y - 0.055 * job.stature) * 1000) / 1000);
  const out = new THREE.Scene();
  let tris = 0;
  for (const [slot, { pos, idx }] of bySlot) {
    for (let i = 0; i < pos.length; i += 3) {
      pos[i] = Math.round((pos[i] + shift.x) * 1e4) / 1e4;
      pos[i + 1] = Math.round((pos[i + 1] + shift.y) * 1e4) / 1e4;
      pos[i + 2] = Math.round((pos[i + 2] + shift.z) * 1e4) / 1e4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const maxIndex = idx.reduce((m, i) => Math.max(m, i), 0);
    g.setIndex(maxIndex < 65535 ? new THREE.Uint16BufferAttribute(idx, 1) : new THREE.Uint32BufferAttribute(idx, 1));
    tris += idx.length / 3;
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ name: slot }));
    mesh.name = slot;
    out.add(mesh);
  }
  const glb = (await new GLTFExporter().parseAsync(out, { binary: true })) as ArrayBuffer;
  let bin = '';
  const u8 = new Uint8Array(glb);
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  const r = (x: number) => Math.ceil(x * 1000) / 1000;
  return { id: job.id, glb: btoa(bin), size: [r(box.max.x - box.min.x), r(box.max.z - box.min.z), r(box.max.y - box.min.y)], seat, slots: [...bySlot.keys()], tris };
}

function bakedBox(meshes: THREE.SkinnedMesh[]): THREE.Box3 {
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  for (const m of meshes) {
    m.skeleton.update();
    const n = m.geometry.getAttribute('position').count;
    for (let i = 0; i < n; i++) box.expandByPoint(m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld));
  }
  return box;
}
