import { useMemo } from 'react';
import { viewedOption } from '@/domain/sync/doc';
import { useProjectStore } from '@/state/projectStore';
import { useAuthStore } from './auth';
import { useLiveStore } from './live';

export interface PeerSelection {
  /** Connection id. */
  id: string;
  /** As shown: the account's name, "(another device)" for the same account elsewhere. */
  name: string;
  color: string;
  /** What they have selected (walls, doors and windows, items, rooms…). */
  ids: string[];
}

/** What the other people in the room have selected, those looking at the same layout option as you. */
export function usePeerSelections(): PeerSelection[] {
  const peers = useLiveStore((s) => s.peers);
  const view = useProjectStore((s) => (s.project ? viewedOption(s.project) : null));
  const me = useAuthStore((s) => s.user);
  return useMemo(() => {
    const out: PeerSelection[] = [];
    for (const p of Object.values(peers)) {
      const sel = p.p?.sel ?? [];
      if (!sel.length || (p.p?.view && view && p.p.view !== view)) continue;
      const other = me && p.name === me.name && p.color === me.color;
      out.push({ id: p.id, name: other ? `${p.name} (another device)` : p.name, color: p.color, ids: sel });
    }
    return out;
  }, [peers, view, me]);
}
