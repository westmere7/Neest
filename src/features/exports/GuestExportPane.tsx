import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useIsMobile } from '@/components/hooks';
import type { GuestSettings, Project } from '@/domain/model/schema';
import { GUEST_TIMES, guestLayers, guestOptions } from '@/domain/walkthrough/guest';
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
import { listOptions } from '@/domain/commands/options';
import { downloadBlob, exportFilename } from './neestFile';
import { GuestLiveLink } from './GuestLiveLink';

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
  const layers = guestLayers({ ...project, guest: { ...g, hiddenItems: true } });
  const hiddenLayers = layers.filter((l) => !l.on).length;
  const { options } = listOptions(project);
  const shownOpts = guestOptions(project);
  const shownIds = new Set(shownOpts.options.map((o) => o.id));
  const defaultOpt = shownOpts.options[shownOpts.start] ?? shownOpts.options[0];
  const toggleOption = (id: string, checked: boolean) => {
    const nextIds = options
      .filter((o) => (o.id === id ? checked : shownIds.has(o.id)))
      .map((o) => o.id);
    if (nextIds.length === 0) return;
    const patch: Partial<GuestSettings> = {
      options: 'all',
      optionIds: nextIds.length === options.length ? null : nextIds,
    };
    if (!checked && g.defaultOptionId === id) patch.defaultOptionId = null;
    setGuest('Choose guest layout options', patch);
  };

  // Estimated size: build the HTML a moment after the settings settle (the model is cached for the download). That
  // builds the whole file (tens of MB), so never while a publish or download runs, and on a phone only when asked:
  // rebuilt on every change (a shared project changes whenever someone edits it) it ran the phone out of memory and
  // the browser reloaded the page in the middle of publishing.
  const isMobile = useIsMobile();
  const [size, setSize] = useState<number | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [asked, setAsked] = useState(false);
  const auto = !isMobile || asked;
  useEffect(() => {
    if (!auto || busy) {
      setMeasuring(false);
      return;
    }
    let live = true;
    setMeasuring(true);
    const t = window.setTimeout(() => {
      void import('./guestExport')
        .then(({ buildGuestHtml }) => buildGuestHtml(project))
        .then((html) => live && setSize(new Blob([html]).size))
        .catch(() => live && setSize(null))
        .finally(() => {
          if (!live) return;
          setMeasuring(false);
          // On a phone, once: later changes don't rebuild it.
          setAsked(false);
        });
    }, 700);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [project, auto, busy]);

  return (
    <div className="export-pane guest-export">
      <h3>Guest walkthrough</h3>
      <p className="field-hint">
        A 3D walkthrough guests open in any browser, with your layout options, notes and 2D plan. Share a live link,
        or send the single HTML file (it works offline). The in-app Guest view uses these settings too.
      </p>

      <Section title="Share">
          <GuestLiveLink project={project} busy={busy} run={run} />
        <div className="guest-file">
          <div className="export-summary" data-testid="guest-size">
            <strong>HTML</strong> ·{' '}
            {measuring && size === null ? (
              'estimating size…'
            ) : size !== null ? (
              `about ${mb(size)}${measuring ? ' (updating…)' : ''}`
            ) : isMobile ? (
              <button type="button" className="link-button" disabled={busy} onClick={() => setAsked(true)} data-testid="guest-size-estimate">
                estimate size
              </button>
            ) : (
              'size unknown'
            )}{' '}
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
      </Section>

      <Section title="Basics">
        <TextField
          label="Title"
          value={g.title}
          placeholder={project.name}
          maxLength={120}
          onCommit={(title) => setGuest('Set guest title', { title })}
        />
        {options.length > 1 && (
          <>
            <div className="field">
              <span className="field-label">Layout options</span>
              <div className="guest-view-list" role="group" aria-label="Layout options offered to guests">
                {options.map((o) => {
                  const on = shownIds.has(o.id);
                  const last = on && shownOpts.options.length <= 1;
                  return (
                    <div key={o.id} className="guest-view-row">
                      <label title={last ? 'At least one option must be shown' : undefined}>
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={last}
                          onChange={(e) => toggleOption(o.id, e.target.checked)}
                        />
                        {o.name}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
            {shownOpts.options.length > 1 && (
              <Select
                label="Default option"
                value={defaultOpt.id}
                onChange={(defaultOptionId) =>
                  setGuest('Set default guest option', { defaultOptionId })
                }
                options={shownOpts.options.map((o) => ({ value: o.id, label: o.name }))}
              />
            )}
            <p className="field-hint">
              {shownOpts.options.length > 1
                ? `Guests switch between ${shownOpts.options.map((o) => o.name).join(', ')}; opens on ${defaultOpt.name}.`
                : `Only ${defaultOpt.name} goes in the file.`}
            </p>
          </>
        )}
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
        {g.notes !== 'off' && (
          <div className="field">
            <span className="field-label">Note style</span>
            <Segmented<GuestSettings['noteDisplay']>
              label="Note style"
              size="sm"
              value={g.noteDisplay}
              onChange={(noteDisplay) => setGuest('Set guest note style', { noteDisplay })}
              options={[
                { value: 'icon', label: 'Icons' },
                { value: 'full', label: 'Full' },
              ]}
            />
          </div>
        )}
        {g.notes !== 'off' && (
          <Toggle
            label="Note pictures"
            hint="In the Notes list, where guests read every note in full"
            checked={g.noteImages}
            onChange={(noteImages) => setGuest('Toggle guest note pictures', { noteImages })}
          />
        )}
      </Section>

      <div className="guest-more-title">More settings</div>
      <Section title="Welcome" defaultOpen={false}>
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

      <Section title="Views" defaultOpen={false}>
        <Toggle
          label="2D plan"
          hint="Included in the View drop-down, with pan and zoom"
          checked={g.floorPlan}
          onChange={(floorPlan) => setGuest('Toggle guest floor plan', { floorPlan })}
        />
        <Select
          label="Opening view"
          value={g.startCameraId === '__top__' ? '__top__' : '__overview__'}
          onChange={(v) =>
            setGuest('Set guest start view', { startCameraId: v === '__top__' ? '__top__' : null })
          }
          options={[
            { value: '__overview__', label: 'Overview' },
            { value: '__top__', label: 'Top' },
          ]}
        />
      </Section>

      <Section title="What guests see" defaultOpen={false}>
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
            label="Walls"
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
        {g.wallDisplay === 'cutaway' && (
          <Toggle
            label="External walls only"
            hint="Cut exterior walls only; keep interior walls at full height"
            checked={g.cutawayExternalOnly}
            onChange={(cutawayExternalOnly) => setGuest('Toggle guest external walls only', { cutawayExternalOnly })}
          />
        )}
        {hiddenLayers > 0 && (
          <Toggle
            label={`Include hidden item layers (${hiddenLayers})`}
            hint="They start hidden; guests can show them"
            checked={g.hiddenItems}
            onChange={(hiddenItems) => setGuest('Toggle guest hidden layers', { hiddenItems })}
          />
        )}
        <p className="field-hint">
          Guests can switch walls, ceilings, note labels, room names, item layers and quality in the viewer's
          View panel. Ceiling lights and fans start hidden so the view from above stays clear; guests can show
          them there.
        </p>
      </Section>

      <Section title="Light & quality" defaultOpen={false}>
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

      <Section title="File" defaultOpen={false}>
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


    </div>
  );
}
