import { useMemo } from 'react';
import { Eye, EyeOff, Plug, Route, Sparkles, X } from 'lucide-react';
import { derivePlan } from '@/domain/geometry/derive';
import { servicesSummary } from '@/domain/geometry/services';
import { formatLength } from '@/domain/model/units';
import {
  SERVICE_COLORS,
  SERVICE_HOST_LABELS,
  SERVICE_POINTS,
  SERVICE_SYSTEMS,
  SERVICE_SYSTEM_INFO,
  MAIN_POINT_KINDS,
  pointKindsOf,
  type ServiceSystem,
} from '@/domain/model/services';
import { getObjectAsset } from '@/data/assets/registry';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { Button, IconButton, LengthField, Section, Segmented } from '@/components/ui';
import { PointIcon, SystemIcon } from './ServiceIcon';
import { RUN_DASH } from './ServicesSvg';
import { addMissingPoints, armPoint, armRun, connectToSources, setServicesMode } from './actions';
import { servicesState } from './needs';
import './services.css';

/**
 * The Services panel (left, in the library's place while Services mode is on): systems with
 * show/hide, the points and runs to add, items whose needs nothing serves yet, routing and totals.
 */
export function ServicesPanel() {
  const project = useProjectStore((s) => s.project!);
  const derived = useMemo(() => derivePlan(project), [project]);
  const state = servicesState(project, derived);
  const summary = servicesSummary(project);
  const shown = useEditorStore((s) => s.servicesShown);
  const tool = useEditorStore((s) => s.tool);
  const serviceKind = useEditorStore((s) => s.serviceKind);
  const runSystem = useEditorStore((s) => s.runSystem);
  const runHot = useEditorStore((s) => s.runHot);
  const runLevel = useEditorStore((s) => s.runLevel);
  const runHeight = useEditorStore((s) => s.runHeight);
  const set = useEditorStore((s) => s.set);
  const u = project.settings;
  const len = (m: number) => formatLength(m, u.units, 1);
  const unmet = state.needs.filter((n) => !n.met);
  const pointCount = (sys: ServiceSystem) => pointKindsOf(sys).reduce((n, k) => n + (summary.points[k] ?? 0), 0);
  const levels = SERVICE_SYSTEM_INFO[runSystem].levels;

  return (
    <aside className="library floating services-panel" aria-label="Services" data-testid="services-panel">
      <header className="library-head">
        <div className="svc-title">
          <strong>Services</strong>
          <span>Power & plumbing · X-ray</span>
        </div>
        <IconButton label="Leave Services mode" shortcut="U" onClick={() => setServicesMode(false)} data-testid="services-close">
          <X size={16} />
        </IconButton>
      </header>
      <div className="library-body services-body">
        <div className="svc-systems" role="group" aria-label="Systems">
          {SERVICE_SYSTEMS.map((sys) => (
            <button
              key={sys}
              type="button"
              className={`svc-system${shown[sys] ? '' : ' off'}`}
              aria-pressed={shown[sys]}
              title={shown[sys] ? `Hide ${SERVICE_SYSTEM_INFO[sys].name.toLowerCase()}` : `Show ${SERVICE_SYSTEM_INFO[sys].name.toLowerCase()}`}
              onClick={() => set({ servicesShown: { ...shown, [sys]: !shown[sys] } })}
              data-testid={`svc-show-${sys}`}
            >
              <SystemIcon system={sys} size={18} />
              <span className="svc-system-name">{SERVICE_SYSTEM_INFO[sys].name}</span>
              <span className="svc-system-count num">{pointCount(sys)}</span>
              {shown[sys] ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          ))}
        </div>

        <Section title="Add a point">
          {/* The mains first (where power and water come in, waste leaves), then each system's points. */}
          {[MAIN_POINT_KINDS, ...SERVICE_SYSTEMS.map((sys) => pointKindsOf(sys).filter((k) => !SERVICE_POINTS[k].source))].map((kinds, row) => (
            <div key={row} className={`svc-kinds${row === 0 ? ' mains' : ''}`}>
              {row === 0 && <span className="svc-kinds-title">Mains</span>}
              {kinds.map((k) => {
                const info = SERVICE_POINTS[k];
                const on = tool === 'service' && serviceKind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    className={`svc-kind${on ? ' on' : ''}`}
                    aria-pressed={on}
                    title={`${info.name} (${info.vn}) — ${info.description} ${info.hosts.map((h) => SERVICE_HOST_LABELS[h]).join(' or ')}.`}
                    onClick={() => (on ? set({ tool: 'select' }) : armPoint(k))}
                    data-testid={`svc-kind-${k}`}
                  >
                    <PointIcon kind={k} size={22} />
                    <span>{info.name}</span>
                  </button>
                );
              })}
            </div>
          ))}
          <p className="field-hint">Wall points go into the nearest wall; drains only in the floor.</p>
        </Section>

        <Section title="Draw a run">
          <div className="svc-runs">
            {(
              [
                ['power', false, 'Wiring'],
                ['water', false, 'Cold water'],
                ['water', true, 'Hot water'],
                ['drain', false, 'Drain pipe'],
              ] as const
            ).map(([sys, hot, label]) => {
              const on = tool === 'run' && runSystem === sys && (sys !== 'water' || runHot === hot);
              const color = hot ? SERVICE_COLORS.hot : SERVICE_COLORS[sys];
              return (
                <button key={label} type="button" className={`svc-run-btn${on ? ' on' : ''}`} aria-pressed={on} onClick={() => (on ? set({ tool: 'select' }) : armRun(sys, hot))} data-testid={`svc-run-${sys}${hot ? '-hot' : ''}`}>
                  <svg width={26} height={10} aria-hidden>
                    <line x1={1} y1={5} x2={25} y2={5} stroke={color} strokeWidth={sys === 'drain' ? 4 : 2.6} strokeLinecap="round" />
                  </svg>
                  {label}
                </button>
              );
            })}
          </div>
          {tool === 'run' && (
            <div className="svc-run-options">
              {levels.length > 1 ? (
                <Segmented
                  label="Where the run goes"
                  size="sm"
                  value={levels.includes(runLevel) ? runLevel : levels[0]}
                  onChange={(v) => set({ runLevel: v })}
                  options={levels.map((l) => ({ value: l, label: SERVICE_HOST_LABELS[l] }))}
                />
              ) : (
                <p className="field-hint">Drain pipes run in the floor.</p>
              )}
              {runLevel === 'wall' && levels.includes('wall') && (
                <LengthField label="Height in the wall" value={runHeight} unit={u.units} precision={u.precision} min={0} max={6} onCommit={(v) => set({ runHeight: v })} />
              )}
              <p className="field-hint">Click the bends; click a point or an item to end. Double-click or Enter ends, Backspace undoes a bend.</p>
            </div>
          )}
          <div className="svc-line-legend" aria-label="Line styles">
            {(['wall', 'floor', 'ceiling'] as const).map((l) => (
              <span key={l}>
                <svg width={26} height={8} aria-hidden>
                  <line x1={1} y1={4} x2={25} y2={4} stroke="currentColor" strokeWidth={2} strokeDasharray={RUN_DASH[l]?.join(' ')} />
                </svg>
                {SERVICE_HOST_LABELS[l]}
              </span>
            ))}
            <span>
              <svg width={26} height={8} aria-hidden>
                <line x1={1} y1={4} x2={25} y2={4} stroke="currentColor" strokeWidth={1.2} strokeDasharray="4 3" />
              </svg>
              Connection
            </span>
          </div>
        </Section>

        <Section title={unmet.length ? `Not connected (${unmet.length})` : 'Connections'}>
          {unmet.length ? (
            <>
              <ul className="svc-issues">
                {unmet.slice(0, 60).map((n) => {
                  const o = project.objects[n.objectId];
                  const name = o?.name ?? (o ? getObjectAsset(project, o)?.name : null) ?? 'Item';
                  return (
                    <li key={`${n.objectId}:${n.system}`}>
                      <button
                        type="button"
                        className="svc-issue"
                        title="Select the item"
                        onClick={() => {
                          useEditorStore.getState().setSelection([{ kind: 'object', id: n.objectId }]);
                          useEditorStore.getState().requestFocus();
                        }}
                      >
                        <SystemIcon system={n.system} size={15} missing />
                        <span className="svc-issue-name">{name}</span>
                        <span className="svc-issue-need">{n.need}</span>
                      </button>
                      <IconButton label="Add a point for it" onClick={() => void addMissingPoints([n.objectId])}>
                        <Plug size={14} />
                      </IconButton>
                    </li>
                  );
                })}
              </ul>
              <Button size="sm" variant="primary" onClick={() => void addMissingPoints()} data-testid="svc-add-missing">
                <Sparkles size={14} /> Add all missing points
              </Button>
            </>
          ) : (
            <p className="field-hint">{state.needs.length ? `All ${state.needs.length} needs of the placed items are connected.` : 'No placed item needs power or water yet.'}</p>
          )}
          <p className="field-hint">Items connect to the nearest suitable point in reach (dashed lines). Right-click a line to disconnect; pick another point in the item’s panel.</p>
        </Section>

        <Section title="Runs & totals">
          <Button size="sm" onClick={() => void connectToSources()} data-testid="svc-route">
            <Route size={14} /> Route runs to sources
          </Button>
          <p className="field-hint">Chains every point without a run back to its main: Power in, Water in or Waste out.</p>
          <table className="svc-totals">
            <tbody>
              {SERVICE_SYSTEMS.map((sys) => (
                <tr key={sys}>
                  <th>
                    <SystemIcon system={sys} size={14} /> {SERVICE_SYSTEM_INFO[sys].run}
                  </th>
                  <td className="num">{len(summary.lengths[sys])}</td>
                  <td className="num">{pointCount(sys)} pts</td>
                </tr>
              ))}
              {summary.hot > 0 && (
                <tr>
                  <th>&nbsp;&nbsp;of which hot</th>
                  <td className="num">{len(summary.hot)}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </Section>
      </div>
    </aside>
  );
}
