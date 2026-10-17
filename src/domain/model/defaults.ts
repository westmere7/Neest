import { DEFAULT_MATERIALS, MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';
import { newId } from './ids';
import {
  PROJECT_FORMAT,
  SCHEMA_VERSION,
  type LengthUnit,
  type MaterialDefinition,
  type OpeningKind,
  type Project,
  type RoomType,
} from './schema';

export interface NewProjectOptions {
  name?: string;
  units?: LengthUnit;
  wallHeight?: number;
  interiorThickness?: number;
  exteriorThickness?: number;
}

export function defaultMaterialSet(): Record<string, MaterialDefinition> {
  const out: Record<string, MaterialDefinition> = {};
  for (const id of Object.values(DEFAULT_MATERIALS)) {
    const m = MATERIAL_CATALOG_BY_ID[id];
    if (m) out[id] = structuredClone(m);
  }
  return out;
}

export function createEmptyProject(opts: NewProjectOptions = {}): Project {
  const now = Date.now();
  const imperial = opts.units === 'ft' || opts.units === 'in';
  return {
    format: PROJECT_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    id: newId('prj'),
    name: opts.name?.trim() || 'Untitled apartment',
    createdAt: now,
    updatedAt: now,
    settings: {
      units: opts.units ?? 'm',
      precision: 2,
      areaUnit: imperial ? 'ft2' : 'm2',
      gridSize: imperial ? 0.1524 : 0.1,
      defaultWall: {
        thickness: opts.interiorThickness ?? 0.12,
        height: opts.wallHeight ?? 2.7,
        role: 'interior',
      },
      exteriorThickness: opts.exteriorThickness ?? 0.3,
      showRoomLabels: true,
      showRoomAreas: true,
      dimensions: { overall: true, walls: false, rooms: true },
    },
    nodes: {},
    walls: {},
    openings: {},
    rooms: {},
    objects: {},
    materials: defaultMaterialSet(),
    customAssets: {},
    cameras: [],
    render: {
      quality: 'balanced',
      exposure: 1,
      timeOfDay: 14,
      sunAzimuth: 135,
      sunIntensity: 2.2,
      envIntensity: 0.9,
      shadows: true,
      background: '#dfe3e6',
      wallDisplay: 'full',
      cutawayHeight: 1.2,
      showCeilings: false,
      showRoomLabels: false,
      hiddenCategories: [],
    },
    layers: {
      construction: { visible: true, locked: false },
      furniture: { visible: true, locked: false },
      annotations: { visible: true, locked: false },
    },
    guest: { startCameraId: null, spawn: null, spawnAngle: 0 },
  };
}

export interface OpeningPreset {
  kind: OpeningKind;
  label: string;
  width: number;
  height: number;
  sill: number;
  style: 'flush' | 'panel' | 'glazed';
}

export const OPENING_PRESETS: Record<OpeningKind, OpeningPreset> = {
  'door-single': { kind: 'door-single', label: 'Single door', width: 0.9, height: 2.1, sill: 0, style: 'flush' },
  'door-double': { kind: 'door-double', label: 'Double door', width: 1.4, height: 2.1, sill: 0, style: 'panel' },
  'door-sliding': { kind: 'door-sliding', label: 'Sliding door', width: 1.6, height: 2.1, sill: 0, style: 'glazed' },
  passage: { kind: 'passage', label: 'Open passage', width: 0.9, height: 2.1, sill: 0, style: 'flush' },
  'window-single': { kind: 'window-single', label: 'Casement window', width: 0.7, height: 1.2, sill: 0.9, style: 'glazed' },
  'window-double': { kind: 'window-double', label: 'Double casement', width: 1.2, height: 1.3, sill: 0.9, style: 'glazed' },
  'window-fixed': { kind: 'window-fixed', label: 'Picture window', width: 1.6, height: 1.5, sill: 0.6, style: 'glazed' },
  'window-sliding': { kind: 'window-sliding', label: 'Sliding window', width: 1.4, height: 1.3, sill: 0.9, style: 'glazed' },
};

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  living: 'Living room',
  bedroom: 'Bedroom',
  kitchen: 'Kitchen',
  dining: 'Dining room',
  bathroom: 'Bathroom',
  wc: 'WC',
  hall: 'Hallway',
  office: 'Office',
  storage: 'Storage',
  laundry: 'Laundry',
  balcony: 'Balcony',
  other: 'Room',
};
