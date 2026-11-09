import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/packs/loader';
import { PlacedObjectSchema } from '@/domain/model/schema';
import { createEmptyProject } from '@/domain/model/defaults';
import { getAsset } from '@/data/assets/registry';
import { ObjectModels, editsTieModel } from './ObjectModels';

const ID = 'portal-frames:arched-wall-portal';

function withPortal(edits?: Record<string, unknown>) {
  const p = createEmptyProject({ name: 'Model lock' });
  const o = PlacedObjectSchema.parse({ id: 'obj_portal', assetId: ID, x: 0, y: 0, rotation: 0, width: 3, depth: 0.12, height: 2.7, ...(edits ? { edits } : {}) });
  p.objects[o.id] = o;
  return p;
}

describe('model switch of an edited item', () => {
  it('shape settings do not tie an item to its model; part and section edits do', () => {
    expect(editsTieModel(undefined)).toBe(false);
    expect(editsTieModel({ params: { head: 0.7 } })).toBe(false);
    expect(editsTieModel({ parts: {} })).toBe(false);
    expect(editsTieModel({ parts: { '3': { sig: 'box', grow: [0.1, 0, 0] } } })).toBe(true);
    expect(editsTieModel({ sections: { x: { n: 2, d: [0.1] } } })).toBe(true);
  });

  it('a portal with changed settings can still change model; one with part edits says why it cannot', () => {
    const asset = getAsset(null, ID)!;
    const { unmount } = render(<ObjectModels project={withPortal({ params: { head: 0.7 } })} objectId="obj_portal" asset={asset} />);
    expect(screen.queryByTestId('model-locked')).toBeNull();
    unmount();
    render(<ObjectModels project={withPortal({ parts: { '0': { sig: 'box', grow: [0.1, 0, 0] } } })} objectId="obj_portal" asset={asset} />);
    expect(screen.getByTestId('model-locked')).toBeTruthy();
  });

  it('says when the item uses a model this version does not have', () => {
    const asset = getAsset(null, ID)!;
    const p = withPortal();
    p.objects.obj_portal.model = 'from-the-future';
    render(<ObjectModels project={p} objectId="obj_portal" asset={asset} />);
    expect(screen.getByTestId('model-unknown').textContent).toMatch(/newer version/);
  });
});
