import { Button, Toggle } from '@/components/ui';
import { useProjectStore } from '@/state/projectStore';
import type { Project } from '@/domain/model/schema';

type Dims = Project['settings']['dimensions'];

const BASIC: [keyof Dims, string][] = [
  ['overall', 'Overall dimensions'],
  ['walls', 'Wall lengths'],
  ['rooms', 'Room dimensions'],
];
const DETAIL: [keyof Dims, string][] = [
  ['openings', 'Door & window widths'],
  ['thickness', 'Wall thickness'],
  ['objects', 'Item sizes'],
];

/** Shows or hides every callout, in the plan, in 3D and in exports (the Callouts layer). */
export function CalloutsToggle() {
  const visible = useProjectStore((s) => s.project!.layers.callouts?.visible ?? true);
  const count = useProjectStore((s) => Object.keys(s.project!.callouts ?? {}).length);
  const exec = useProjectStore((s) => s.execute);
  return (
    <Toggle
      label={count ? `Callouts (${count})` : 'Callouts'}
      checked={visible}
      onChange={(v) => exec(v ? 'Show callouts' : 'Hide callouts', (d) => void (d.layers.callouts.visible = v))}
    />
  );
}

/**
 * Plan annotations (Project panel and Project settings): room labels, the basic dimensions and
 * the detailed ones (openings, wall thickness, every item's width and depth).
 */
export function AnnotationToggles() {
  const u = useProjectStore((s) => s.project!.settings);
  const callouts = useProjectStore((s) => s.project!.layers.callouts?.visible ?? true);
  const exec = useProjectStore((s) => s.execute);
  const setDim = (key: keyof Dims, v: boolean) => exec('Toggle dimensions', (d) => void (d.settings.dimensions[key] = v));
  const all = [...BASIC, ...DETAIL].every(([k]) => u.dimensions[k]) && u.showRoomLabels && u.showRoomAreas && callouts;
  return (
    <div className="annotation-toggles">
      <Toggle label="Room names" checked={u.showRoomLabels} onChange={(v) => exec('Toggle room names', (d) => void (d.settings.showRoomLabels = v))} />
      <Toggle label="Room areas" checked={u.showRoomAreas} onChange={(v) => exec('Toggle room areas', (d) => void (d.settings.showRoomAreas = v))} />
      <CalloutsToggle />
      <p className="field-hint annotation-head">Basic dimensions</p>
      {BASIC.map(([k, label]) => (
        <Toggle key={k} label={label} checked={u.dimensions[k]} onChange={(v) => setDim(k, v)} />
      ))}
      <p className="field-hint annotation-head">Detailed dimensions</p>
      {DETAIL.map(([k, label]) => (
        <Toggle key={k} label={label} checked={u.dimensions[k]} onChange={(v) => setDim(k, v)} />
      ))}
      <div className="btn-row">
        <Button
          size="sm"
          disabled={all}
          onClick={() =>
            exec('Show all annotations', (d) => {
              d.settings.showRoomLabels = true;
              d.settings.showRoomAreas = true;
              d.layers.callouts.visible = true;
              for (const [k] of [...BASIC, ...DETAIL]) d.settings.dimensions[k] = true;
            })
          }
        >
          Show all
        </Button>
        <Button
          size="sm"
          onClick={() =>
            exec('Basic annotations', (d) => {
              d.settings.showRoomLabels = true;
              d.settings.showRoomAreas = true;
              d.settings.dimensions = { overall: true, walls: false, rooms: true, openings: false, thickness: false, objects: false };
            })
          }
        >
          Basic only
        </Button>
      </div>
    </div>
  );
}
