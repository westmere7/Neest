import { useState } from 'react';
import { Upload } from 'lucide-react';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { CustomAsset, Vec2 } from '@/domain/model/schema';
import { newId } from '@/domain/model/ids';
import { convexHull } from '@/domain/geometry/polygon';
import { formatLength } from '@/domain/model/units';
import { blobRepository } from '@/storage/indexeddb/db';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { toast } from '@/state/uiStores';
import { Dialog } from '@/components/Overlays';
import { Button, Field, Select } from '@/components/ui';
import { parseGlb } from '@/features/scene-3d/customModels';

export const MAX_MODEL_BYTES = 60 * 1024 * 1024;

interface Parsed {
  glb: ArrayBuffer;
  scene: THREE.Object3D;
  size: THREE.Vector3;
  hull: Vec2[];
  preview: string | null;
  fileName: string;
}

const UNIT_SCALES = { m: 1, cm: 0.01, mm: 0.001, in: 0.0254 } as const;

/** Imports a GLB (or self-contained glTF) model from the user's computer into the project. */
export function ImportModelDialog({ onClose }: { onClose: () => void }) {
  const units = useProjectStore((s) => s.project!.settings.units);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [license, setLicense] = useState('');
  const [unit, setUnit] = useState<keyof typeof UNIT_SCALES>('m');

  const onFile = async (file: File) => {
    setError(null);
    setParsed(null);
    if (file.size > MAX_MODEL_BYTES) return setError(`The file is larger than ${MAX_MODEL_BYTES / 1024 / 1024} MB.`);
    if (!/\.(glb|gltf)$/i.test(file.name)) return setError('Choose a .glb or .gltf file.');
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const isGlb = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(4, buf.byteLength))) === 'glTF';
      if (!isGlb && /\.glb$/i.test(file.name)) throw new Error('This .glb file is not valid binary glTF.');
      if (!isGlb) {
        const text = new TextDecoder().decode(buf);
        if (/"uri"\s*:\s*"(?!data:)/.test(text)) throw new Error('This .gltf references external files. Export it as a single .glb (or embed its resources) and try again.');
      }
      const scene = await parseGlb(buf);
      let meshes = 0;
      scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) meshes++;
      });
      if (!meshes) throw new Error('The model contains no visible geometry.');
      const glb = isGlb ? buf : ((await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer);
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      // Top-down footprint hull (sampled vertices, normalised to -0.5..0.5).
      const pts: Vec2[] = [];
      const v = new THREE.Vector3();
      scene.updateMatrixWorld(true);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const pos = m.geometry.getAttribute('position');
        const step = Math.max(1, Math.floor(pos.count / 4000));
        for (let i = 0; i < pos.count; i += step) {
          v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
          pts.push({ x: (v.x - (box.min.x + box.max.x) / 2) / Math.max(size.x, 1e-6), y: (v.z - (box.min.z + box.max.z) / 2) / Math.max(size.z, 1e-6) });
        }
      });
      const hull = convexHull(pts);
      const preview = renderPreview(scene);
      setParsed({ glb, scene, size, hull, preview, fileName: file.name });
      setName(file.name.replace(/\.(glb|gltf)$/i, '').replace(/[_-]+/g, ' ').slice(0, 60) || 'Imported model');
      if (Math.max(size.x, size.y, size.z) > 40) setUnit('cm');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The model could not be read.');
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!parsed) return;
    setBusy(true);
    try {
      const k = UNIT_SCALES[unit];
      const blobId = newId('blob');
      await blobRepository.put({ id: blobId, name: parsed.fileName, type: 'model/gltf-binary', size: parsed.glb.byteLength, data: new Blob([parsed.glb], { type: 'model/gltf-binary' }) });
      const asset: CustomAsset = {
        id: newId('custom'),
        name: name.trim() || 'Imported model',
        category: 'custom',
        blobId,
        fileName: parsed.fileName,
        byteSize: parsed.glb.byteLength,
        size: { w: Math.max(0.01, parsed.size.x * k), d: Math.max(0.01, parsed.size.z * k), h: Math.max(0.01, parsed.size.y * k) },
        footprint: parsed.hull,
        importedAt: Date.now(),
        license: license.trim() || null,
      };
      useProjectStore.getState().execute('Import model', (d) => {
        d.customAssets[asset.id] = asset;
      });
      useEditorStore.getState().set({ tool: 'place', placeAssetId: asset.id, workspace: useEditorStore.getState().workspace === '3d' ? 'plan' : useEditorStore.getState().workspace });
      toast.success('Model imported', 'Click on the plan to place it. It is stored with this project.');
      onClose();
    } catch (e) {
      toast.error('Import failed', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const k = UNIT_SCALES[unit];
  return (
    <Dialog
      title="Import 3D model"
      onClose={onClose}
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!parsed || busy} onClick={() => void add()}>
            Add to project
          </Button>
        </>
      }
    >
      <div className="import-model-body">
        <label className="drop-zone">
          <Upload size={18} />
          <span>{busy ? 'Reading model…' : 'Choose a .glb file (or self-contained .gltf), up to 60 MB'}</span>
          <input type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])} />
        </label>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {parsed && (
          <div className="import-preview">
            <div className="import-thumb">{parsed.preview ? <img src={parsed.preview} alt="Model preview" /> : <span>No preview</span>}</div>
            <div className="form-grid">
              <Field label="Name">
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
              </Field>
              <Select
                label="Model units"
                value={unit}
                onChange={setUnit}
                options={[
                  { value: 'm', label: 'Metres (glTF standard)' },
                  { value: 'cm', label: 'Centimetres' },
                  { value: 'mm', label: 'Millimetres' },
                  { value: 'in', label: 'Inches' },
                ]}
              />
              <p className="field-hint num">
                Size: {formatLength(parsed.size.x * k, units, 2)} × {formatLength(parsed.size.z * k, units, 2)} × {formatLength(parsed.size.y * k, units, 2)} (W × D × H)
              </p>
              <Field label="Source / licence (optional)" hint="e.g. CC0 from …, or your own model">
                <input className="input" value={license} onChange={(e) => setLicense(e.target.value)} maxLength={200} />
              </Field>
            </div>
          </div>
        )}
        <p className="field-hint">The file stays on this device (stored in the browser) and is included in .neest exports, GLB exports and guest walkthroughs.</p>
      </div>
    </Dialog>
  );
}

function renderPreview(object: THREE.Object3D): string | null {
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(220, 220, false);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#99938a', 1.6));
    const dl = new THREE.DirectionalLight('#ffffff', 1.5);
    dl.position.set(3, 5, 4);
    scene.add(dl);
    const clone = object.clone(true);
    scene.add(clone);
    const box = new THREE.Box3().setFromObject(clone);
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.01);
    const cam = new THREE.PerspectiveCamera(30, 1, r / 100, r * 50);
    cam.position.copy(c).add(new THREE.Vector3(0.75, 0.62, 1).normalize().multiplyScalar(r / Math.sin((15 * Math.PI) / 180)));
    cam.lookAt(c);
    renderer.render(scene, cam);
    const url = renderer.domElement.toDataURL('image/png');
    renderer.dispose();
    renderer.forceContextLoss();
    return url;
  } catch {
    return null;
  }
}
