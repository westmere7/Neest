import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@/packs/loader';
import { createEmptyProject } from '@/domain/model/defaults';
import { addRectangleWalls } from '@/domain/commands/walls';
import { assignMaterial, placeObject } from '@/domain/commands/entities';
import { ASSETS_BY_ID } from '@/data/assets/catalog';
import { useProjectStore } from '@/state/projectStore';
import { usePrefsStore } from '@/state/uiStores';
import { FinishPicker, matchesMaterialQuery, projectUsedMaterialIds } from './MaterialUI';
import { MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';

function loadRoomProject() {
  useProjectStore.getState().load(createEmptyProject());
  useProjectStore.getState().execute('Add room', (d) => {
    addRectangleWalls(d, { x: 0, y: 0 }, { x: 4, y: 3 }, { thickness: 0.12, height: 2.7, role: 'interior' });
  });
  return useProjectStore.getState().project!;
}

describe('FinishPicker surface finish choices', () => {
  beforeEach(() => {
    usePrefsStore.setState({ favouriteMaterials: [], recentMaterials: [] });
  });

  it('includes placed-item default finishes like mint-stack-tile under "In this project & favourites"', () => {
    loadRoomProject();
    const kitchen = ASSETS_BY_ID['sage-shaker-kitchen:l-kitchen'];
    let objId = '';
    useProjectStore.getState().execute('Place L kitchen', (d) => {
      objId = placeObject(d, {
        assetId: kitchen.id,
        x: 0,
        y: 0,
        width: kitchen.defaultSize.w,
        depth: kitchen.defaultSize.d,
        height: kitchen.defaultSize.h,
      });
      // Simulate overriding Splashback tiles to Green zellige, then wanting to pick the pale mint tile again.
      assignMaterial(d, [{ kind: 'object-slot', objectId: objId, slot: 'tile' }], 'tile-zellige-green');
    });

    const updated = useProjectStore.getState().project!;
    const used = projectUsedMaterialIds(updated);
    expect(used.has('sage-shaker-kitchen:mint-stack-tile')).toBe(true);
    expect(used.has('sage-shaker-kitchen:sage-lacquer')).toBe(true);
    expect(used.has('sage-shaker-kitchen:cream-lacquer')).toBe(true);
    expect(used.has('sage-shaker-kitchen:terrazzo-white')).toBe(true);

    // 1. Editing the kitchen splashback slot shows Pale mint green tile in "In this project & favourites".
    const { unmount } = render(
      <FinishPicker
        target={{ kind: 'object-slot', objectId: objId, slot: 'tile' }}
        currentId="tile-zellige-green"
        variant="panel"
        onClose={() => {}}
      />,
    );
    const grid = screen.getByRole('listbox', { name: 'Finishes' });
    expect(within(grid).getByText(/Pale mint green tile/)).toBeInTheDocument();
    unmount();

    // 2. Editing a room wall surface also shows Pale mint green tile in "In this project & favourites" and applies it.
    const wallId = Object.keys(updated.walls)[0];
    render(
      <FinishPicker
        target={{ kind: 'wall-side', wallId, side: 'left' }}
        currentId={updated.walls[wallId].materials.left}
        variant="panel"
        onClose={() => {}}
      />,
    );
    const wallGrid = screen.getByRole('listbox', { name: 'Finishes' });
    const mintOption = within(wallGrid).getByRole('option', { name: /Pale mint green tile/ });
    fireEvent.click(mintOption);
    expect(useProjectStore.getState().project!.walls[wallId].materials.left).toBe('sage-shaker-kitchen:mint-stack-tile');
  });

  it('finds pale mint green kitchen tile from search even when "In this project & favourites" is active', () => {
    const project = loadRoomProject();
    const wallId = Object.keys(project.walls)[0];
    const mint = MATERIAL_CATALOG_BY_ID['sage-shaker-kitchen:mint-stack-tile'];
    expect(mint).toBeDefined();
    expect(matchesMaterialQuery(mint, 'gạch xanh nhạt')).toBe(true);
    expect(matchesMaterialQuery(mint, 'gach the xanh')).toBe(true);
    expect(matchesMaterialQuery(mint, 'mint green tile')).toBe(true);
    expect(matchesMaterialQuery(mint, 'stack')).toBe(true);

    render(
      <FinishPicker
        target={{ kind: 'wall-side', wallId, side: 'left' }}
        currentId={project.walls[wallId].materials.left}
        variant="panel"
        onClose={() => {}}
      />,
    );

    const search = screen.getByLabelText('Search finishes');
    fireEvent.change(search, { target: { value: 'gach xanh' } });
    const grid = screen.getByRole('listbox', { name: 'Finishes' });
    expect(within(grid).getByRole('option', { name: /Pale mint green tile/ })).toBeInTheDocument();
  });
});
