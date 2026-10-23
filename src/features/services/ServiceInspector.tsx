import { useMemo } from 'react';
import type { Project, ServicePoint } from '@/domain/model/schema';
import { derivePlan } from '@/domain/geometry/derive';
import { compatiblePoints, placeServicePoint, runLength, servicePointAt } from '@/domain/geometry/services';
import { toast } from '@/state/uiStores';
import { updateServicePoint, updateServiceRun } from '@/domain/commands/services';
import { formatLength } from '@/domain/model/units';
import {
  SERVICE_HOST_LABELS,
  SERVICE_POINTS,
  SERVICE_SYSTEM_INFO,
  neededSystems,
  pointKindsOf,
  type ServicePointKind,
} from '@/domain/model/services';
import { getAsset, getObjectAsset } from '@/data/assets/registry';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { Button, LengthField, Section, Segmented, Select, TextField, Toggle } from '@/components/ui';
import { PointIcon, SystemIcon } from './ServiceIcon';
import { addMissingPoints, connect, disconnect, resetConnections, setServicesMode } from './actions';
import { servicesState } from './needs';
import './services.css';

const exec = (label: string, fn: Parameters<ReturnType<typeof useProjectStore.getState>['execute']>[1]) => useProjectStore.getState().execute(label, fn);

const itemName = (project: Project, id: string) => {
  const o = project.objects[id];
  return o ? (o.name ?? getObjectAsset(project, o)?.name ?? 'Item') : 'Item';
};

/** Inspector body of a selected services point. */
export function ServicePointInspector({ project, id }: { project: Project; id: string }) {
  const p = project.servicePoints?.[id];
  const derived = useMemo(() => derivePlan(project), [project]);
  if (!p) return null;
  const info = SERVICE_POINTS[p.kind];
  const u = project.settings;
  const serves = servicesState(project, derived).serves.get(id) ?? [];
  // A new kind or host re-places the point (into the nearest wall, or onto the room floor); refused where it can't go.
  const moveTo = (kind: ServicePointKind, host: ServicePoint['host']) => {
    const at = servicePointAt(derived, p);
    const pl = placeServicePoint(derived, kind, at, host, 1.5);
    if (!pl.valid) return toast.info(pl.reason ?? 'It can’t go there');
    exec('Change point', (d) => updateServicePoint(d, id, { kind, host: pl.host, x: pl.x, y: pl.y, wallId: pl.wallId, rotation: pl.rotation }));
  };
  return (
    <div className="pad">
      <div className="svc-need" style={{ marginBottom: 8 }}>
        <PointIcon kind={p.kind} size={26} />
        <div>
          <div className="svc-need-title">{info.name}</div>
          <div className="svc-need-state">
            {info.vn} · {SERVICE_SYSTEM_INFO[info.system].name}
          </div>
        </div>
      </div>
      <p className="field-hint">{info.description}</p>
      <Select<ServicePointKind>
        label="Kind"
        value={p.kind}
        options={pointKindsOf(info.system).map((k) => ({ value: k, label: SERVICE_POINTS[k].name }))}
        onChange={(kind) => moveTo(kind, SERVICE_POINTS[kind].hosts.includes(p.host) ? p.host : SERVICE_POINTS[kind].hosts[0])}
      />
      {info.hosts.length > 1 && (
        <Segmented
          label="Where it sits"
          size="sm"
          value={p.host}
          onChange={(host) => moveTo(p.kind, host)}
          options={info.hosts.map((h) => ({ value: h, label: SERVICE_HOST_LABELS[h] }))}
        />
      )}
      {p.host === 'wall' && (
        <LengthField label="Height above floor" value={p.height} unit={u.units} precision={u.precision} min={0} max={6} onCommit={(height) => exec('Point height', (d) => updateServicePoint(d, id, { height }))} />
      )}
      {p.host === 'wall' && !p.wallId && <p className="notice">Not in a wall any more: drag it onto a wall.</p>}
      <TextField label="Label" value={p.label} placeholder={info.name} maxLength={60} onCommit={(label) => exec('Rename point', (d) => updateServicePoint(d, id, { label }))} />
      <TextField label="Note" value={p.note} placeholder="Circuit, breaker, size…" maxLength={500} onCommit={(note) => exec('Point note', (d) => updateServicePoint(d, id, { note }))} />
      <p className="field-hint">{serves.length ? `Serves ${serves.map((o) => itemName(project, o)).join(', ')}.` : 'No item is connected to it.'}</p>
    </div>
  );
}

/** Inspector body of a selected services run. */
export function ServiceRunInspector({ project, id }: { project: Project; id: string }) {
  const r = project.serviceRuns?.[id];
  if (!r) return null;
  const u = project.settings;
  const levels = SERVICE_SYSTEM_INFO[r.system].levels;
  return (
    <div className="pad">
      <div className="svc-need" style={{ marginBottom: 8 }}>
        <SystemIcon system={r.system} size={22} />
        <div>
          <div className="svc-need-title">{SERVICE_SYSTEM_INFO[r.system].run}</div>
          <div className="svc-need-state">
            {formatLength(runLength(r), u.units, u.precision)} · {r.points.length - 2} bend{r.points.length === 3 ? '' : 's'}
          </div>
        </div>
      </div>
      {levels.length > 1 ? (
        <Segmented label="Where it runs" size="sm" value={r.level} onChange={(level) => exec('Change run', (d) => updateServiceRun(d, id, { level }))} options={levels.map((l) => ({ value: l, label: SERVICE_HOST_LABELS[l] }))} />
      ) : (
        <p className="field-hint">Drain pipes run in the floor.</p>
      )}
      {r.level === 'wall' && <LengthField label="Height in the wall" value={r.height} unit={u.units} precision={u.precision} min={0} max={6} onCommit={(height) => exec('Run height', (d) => updateServiceRun(d, id, { height }))} />}
      {r.system === 'water' && <Toggle label="Hot water line" checked={r.hot} onChange={(hot) => exec('Change run', (d) => updateServiceRun(d, id, { hot }))} />}
      <TextField label="Label" value={r.label} placeholder="Circuit, pipe size…" maxLength={60} onCommit={(label) => exec('Rename run', (d) => updateServiceRun(d, id, { label }))} />
      <p className="field-hint">Drag a bend to move it; double-click the run to add a bend, right-click a bend to remove it.</p>
    </div>
  );
}

/**
 * An item's Services section: what it needs and what serves it, with Connect to another point,
 * Disconnect and Add point; shown for every item that needs power, water or a drain.
 */
export function ItemServices({ project, objectId }: { project: Project; objectId: string }) {
  const o = project.objects[objectId];
  const derived = useMemo(() => derivePlan(project), [project]);
  const servicesMode = useEditorStore((s) => s.servicesMode);
  const needs = o ? getAsset(project, o.assetId)?.services : undefined;
  if (!o || !needs || !neededSystems(needs).length) return null;
  const state = servicesState(project, derived).needs.filter((n) => n.objectId === objectId);
  const u = project.settings;
  return (
    <Section title="Services">
      <div className="svc-needs">
        {state.map((n) => {
          const options = compatiblePoints(project, derived, o, n.system, needs);
          const pt = n.link ? project.servicePoints?.[n.link.pointId] : undefined;
          return (
            <div key={n.system} className="svc-need" data-testid={`item-need-${n.system}`}>
              <SystemIcon system={n.system} size={18} missing={!n.met} />
              <span className="svc-need-title">{n.need}</span>
              <span className={`svc-need-state${n.met ? '' : ' missing'}`}>
                {n.link && pt
                  ? `${n.link.manual ? 'Connected' : 'Nearest'}: ${pt.label || SERVICE_POINTS[pt.kind].name}, ${formatLength(n.link.distance, u.units, u.precision)} away`
                  : n.byRun
                    ? 'Fed by a run'
                    : 'Nothing in reach'}
              </span>
              {servicesMode && (
                <div className="svc-need-actions">
                  {options.length > 0 && (
                    <select
                      className="input input-sm"
                      aria-label={`Connect ${n.need.toLowerCase()} to`}
                      value={n.link?.pointId ?? ''}
                      onChange={(e) => e.target.value && connect(objectId, n.system, e.target.value)}
                    >
                      <option value="">Connect to…</option>
                      {options.map(({ pt: p, d }) => (
                        <option key={p.id} value={p.id}>
                          {p.label || SERVICE_POINTS[p.kind].name} · {formatLength(d, u.units, 1)}
                        </option>
                      ))}
                    </select>
                  )}
                  {n.link && (
                    <Button size="sm" onClick={() => disconnect(n.link!)}>
                      Disconnect
                    </Button>
                  )}
                  {!n.met && (
                    <Button size="sm" variant="primary" onClick={() => void addMissingPoints([objectId])}>
                      Add point
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {servicesMode ? (
        o.serviceLinks && (
          <Button size="sm" onClick={() => resetConnections([objectId])}>
            Reset connections
          </Button>
        )
      ) : (
        <Button size="sm" onClick={() => setServicesMode(true)} data-testid="show-services">
          Show in Services mode
        </Button>
      )}
    </Section>
  );
}
