import * as THREE from 'three';
import type { MaterialDefinition, Project } from '@/domain/model/schema';
import { resolveMaterial } from '@/data/assets/registry';
import { renderNormalMap, renderPattern, TEXTURE_PATTERNS } from '@/data/materials/patterns';

type MeshMat = THREE.MeshStandardMaterial;

/**
 * One three.js material per Neest material id, updated in place when the
 * definition changes. Because every surface referencing a material shares the
 * same instance, editing a shared material updates all linked surfaces
 * immediately without rebuilding any geometry.
 */
export class MaterialRegistry {
  private mats = new Map<string, { mat: MeshMat; def: MaterialDefinition }>();
  private baseTextures = new Map<string, THREE.CanvasTexture>();
  private normalTextures = new Map<string, THREE.CanvasTexture>();
  normalMaps = true;
  anisotropy = 4;

  get(project: Pick<Project, 'materials'> | null, id: string | null | undefined): MeshMat {
    const def = resolveMaterial(project, id);
    const hit = this.mats.get(def.id);
    if (hit) {
      if (hit.def !== def) {
        this.apply(hit.mat, def, hit.def);
        hit.def = def;
      }
      return hit.mat;
    }
    const mat = new THREE.MeshStandardMaterial();
    mat.name = def.name;
    this.apply(mat, def, null);
    this.mats.set(def.id, { mat, def });
    return mat;
  }

  /** Updates every cached material from the project (call when project.materials changes). */
  sync(project: Pick<Project, 'materials'>): void {
    for (const [id, entry] of this.mats) {
      const def = resolveMaterial(project, id);
      if (def !== entry.def && def.id === id) {
        this.apply(entry.mat, def, entry.def);
        entry.def = def;
      }
    }
  }

  private texture(patternId: string, contrast: number): THREE.CanvasTexture | null {
    const key = `${patternId}|${contrast.toFixed(2)}`;
    let t = this.baseTextures.get(key);
    if (!t) {
      const canvas = renderPattern(patternId, 512, contrast);
      if (!canvas) return null;
      t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = this.anisotropy;
      this.baseTextures.set(key, t);
    }
    return t;
  }

  private normal(patternId: string): THREE.CanvasTexture | null {
    let t = this.normalTextures.get(patternId);
    if (!t) {
      const canvas = renderNormalMap(patternId, 512);
      if (!canvas) return null;
      t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.NoColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      this.normalTextures.set(patternId, t);
    }
    return t;
  }

  private apply(mat: MeshMat, def: MaterialDefinition, prev: MaterialDefinition | null) {
    mat.name = def.name;
    mat.color.set(def.color);
    mat.roughness = def.roughness;
    mat.metalness = def.metalness;
    const transparent = def.opacity < 0.995;
    if (mat.transparent !== transparent) mat.needsUpdate = true;
    mat.transparent = transparent;
    mat.opacity = def.opacity;
    mat.depthWrite = def.opacity > 0.6;
    mat.side = transparent ? THREE.DoubleSide : THREE.FrontSide;
    if (def.emissive) {
      mat.emissive.set(def.emissive);
      mat.emissiveIntensity = def.emissiveIntensity;
    } else {
      mat.emissive.set('#000000');
      mat.emissiveIntensity = 0;
    }
    mat.envMapIntensity = def.metalness > 0.5 ? 1.2 : 1;
    const texChanged =
      !prev ||
      JSON.stringify(prev.texture) !== JSON.stringify(def.texture);
    if (texChanged) {
      const hadMap = !!mat.map;
      mat.map?.dispose();
      mat.normalMap?.dispose();
      mat.map = null;
      mat.normalMap = null;
      if (def.texture) {
        const base = this.texture(def.texture.patternId, def.texture.contrast);
        if (base) {
          const map = base.clone();
          map.repeat.set(1 / def.texture.scale, 1 / def.texture.scale);
          map.rotation = (def.texture.rotation * Math.PI) / 180;
          map.needsUpdate = true;
          mat.map = map;
          const strength = TEXTURE_PATTERNS[def.texture.patternId]?.normalStrength ?? 0;
          const nbase = this.normalMaps && strength > 0.05 ? this.normal(def.texture.patternId) : null;
          if (nbase) {
            const nm = nbase.clone();
            nm.repeat.copy(map.repeat);
            nm.rotation = map.rotation;
            nm.needsUpdate = true;
            mat.normalMap = nm;
            mat.normalScale.set(0.6, 0.6);
          }
        }
      }
      if (hadMap !== !!mat.map) mat.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const { mat } of this.mats.values()) {
      mat.map?.dispose();
      mat.normalMap?.dispose();
      mat.dispose();
    }
    for (const t of this.baseTextures.values()) t.dispose();
    for (const t of this.normalTextures.values()) t.dispose();
    this.mats.clear();
    this.baseTextures.clear();
    this.normalTextures.clear();
  }
}
