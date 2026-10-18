import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import '@/packs/loader';
import { ASSET_CATALOG } from './catalog';
import { HUMAN_POSES, humanFigure, humanPoseTargets } from './humanParts';
import PEOPLE_MODELS from './peopleModels.json';

const root = path.resolve(__dirname, '../../..');
const people = ASSET_CATALOG.filter((a) => a.category === 'people');

describe('people', () => {
  it('builds standing figures at their stature', () => {
    for (const [stature, sex] of [
      [1.58, 'female'],
      [1.68, 'male'],
      [1.2, 'female'],
    ] as const) {
      const fig = humanFigure({ stature, sex, age: stature < 1.4 ? 'child' : 'adult' }, HUMAN_POSES.stand);
      expect(fig.size.h).toBeGreaterThan(stature * 0.95);
      expect(fig.size.h).toBeLessThan(stature * 1.04);
    }
  });

  it('pose targets are unit directions', () => {
    for (const pose of Object.values(HUMAN_POSES)) {
      const t = humanPoseTargets(pose);
      for (const v of [t.armL.upper, t.armL.fore, t.legR.thigh, t.legR.shin, t.legR.foot]) expect(Math.hypot(...v)).toBeCloseTo(1, 5);
    }
  });

  it('every figure has its baked model, and the manifest matches the files (npm run people)', () => {
    expect(people.length).toBeGreaterThanOrEqual(30);
    const models = PEOPLE_MODELS as Record<string, { file: string; hash: string; slots: string[] }>;
    for (const a of people) {
      const id = a.id.split(':').pop()!;
      const m = models[id];
      expect(m, `${a.id}: run npm run people`).toBeDefined();
      expect(a.model?.url).toBe(m.file);
      const file = path.join(root, 'public', m.file);
      expect(existsSync(file), file).toBe(true);
      expect(createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 12), `${a.id}: stale manifest`).toBe(m.hash);
      const slots = new Set(a.slots.map((s) => s.id));
      for (const s of m.slots) expect(slots.has(s), `${a.id}: model slot ${s} has no material slot`).toBe(true);
    }
  });
});
