import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { produce } from 'immer';
import { buildDemoProject } from '@/features/projects/demoProject';
import { useProjectStore } from '@/state/projectStore';

vi.mock('./guestShare', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./guestShare')>();
  return {
    ...actual,
    shareStatus: vi.fn(async () => ({ repo: 'user/neest-share', baseUrl: 'https://user.github.io/neest-share' })),
  };
});

import { GuestLiveLink } from './GuestLiveLink';
import { ExportPanel } from './ExportDialog';

describe('GuestLiveLink', () => {
  it('lists Guest walkthrough — HTML first and selects it by default when Export opens', () => {
    useProjectStore.getState().load(buildDemoProject());
    render(<ExportPanel onClose={() => {}} />);

    const nav = screen.getByRole('navigation', { name: 'Export format' });
    const buttons = within(nav).getAllByRole('button');
    expect(buttons[0].getAttribute('data-testid')).toBe('export-guest');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('renders the Update button with the blue info variant distinct from the green primary button', async () => {
    const project = produce(buildDemoProject(), (d) => {
      d.guest.share = {
        slug: 'demo-house',
        url: 'https://user.github.io/neest-share/demo-house/',
        at: 1_700_000_000_000,
      };
    });

    render(<GuestLiveLink project={project} busy={false} run={async (fn) => fn()} />);

    const updateBtn = await screen.findByTestId('live-link-update');
    const shareBtn = screen.getByTestId('live-link-share');

    expect(updateBtn.className).toContain('btn-info');
    expect(updateBtn.className).not.toContain('btn-primary');
    expect(shareBtn.className).toContain('btn-primary');
  });
});
