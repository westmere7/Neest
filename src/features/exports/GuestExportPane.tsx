import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink } from 'lucide-react';
import type { GuestSettings, Project } from '@/domain/model/schema';
import { GUEST_TIMES, guestLayers, guestViews } from '@/domain/walkthrough/guest';
import { useProjectStore } from '@/state/projectStore';
import {
  Button,
  ColorField,
  Field,
  NumberField,
  Section,
  Segmented,
  Select,
  TextField,
  Toggle,
} from '@/components/ui';
import { navigate } from '@/app/App';
import { downloadBlob, exportFilename } from './neestFile';

interface PaneProps {
  project: Project;
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<void>;
}

const setGuest = (label: string, patch: Partial<GuestSettings>) =>
  useProjectStore.getState().execute(label, (d) => {
    Object.assign(d.guest, patch);
  });

const mb = (bytes: number) =>
  bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} kB`;

/** A multi-line text box that commits when it loses focus (one undo step per edit). */
function TextArea({
  label,
  value,
  onCommit,
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <Field label={label}>
      <textarea
        className="input guest-textarea"
        rows={4}
        maxLength={2000}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== value && onCommit(text)}
        onKeyDown={(e) => e.stopPropagation()}
      />
    </Field>
  );
}

/**
 * Guest walkthrough export: settings stored on the project (`project.guest`, shared with the in-app
 * Guest view), an estimated file size (the model is built once and reused for the download) and
 * the download.
 */
export function GuestExport({ project, busy, run }: PaneProps) {
  const g = project.guest;
  const offered = guestViews(project);
  const order = g.viewIds ?? project.cameras.map((c) => c.id);
  const layers = guestLayers({ ...project, guest: { ...g, hiddenItems: true } });
  const hiddenLayers = layers.filter((l) => !l.on).length;
  const setViews = (ids: string[]) => setGuest('Choose guest views', { viewIds: ids });
  const moveView = (id: string, by: number) => {
    const ids = [...order];
    const i = ids.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setViews(ids);
  };
  // Every camera, included ones first in their order, then the rest.
  const listed = [...offered, ...project.cameras.filter((c) => !offered.includes(c))];

  // Estimated size: build the HTML a moment after the settings settle (the model is cached for the download).
  const [size, setSize] = useState<number | null>(null);
  const [measuring, setMeasuring] = useState(true);
  useEffect(() => {
    let live = true;
    setMeasuring(true);
    const t = window.setTimeout(() => {
      void import('./guestExport')
        .then(({ buildGuestHtml }) => buildGuestHtml(project))
        .then((html) => live && setSize(new Blob([html]).size))
        .catch(() => live && setSize(null))
        .finally(() => live && setMeasuring(false));
    }, 700);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [project]);

  return (
    <div className="export-pane guest-export">
      <h3>Guest walkthrough</h3>
      <p className="field-hint">
        One self-contained HTML file with the 3D model, saved views, a 2D plan, first-person walking and
        flying. Recipients just open it in a browser — no Neest account, no internet connection, nothing
        loaded from your device. These settings also apply to the in-app Guest view.
      </p>

      <Section title="Welcome">
        <TextField
          label="Title"
          value={g.title}
          placeholder={project.name}
          maxLength={120}
          onCommit={(title) => setGuest('Set guest title', { title })}
        />
        <TextField
          label="Subtitle"
          value={g.subtitle}
          placeholder="View-only 3D walkthrough"
          maxLength={200}
          onCommit={(subtitle) => setGuest('Set guest subtitle', { subtitle })}
        />
        <Toggle
          label="Welcome card"
          hint="Shown first, with a Start button"
          checked={g.intro}
          onChange={(intro) => setGuest('Toggle guest welcome card', { intro })}
        />
        {g.intro && (
          <TextArea
            label="Welcome note"
            value={g.welcome}
            placeholder="A few words for your guests…"
            onCommit={(welcome) => setGuest('Set guest welcome note', { welcome })}
          />
        )}
        <div className="field">
          <span className="field-label">Overview panel</span>
          <Segmented<GuestSettings['info']>
            label="Overview panel"
            size="sm"
            value={g.info}
            onChange={(info) => setGuest('Set guest overview panel', { info })}
            options={[
              { value: 'open', label: 'Open' },
              { value: 'closed', label: 'Info button' },
              { value: 'off', label: 'Off' },
            ]}
          />
        </div>
        <p className="field-hint">
          Rooms, floor area, items, doors, windows, wall length, overall size and room areas.
        </p>
      </Section>

      <Section title="Views & tour">
        {project.cameras.length > 0 ? (
          <div className="guest-view-list" role="list" aria-label="Saved views offered to guests">
            {listed.map((c) => {
              const on = offered.includes(c);
              const i = order.indexOf(c.id);
              return (
                <div key={c.id} className="guest-view-row" role="listitem">
                  <label>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) =>
                        setViews(
                          e.target.checked
                            ? [...order.filter((id) => offered.some((o) => o.id === id)), c.id]
                            : offered.filter((o) => o.id !== c.id).map((o) => o.id),
                        )
                      }
                    />
                    {c.name}
                  </label>
                  {on && (
                    <span>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Move ${c.name} up`}
                        disabled={i <= 0}
                        onClick={() => moveView(c.id, -1)}
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Move ${c.name} down`}
                        disabled={i >= offered.length - 1}
                        onClick={() => moveView(c.id, 1)}
                      >
                        <ArrowDown size={13} />
                      </button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="field-hint">Save views in the 3D panel to offer them as buttons.</p>
        )}
        <Toggle
          label="Overview and Top views"
          checked={g.overviewViews}
          onChange={(overviewViews) => setGuest('Toggle guest overview views', { overviewViews })}
        />
        <Toggle
          label="2D plan"
          hint="The floor plan; click a spot to walk there"
          checked={g.floorPlan}
          onChange={(floorPlan) => setGuest('Toggle guest floor plan', { floorPlan })}
        />
        <div className="grid-2">
          <Select
            label="Opening view"
            value={g.startCameraId ?? '__overview__'}
            onChange={(v) =>
              setGuest('Set guest start view', { startCameraId: v === '__overview__' ? null : v })
            }
            options={[
              { value: '__overview__', label: 'Overview' },
              ...project.cameras.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <Select<GuestSettings['startMode']>
            label="Start"
            value={g.startMode}
            onChange={(startMode) => setGuest('Set guest start mode', { startMode })}
            options={[
              { value: 'orbit', label: 'Orbiting the view' },
              { value: 'walk', label: 'Walking' },
            ]}
          />
        </div>
        <Toggle
          label="Play the tour on open"
          hint="Cycles the views until the guest takes over"
          checked={g.tour}
          onChange={(tour) => setGuest('Toggle guest tour', { tour })}
        />
        {g.tour && (
          <NumberField
            label="Seconds per view"
            value={g.tourSeconds}
            min={3}
            max={30}
            step={1}
            decimals={0}
            onCommit={(tourSeconds) => setGuest('Set guest tour pace', { tourSeconds })}
          />
        )}
      </Section>

      <Section title="Walkthrough">
        <div className="grid-2">
          <Select
            label="Walking speed"
            value={String(g.walkSpeed)}
            onChange={(v) => setGuest('Set guest walking speed', { walkSpeed: parseFloat(v) })}
            options={[0.5, 0.71, 1, 1.41, 2].map((s) => ({
              value: String(s),
              label: s === 1 ? 'Normal (1×)' : `${s}×`,
            }))}
          />
          <NumberField
            label="Eye height"
            value={g.eyeHeight}
            min={0.8}
            max={2.2}
            step={0.05}
            decimals={2}
            suffix="m"
            onCommit={(eyeHeight) => setGuest('Set guest eye height', { eyeHeight })}
          />
          <Select
            label="Field of view"
            value={g.walkFov === null ? 'auto' : String(g.walkFov)}
            onChange={(v) =>
              setGuest('Set guest field of view', { walkFov: v === 'auto' ? null : parseInt(v, 10) })
            }
            options={[
              { value: 'auto', label: `As in 3D view (${project.render.walkFov}°)` },
              ...[55, 65, 70, 80, 90, 100].map((f) => ({ value: String(f), label: `${f}°` })),
            ]}
          />
        </div>
        <p className="field-hint">
          Guests can also fly (F or the Fly button) and change speed with the mouse wheel.
        </p>
      </Section>

      <Section title="What guests see">
        <div className="field">
          <span className="field-label">Notes</span>
          <Segmented<GuestSettings['notes']>
            label="Notes"
            size="sm"
            value={g.notes}
            onChange={(notes) => setGuest('Set guest notes', { notes })}
            options={[
              { value: 'shown', label: 'Shown' },
              { value: 'hidden', label: 'Hidden at start' },
              { value: 'off', label: 'Left out' },
            ]}
          />
        </div>
        <Toggle
          label="Room names"
          checked={g.roomLabels}
          onChange={(roomLabels) => setGuest('Toggle guest room names', { roomLabels })}
        />
        <Toggle
          label="Ceilings"
          checked={g.ceilings}
          onChange={(ceilings) => setGuest('Toggle guest ceilings', { ceilings })}
        />
        <div className="grid-2">
          <Select<GuestSettings['wallDisplay']>
            label="Walls while orbiting"
            value={g.wallDisplay}
            onChange={(wallDisplay) => setGuest('Set guest walls', { wallDisplay })}
            options={[
              { value: 'full', label: 'Full height' },
              { value: 'cutaway', label: 'Cutaway' },
            ]}
          />
          <NumberField
            label="Cutaway height"
            value={g.cutawayHeight}
            min={0.3}
            max={5}
            step={0.1}
            decimals={2}
            suffix="m"
            onCommit={(cutawayHeight) => setGuest('Set guest cutaway height', { cutawayHeight })}
          />
        </div>
        {hiddenLayers > 0 && (
          <Toggle
            label={`Include hidden item layers (${hiddenLayers})`}
            hint="They start hidden; guests can show them"
            checked={g.hiddenItems}
            onChange={(hiddenItems) => setGuest('Toggle guest hidden layers', { hiddenItems })}
          />
        )}
        <p className="field-hint">
          Guests can switch walls, ceilings, notes, room names, item layers and quality in the viewer's View
          panel.
        </p>
      </Section>

      <Section title="Light & quality">
        <div className="grid-2">
          <Select<GuestSettings['quality']>
            label="Quality"
            value={g.quality}
            onChange={(quality) => setGuest('Set guest quality', { quality })}
            options={[
              { value: 'fast', label: 'Fast (phones, old laptops)' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'high', label: 'High (sharper shadows, more lamps)' },
            ]}
          />
          <Select
            label="Time of day"
            value={g.timeOfDay === null ? 'auto' : String(g.timeOfDay)}
            onChange={(v) =>
              setGuest('Set guest time of day', { timeOfDay: v === 'auto' ? null : parseFloat(v) })
            }
            options={[
              { value: 'auto', label: 'As in 3D view' },
              ...GUEST_TIMES.map((t) => ({ value: String(t.value), label: t.label })),
            ]}
          />
        </div>
        <Toggle
          label="Shadows"
          checked={g.shadows}
          onChange={(shadows) => setGuest('Toggle guest shadows', { shadows })}
        />
        <Toggle
          label="Own background colour"
          checked={g.background !== null}
          onChange={(on) =>
            setGuest('Set guest background', { background: on ? project.render.background : null })
          }
        />
        {g.background !== null && (
          <ColorField
            label="Background"
            value={g.background}
            onCommit={(background) => setGuest('Set guest background', { background })}
          />
        )}
      </Section>

      <Section title="File">
        <div className="field">
          <span className="field-label">Texture resolution</span>
          <Segmented
            label="Texture resolution"
            size="sm"
            value={String(g.textureSize)}
            onChange={(v) =>
              setGuest('Set guest texture size', {
                textureSize: parseInt(v, 10) as GuestSettings['textureSize'],
              })
            }
            options={[
              { value: '512', label: 'Small (512 px)' },
              { value: '1024', label: 'Standard (1K)' },
              { value: '2048', label: 'Sharp (2K)' },
            ]}
          />
        </div>
        <Toggle
          label="Surface detail"
          hint="Normal and roughness maps: relief on wood, tiles and fabric"
          checked={g.surfaceDetail}
          onChange={(surfaceDetail) => setGuest('Toggle guest surface detail', { surfaceDetail })}
        />
      </Section>

      <div className="export-summary" data-testid="guest-size">
        <strong>HTML</strong> ·{' '}
        {measuring && size === null
          ? 'estimating size…'
          : size !== null
            ? `about ${mb(size)}${measuring ? ' (updating…)' : ''}`
            : 'size unknown'}{' '}
        · opens offline, nothing loaded from the internet
      </div>
      <div className="btn-row">
        <Button
          variant="primary"
          disabled={busy}
          data-testid="download-guest"
          onClick={() =>
            run(async () => {
              const { buildGuestHtml } = await import('./guestExport');
              const html = await buildGuestHtml(project);
              downloadBlob(
                new Blob([html], { type: 'text/html' }),
                exportFilename(project.name, 'guest-walkthrough', 'html'),
              );
            })
          }
        >
          {busy ? 'Packaging…' : 'Download guest HTML'}
        </Button>
        <Button onClick={() => navigate(`/guest/${project.id}`)}>
          <ExternalLink size={14} /> Open Guest view
        </Button>
      </div>
    </div>
  );
}
