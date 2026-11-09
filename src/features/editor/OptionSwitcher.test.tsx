import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { migrateProject } from '@/storage/migrations';
import { listOptions } from '@/domain/commands/options';
import { buildDemoProject } from '@/features/projects/demoProject';
import { useProjectStore } from '@/state/projectStore';
import { useLiveStore } from '@/sync/live';
import { useAuthStore } from '@/sync/auth';
import { peerName, peerOption } from '@/sync/LiveUI';
import { OptionSwitcher } from './OptionSwitcher';

const sixty = () => migrateProject(JSON.parse(readFileSync(resolve(__dirname, '../../domain/sync/fixtures/60ltn.json'), 'utf8'))).project;
const me = { id: 'danh', name: 'Danh', color: '#e8590c' };
const peer = (id: string, name: string, color: string, view?: string) => ({ id, name, color, p: view ? { view } : null });

describe('who is on which layout option', () => {
  it('names the option someone looks at, and whether it is the one shown here', () => {
    const p = sixty();
    const { options, activeId } = listOptions(p);
    const other = options.find((o) => o.id !== activeId)!;
    expect(peerOption(p, peer('a', 'Ngân', '#1c7ed6', other.id))).toEqual({ id: other.id, name: other.name, same: false });
    expect(peerOption(p, peer('a', 'Ngân', '#1c7ed6', activeId))?.same).toBe(true);
    expect(peerOption(p, peer('a', 'Ngân', '#1c7ed6'))).toBeNull(); // not said yet
    expect(peerOption(buildDemoProject(), peer('a', 'Ngân', '#1c7ed6', 'default'))).toBeNull(); // a single layout
  });

  it('marks the same account on another device', () => {
    expect(peerName(peer('x', 'Danh', '#e8590c'), me)).toBe('Danh (another device)');
    expect(peerName(peer('y', 'Ngân', '#1c7ed6'), me)).toBe('Ngân');
  });

  it('shows people next to the option they are on, and on the button for the shown one', () => {
    const p = sixty();
    const { options, activeId } = listOptions(p);
    const other = options.find((o) => o.id !== activeId)!;
    useProjectStore.getState().load(p);
    useAuthStore.setState({ ready: true, user: me, token: 't' });
    useLiveStore.setState({
      status: 'live',
      peers: {
        a: peer('a', 'Ngân', '#1c7ed6', other.id),
        b: peer('b', 'Linh', '#2f9e44', activeId),
        c: peer('c', 'Danh', '#e8590c', other.id),
      },
    });
    render(<OptionSwitcher />);
    const button = screen.getByTestId('option-switch');
    expect(within(button).getByTestId('option-people').getAttribute('aria-label')).toBe('Here: Linh');

    fireEvent.click(button);
    const rows = within(screen.getByTestId('option-menu')).getAllByRole('listitem');
    const label = (name: string) =>
      within(rows.find((r) => r.textContent?.includes(name))!).queryByTestId('option-people')?.getAttribute('aria-label') ?? null;
    expect(label(other.name)).toBe('Here: Ngân, Danh (another device)');
    expect(label(options.find((o) => o.id === activeId)!.name)).toBe('Here: Linh');
    useLiveStore.setState({ status: 'off', peers: {} });
  });
});
