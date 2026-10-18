import { Layers } from 'lucide-react';
import { openContextMenu } from '@/components/ContextMenu';
import { getAsset } from '@/data/assets/registry';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { confirmAction, usePrefsStore, type SavedGroup } from '@/state/uiStores';
import { formatLength } from '@/domain/model/units';
import { placeSavedGroup } from '@/features/editor/groups';

/** Places a saved group in the middle of the current plan view. */
function placeInView(g: SavedGroup) {
  const cam = useEditorStore.getState().planCamera;
  placeSavedGroup(g, { x: cam.cx, y: cam.cy });
}

function rename(g: SavedGroup) {
  const name = window.prompt('Group name', g.name);
  if (name?.trim()) usePrefsStore.getState().renameSavedGroup(g.id, name);
}

async function remove(g: SavedGroup) {
  if (await confirmAction({ title: `Delete “${g.name}”?`, message: 'It is removed from the library. Items already placed stay.', confirmLabel: 'Delete', danger: true }))
    usePrefsStore.getState().deleteSavedGroup(g.id);
}

/** Top view of a saved group: each item's footprint rectangle, turned as placed. */
function GroupPlan({ g }: { g: SavedGroup }) {
  const m = Math.max(g.size.w, g.size.d) * 0.58 + 0.05;
  return (
    <svg viewBox={`${-m} ${-m} ${m * 2} ${m * 2}`} className="asset-plan-thumb" aria-hidden>
      {g.items.map((it, i) => (
        <rect
          key={i}
          x={-it.width / 2}
          y={-it.depth / 2}
          width={it.width}
          height={it.depth}
          rx={Math.min(it.width, it.depth) * 0.08}
          transform={`translate(${it.dx} ${it.dy}) rotate(${(it.rotation * 180) / Math.PI})`}
          strokeWidth={m * 0.02}
        />
      ))}
    </svg>
  );
}

function SavedGroupCard({ g }: { g: SavedGroup }) {
  const project = useProjectStore((s) => s.project!);
  const units = project.settings.units;
  const missing = g.items.filter((it) => !getAsset(project, it.assetId)).length;
  const menu = (x: number, y: number) =>
    openContextMenu(x, y, [
      { label: 'Place in view', run: () => placeInView(g) },
      { label: 'Rename…', run: () => rename(g) },
      { separator: true, label: '' },
      { label: 'Delete from library', danger: true, run: () => void remove(g) },
    ]);
  return (
    <div className="asset-card" onContextMenu={(e) => (e.preventDefault(), menu(e.clientX, e.clientY))}>
      <button
        type="button"
        className="asset-main"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-neest-asset', `savedgroup:${g.id}`);
          e.dataTransfer.effectAllowed = 'copy';
        }}
        onClick={() => placeInView(g)}
        title={`${g.name}: ${g.items.length} items${missing ? ` (${missing} from packs that are not installed)` : ''}. Click to place in view, or drag onto the plan.`}
        data-testid={`saved-group-${g.id}`}
      >
        <span className="asset-thumb">
          <GroupPlan g={g} />
        </span>
        <span className="asset-name">{g.name}</span>
        <span className="asset-dims num">
          {g.items.length} items · {formatLength(g.size.w, units, 0, { suffix: false })} × {formatLength(g.size.d, units, 0)}
        </span>
      </button>
    </div>
  );
}

/** The Furniture tab's "Saved groups" shelf. */
export function SavedGroupsShelf({ query }: { query: string }) {
  const groups = usePrefsStore((s) => s.savedGroups);
  const q = query.trim().toLowerCase();
  const list = q ? groups.filter((g) => g.name.toLowerCase().includes(q)) : groups;
  return (
    <section className="asset-shelf" aria-label="Saved groups">
      {list.length > 0 ? (
        <div className="asset-grid">
          {list.map((g) => (
            <SavedGroupCard key={g.id} g={g} />
          ))}
        </div>
      ) : (
        <p className="field-hint pad">
          <Layers size={13} aria-hidden /> {groups.length ? 'No saved groups match your search.' : 'Select placed items, right-click and choose “Save to library as a group”. Saved groups appear here in every project.'}
        </p>
      )}
    </section>
  );
}
