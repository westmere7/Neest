import * as THREE from 'three';
import type { MaterialDefinition, Project } from '@/domain/model/schema';
import { resolveMaterial } from '@/data/assets/registry';
import { patternInfo, renderNormalMap, renderPattern } from '@/data/materials/patterns';
import { dropPackKeys, subscribePacks } from '@/packs/events';
import {
  bakePhotoCanvas,
  getPhotoManifest,
  loadPhotoManifest,
  photoEntry,
  photoGain,
  photoImage,
  preloadPhotoSets,
  subscribePhotos,
  wantsPhoto,
  type PhotoManifestEntry,
  type PhotoMap,
} from '@/features/materials/photoTextures';

/** Largest photo map (px) used live; exports bake their own sizes. */
const LIVE_PHOTO_MAX = 1024;

type MeshMat = THREE.MeshStandardMaterial;
type Entry = { mat: MeshMat; def: MaterialDefinition; texKey: string };
/** A material's photo state: `entry` is set once the manifest knows the set; `pending` while maps load. */
type PhotoState = { entry: PhotoManifestEntry | null; pending: boolean };

/**
 * One three.js material per Neest material id, updated in place when the
 * definition changes. Because every surface referencing a material shares the
 * same instance, editing a shared material updates all linked surfaces
 * immediately without rebuilding any geometry.
 *
 * Textures: a material's photo set (CC0 colour/normal/roughness maps) is used
 * when it is switched on and its files load; until then, and whenever they are
 * missing, the procedural pattern is shown. Photo images load asynchronously
 * and swap in place on the same material instance.
 */
export class MaterialRegistry {
  private mats = new Map<string, Entry>();
  private baseTextures = new Map<string, THREE.CanvasTexture>();
  private normalTextures = new Map<string, THREE.CanvasTexture>();
  private photoTextures = new Map<string, THREE.Texture>();
  private unsubscribe: (() => void) | null = null;
  normalMaps = true;
  anisotropy = 4;
  /** Anisotropic filtering for photo maps (they carry fine detail at grazing angles). */
  photoAnisotropy = 8;
  /** Use photo textures when available (false = always procedural). */
  photos = true;
  /**
   * Export mode (GLB / guest viewer): photo colour maps are baked to canvases of
   * at most this size with the colour gain folded in (glTF colour factors must
   * stay ≤ 1), normal/roughness maps are skipped. 0 = live rendering.
   */
  bakePhotoSize = 0;

  constructor() {
    // Content packs reload live: forget their textures and re-texture their materials on next use.
    subscribePacks(() => {
      const drop = (t: THREE.Texture) => t.dispose();
      dropPackKeys(this.baseTextures, drop);
      dropPackKeys(this.normalTextures, drop);
      dropPackKeys(this.photoTextures, drop);
      for (const [id, entry] of this.mats) if (id.includes(':')) entry.texKey = '';
    });
  }

  get(project: Pick<Project, 'materials'> | null, id: string | null | undefined): MeshMat {
    const def = resolveMaterial(project, id);
    const hit = this.mats.get(def.id);
    if (hit) {
      if (hit.def !== def) {
        this.apply(hit, def, hit.def);
        hit.def = def;
      }
      return hit.mat;
    }
    const mat = new THREE.MeshStandardMaterial();
    mat.name = def.name;
    const entry: Entry = { mat, def, texKey: '' };
    this.apply(entry, def, null);
    this.mats.set(def.id, entry);
    return mat;
  }

  /** Updates every cached material from the project (call when project.materials changes). */
  sync(project: Pick<Project, 'materials'>): void {
    for (const [id, entry] of this.mats) {
      const def = resolveMaterial(project, id);
      if (def !== entry.def && def.id === id) {
        this.apply(entry, def, entry.def);
        entry.def = def;
      }
    }
  }

  /** Resolves once the photo maps used by the current materials have loaded or failed. */
  async whenPhotosReady(timeoutMs = 15000): Promise<void> {
    if (!this.photos) return;
    await loadPhotoManifest();
    const sets = new Set<string>();
    for (const { def } of this.mats.values()) {
      const ref = wantsPhoto(def);
      if (ref) sets.add(ref.setId);
    }
    await preloadPhotoSets(sets, this.photoMaps(), timeoutMs);
    this.refreshPhotos();
  }

  private photoMaps(): PhotoMap[] {
    return this.bakePhotoSize > 0 ? ['color'] : ['color', 'normal', 'roughness'];
  }

  /** Re-applies textures whose photo state may have changed (manifest or images arrived). */
  private refreshPhotos(): void {
    for (const entry of this.mats.values()) {
      if (!wantsPhoto(entry.def)) continue;
      if (this.textureKey(entry.def) !== entry.texKey) this.applyTextures(entry);
    }
  }

  private watchPhotos(): void {
    if (!this.unsubscribe) this.unsubscribe = subscribePhotos(() => this.refreshPhotos());
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

  /** Shared base texture for one map of a photo set (null while loading or when missing). */
  private photoTexture(entry: PhotoManifestEntry, map: PhotoMap, contrast: number): THREE.Texture | null {
    const bake = map === 'color' && (this.bakePhotoSize > 0 || contrast < 0.995);
    const key = `${entry.id}|${map}|${bake ? `${contrast.toFixed(2)}|${this.bakePhotoSize}` : 'raw'}`;
    const hit = this.photoTextures.get(key);
    if (hit) return hit;
    const { image } = photoImage(entry.id, map);
    if (!image) return null;
    let t: THREE.Texture;
    if (bake) {
      this.pruneBakedPhotos();
      // Exports keep 2K floor sets at 1K and 1K sets at 512 px; live contrast bakes stay ≤ 1K.
      const size = this.bakePhotoSize > 0 ? Math.min(this.bakePhotoSize, Math.max(512, image.width / 2)) : Math.min(1024, image.width);
      const canvas = bakePhotoCanvas(image, entry, size, contrast, this.bakePhotoSize > 0 ? [1, 1, 1] : null);
      if (!canvas) return null;
      t = new THREE.CanvasTexture(canvas);
      t.userData.neestBaked = true;
      if (this.bakePhotoSize > 0) t.userData.mimeType = 'image/jpeg';
    } else if (image.width > LIVE_PHOTO_MAX) {
      // 2K sets are drawn at 1K for the live view: a quarter of the pixels to upload to the GPU (the
      // first frame of a project used to spend seconds uploading 2K colour, normal and roughness maps).
      const canvas = bakePhotoCanvas(image, entry, LIVE_PHOTO_MAX, 1, null);
      if (!canvas) return null;
      t = new THREE.CanvasTexture(canvas);
    } else {
      t = new THREE.Texture(image);
      t.needsUpdate = true;
    }
    t.colorSpace = map === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = this.photoAnisotropy;
    this.photoTextures.set(key, t);
    return t;
  }

  /** Drops contrast-baked colour maps no material uses any more (slider previews create many). */
  private pruneBakedPhotos() {
    if (this.photoTextures.size < 24) return;
    const used = new Set<unknown>();
    for (const { mat } of this.mats.values()) if (mat.map) used.add(mat.map.source);
    for (const [key, t] of this.photoTextures) {
      if (t.userData.neestBaked && !used.has(t.source)) {
        t.dispose();
        this.photoTextures.delete(key);
      }
    }
  }

  /**
   * Whether a material shows its photo set right now. Null = no photo (none
   * chosen, switched off, or files missing → procedural). Pending = still
   * loading; the material switches over once every map has loaded or failed.
   */
  private activePhoto(def: MaterialDefinition): PhotoState | null {
    const ref = this.photos ? wantsPhoto(def) : null;
    if (!ref) return null;
    const m = getPhotoManifest();
    if (m === undefined) return { entry: null, pending: true };
    const entry = photoEntry(ref.setId);
    if (!entry) return null;
    let pending = false;
    for (const map of this.photoMaps()) {
      const st = photoImage(ref.setId, map);
      if (map === 'color' && !st.image && !st.pending) return null;
      pending ||= st.pending;
    }
    return { entry, pending };
  }

  /** Identifies what the material's maps currently are, so photo loads only touch affected materials. */
  private textureKey(def: MaterialDefinition): string {
    const photo = this.activePhoto(def);
    if (photo?.entry && !photo.pending) {
      const p = def.photo!;
      const extras = this.photoMaps()
        .filter((m) => m !== 'color' && photoImage(p.setId, m).image)
        .join('+');
      return `photo|${p.setId}|${p.scale}|${p.rotation}|${p.contrast}|${extras}|${this.normalMaps}`;
    }
    const t = def.texture;
    return t ? `proc|${t.patternId}|${t.scale}|${t.rotation}|${t.contrast}|${this.normalMaps}` : 'none';
  }

  private apply(entry: Entry, def: MaterialDefinition, prev: MaterialDefinition | null) {
    const mat = entry.mat;
    mat.name = def.name;
    mat.metalness = def.metalness;
    // See-through patterns (wire mesh…): blended through their texture's alpha, both sides visible.
    const cutout = !!def.texture && !!patternInfo(def.texture.patternId)?.cutout;
    const transparent = def.opacity < 0.995 || cutout;
    if (mat.transparent !== transparent) mat.needsUpdate = true;
    mat.transparent = transparent;
    mat.opacity = def.opacity;
    mat.depthWrite = cutout ? false : def.opacity > 0.6;
    const alphaTest = cutout ? 0.02 : 0;
    if (mat.alphaTest !== alphaTest) {
      mat.alphaTest = alphaTest;
      mat.needsUpdate = true;
    }
    mat.side = transparent ? THREE.DoubleSide : THREE.FrontSide;
    if (def.emissive) {
      mat.emissive.set(def.emissive);
      mat.emissiveIntensity = def.emissiveIntensity;
    } else {
      mat.emissive.set('#000000');
      mat.emissiveIntensity = 0;
    }
    mat.envMapIntensity = def.metalness > 0.5 ? 1.2 : 1;
    if (wantsPhoto(def)) this.watchPhotos();
    entry.def = def;
    const key = this.textureKey(def);
    if (!prev || key !== entry.texKey) this.applyTextures(entry);
    else this.applyColour(entry, this.activePhoto(def));
  }

  /** Base colour and roughness; photo maps fold their average back in so the material's values keep their meaning. */
  private applyColour(entry: Entry, photo: PhotoState | null) {
    const { mat, def } = entry;
    mat.color.set(def.color);
    mat.roughness = def.roughness;
    if (!photo?.entry || photo.pending || !mat.userData.neestPhoto) return;
    if (this.bakePhotoSize === 0) {
      const g = photoGain(photo.entry);
      mat.color.setRGB(mat.color.r * g[0], mat.color.g * g[1], mat.color.b * g[2]);
    }
    if (mat.roughnessMap && photo.entry.meanRoughness) mat.roughness = Math.min(4, def.roughness / Math.max(0.05, photo.entry.meanRoughness));
  }

  private applyTextures(entry: Entry) {
    const { mat, def } = entry;
    const had = `${!!mat.map}${!!mat.normalMap}${!!mat.roughnessMap}`;
    mat.map?.dispose();
    mat.normalMap?.dispose();
    mat.roughnessMap?.dispose();
    mat.map = null;
    mat.normalMap = null;
    mat.roughnessMap = null;
    mat.userData.neestPhoto = false;
    const photo = this.activePhoto(def);
    if (photo?.entry && !photo.pending && def.photo) this.applyPhoto(mat, def, photo.entry);
    if (!mat.map && def.texture) this.applyPattern(mat, def);
    entry.texKey = this.textureKey(def);
    this.applyColour(entry, photo);
    if (had !== `${!!mat.map}${!!mat.normalMap}${!!mat.roughnessMap}`) mat.needsUpdate = true;
  }

  private applyPhoto(mat: MeshMat, def: MaterialDefinition, entry: PhotoManifestEntry) {
    const p = def.photo!;
    const base = this.photoTexture(entry, 'color', p.contrast);
    if (!base) return;
    const repeat = 1 / p.scale;
    const rotation = (p.rotation * Math.PI) / 180;
    const place = (t: THREE.Texture) => {
      const c = t.clone();
      c.repeat.set(repeat, repeat);
      c.rotation = rotation;
      c.needsUpdate = true;
      return c;
    };
    mat.map = place(base);
    mat.userData.neestPhoto = true;
    if (this.bakePhotoSize > 0) return;
    if (this.normalMaps && p.contrast > 0.02) {
      const n = this.photoTexture(entry, 'normal', 1);
      if (n) {
        mat.normalMap = place(n);
        mat.normalScale.set(p.contrast, p.contrast);
      }
    }
    const r = this.photoTexture(entry, 'roughness', 1);
    if (r) mat.roughnessMap = place(r);
  }

  private applyPattern(mat: MeshMat, def: MaterialDefinition) {
    const tex = def.texture!;
    const base = this.texture(tex.patternId, tex.contrast);
    if (!base) return;
    const map = base.clone();
    map.repeat.set(1 / tex.scale, 1 / tex.scale);
    map.rotation = (tex.rotation * Math.PI) / 180;
    map.needsUpdate = true;
    mat.map = map;
    const strength = patternInfo(tex.patternId)?.normalStrength ?? 0;
    const nbase = this.normalMaps && strength > 0.05 ? this.normal(tex.patternId) : null;
    if (nbase) {
      const nm = nbase.clone();
      nm.repeat.copy(map.repeat);
      nm.rotation = map.rotation;
      nm.needsUpdate = true;
      mat.normalMap = nm;
      mat.normalScale.set(0.6, 0.6);
    }
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const { mat } of this.mats.values()) {
      mat.map?.dispose();
      mat.normalMap?.dispose();
      mat.roughnessMap?.dispose();
      mat.dispose();
    }
    for (const t of this.baseTextures.values()) t.dispose();
    for (const t of this.normalTextures.values()) t.dispose();
    for (const t of this.photoTextures.values()) t.dispose();
    this.mats.clear();
    this.baseTextures.clear();
    this.normalTextures.clear();
    this.photoTextures.clear();
  }
}
