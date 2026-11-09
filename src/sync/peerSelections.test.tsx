import { afterEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { buildDemoProject } from '@/features/projects/demoProject';
import { useProjectStore } from '@/state/projectStore';
import { viewedOption } from '@/domain/sync/doc';
import { useLiveStore } from './live';
import { useAuthStore } from './auth';
import { PeerLayer } from './LiveUI';

const project = () => {
  const p = buildDemoProject();
  useProjectStore.getState().load(p);
  return p;
};
const peer = (id: string, sel: string[], extra: { cursor?: { x: number; y: number } | null; view?: string } = {}) => ({
  id,
  name: 'Ngân',
  color: '#1c7ed6',
  p: { sel, cursor: extra.cursor ?? null, ...(extra.view ? { view: extra.view } : {}) },
});

describe("other people's selections on the plan", () => {
  afterEach(() => useLiveStore.setState({ status: 'off', peers: {} }));

  it('outlines a wall, an item, a door and a room in their colour, named at the selection when their pointer is elsewhere', () => {
    const p = project();
    useAuthStore.setState({ ready: true, user: { id: 'danh', name: 'Danh', color: '#e8590c' }, token: 't' });
    const sel = [Object.keys(p.walls)[0], Object.keys(p.objects)[0], Object.keys(p.openings)[0], Object.keys(p.rooms)[0]];
    useLiveStore.setState({ status: 'live', peers: { a: peer('a', sel, { view: viewedOption(p) }) } });
    const { container } = render(
      <svg>
        <PeerLayer px={0.01} />
      </svg>,
    );
    const outlines = container.querySelectorAll('.peer-layer path[stroke="#1c7ed6"]');
    expect(outlines.length).toBe(4);
    expect(container.querySelector('.peer-layer text')?.textContent).toBe('Ngân');
  });

  it('shows nothing for people on another layout option, and names the pointer instead of the selection when it is on the plan', () => {
    const p = project();
    const sel = [Object.keys(p.objects)[0]];
    useLiveStore.setState({ status: 'live', peers: { a: peer('a', sel, { view: 'another-option' }) } });
    const other = render(
      <svg>
        <PeerLayer px={0.01} />
      </svg>,
    );
    expect(other.container.querySelectorAll('.peer-layer path').length).toBe(0);
    other.unmount();
    useLiveStore.setState({ status: 'live', peers: { a: peer('a', sel, { cursor: { x: 1, y: 1 } }) } });
    const here = render(
      <svg>
        <PeerLayer px={0.01} />
      </svg>,
    );
    // One outline plus the pointer arrow, and one name (at the pointer).
    expect(here.container.querySelectorAll('.peer-layer text').length).toBe(1);
  });
});
