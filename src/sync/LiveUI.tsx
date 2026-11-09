import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Copy, Link2, Users, WifiOff } from 'lucide-react';
import { Dialog } from '@/components/Overlays';
import { Button, IconButton } from '@/components/ui';
import { navigate } from '@/app/App';
import { useProjectStore } from '@/state/projectStore';
import { useDialogStore, toast } from '@/state/uiStores';
import { derivePlan } from '@/domain/geometry/derive';
import { rectPolygon } from '@/domain/geometry/polygon';
import { viewedOption } from '@/domain/sync/doc';
import { polyPath } from '@/features/plan-2d/PlanDrawing';
import { saveProject } from '@/features/projects/projectService';
import {
  SYNC_URL,
  createRoom,
  joinFromLink,
  leaveRoom,
  liveIdentity,
  liveLink,
  renameLive,
  setLiveIdentity,
  startLive,
  useLiveStore,
  type LiveIdentity,
  type LiveRoom,
} from './live';
import './live.css';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

function Avatar({ name, color, title }: { name: string; color: string; title?: string }) {
  return (
    <span className="live-avatar" style={{ background: color }} title={title ?? name} aria-label={title ?? name}>
      {initials(name)}
    </span>
  );
}

/** Top-bar button: live status, the people here, and the Live dialog. Hidden when the build has no sync server. */
export function LiveButton() {
  const status = useLiveStore((s) => s.status);
  const peers = useLiveStore((s) => s.peers);
  if (!SYNC_URL) return null;
  const list = Object.values(peers);
  const label =
    status === 'live'
      ? `Live: ${list.length ? `${list.length + 1} people here` : 'only you here'}`
      : status === 'connecting'
        ? 'Live: connecting…'
        : status === 'offline'
          ? 'Live: offline, reconnecting (your changes are kept and sent when back)'
          : status === 'error'
            ? 'Live: could not connect'
            : 'Share for live editing';
  return (
    <div className="live-button">
      {list.slice(0, 4).map((p) => (
        <Avatar key={p.id} name={p.name} color={p.color} />
      ))}
      {list.length > 4 && <span className="live-more">+{list.length - 4}</span>}
      <IconButton label={label} className={`live-icon state-${status}`} onClick={() => useDialogStore.getState().open('live')} data-testid="live">
        {status === 'offline' || status === 'error' ? <WifiOff size={17} /> : <Users size={17} />}
      </IconButton>
    </div>
  );
}

/** The Live dialog: share the open project, copy its link, see who is here, stop. */
export function LiveDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const { status, room, peers, error, pending } = useLiveStore();
  const [identity, setIdentity] = useState<LiveIdentity | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void liveIdentity().then((id) => {
      setIdentity(id);
      setName(id?.name ?? '');
    });
  }, []);
  if (!project) return null;
  const link = room ? liveLink(room) : null;

  const share = async () => {
    setBusy(true);
    try {
      setIdentity(await setLiveIdentity(name));
      await createRoom(project);
      await startLive(project.id);
      toast.success('Live editing is on', 'Copy the link and send it to the people you want to edit with.');
    } catch (e) {
      toast.error('Could not start live editing', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };
  const rename = async () => {
    if (!name.trim() || name.trim() === identity?.name) return;
    const id = await setLiveIdentity(name);
    setIdentity(id);
    if (room) renameLive(id);
  };
  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success('Link copied', 'Anyone with this link can open and edit the project.');
  };
  const stop = async () => {
    await leaveRoom(project.id);
    toast.info('Live editing stopped here', 'The project stays in this browser. Others with the link can keep editing the shared copy.');
    onClose();
  };

  return (
    <Dialog
      title="Live editing"
      onClose={onClose}
      testId="live-dialog"
      footer={
        room ? (
          <>
            <Button variant="ghost" onClick={() => void stop()}>
              Stop live editing here
            </Button>
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" disabled={busy || !name.trim()} onClick={() => void share()} data-testid="live-start">
              {busy ? 'Starting…' : 'Start live editing'}
            </Button>
          </>
        )
      }
    >
      <div className="live-dialog">
        <label className="field">
          <span className="field-label">Your name (shown to the others)</span>
          <input
            className="input"
            value={name}
            maxLength={40}
            placeholder="e.g. Danh"
            data-autofocus
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void rename()}
            onKeyDown={(e) => e.key === 'Enter' && (room ? void rename() : name.trim() && void share())}
          />
        </label>
        {!room && (
          <p className="live-note">
            Puts a copy of this project on the sync server and gives you a link. Everyone with the link edits the same
            project at the same time and sees each other's pointers and selections. Undo only undoes your own changes.
          </p>
        )}
        {room && link && (
          <>
            <div className="live-link">
              <Link2 size={15} aria-hidden />
              <input className="input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Live link" />
              <Button size="sm" onClick={() => void copy()}>
                <Copy size={14} /> Copy
              </Button>
            </div>
            <p className="live-note">Anyone with this link can open and edit the project. Send it only to people you work with.</p>
            <div className="live-people">
              <div className="live-person">
                <Avatar name={identity?.name ?? name} color={identity?.color ?? '#888'} />
                <span>{identity?.name ?? name} (you)</span>
                <span className="live-state">
                  {status === 'live' ? (pending ? `sending ${pending}…` : 'connected') : status === 'offline' ? 'offline, reconnecting' : status}
                </span>
              </div>
              {Object.values(peers).map((p) => (
                <div className="live-person" key={p.id}>
                  <Avatar name={p.name} color={p.color} />
                  <span>{p.name}</span>
                  <span className="live-state">{p.p?.view && p.p.view !== viewedOption(project) ? 'on another option' : ''}</span>
                </div>
              ))}
            </div>
            {error && <p className="live-error">{error}</p>}
          </>
        )}
      </div>
    </Dialog>
  );
}

/** Other people's pointers and selections on the 2D plan (only those looking at the same option). */
export function PeerLayer({ px }: { px: number }) {
  const peers = useLiveStore((s) => s.peers);
  const project = useProjectStore((s) => s.project);
  const derived = useMemo(() => (project ? derivePlan(project) : null), [project]);
  if (!project || !derived) return null;
  const view = viewedOption(project);
  const items: ReactNode[] = [];
  for (const peer of Object.values(peers)) {
    if (!peer.p || (peer.p.view && peer.p.view !== view)) continue;
    for (const id of peer.p.sel ?? []) {
      const wall = derived.network.walls.get(id);
      const obj = project.objects[id];
      const d = wall ? polyPath(wall.footprint) : obj ? polyPath(rectPolygon(obj.x, obj.y, obj.width, obj.depth, obj.rotation)) : null;
      if (d) items.push(<path key={`${peer.id}-${id}`} d={d} fill="none" stroke={peer.color} strokeWidth={2 * px} strokeDasharray={`${5 * px} ${3 * px}`} />);
    }
    const c = peer.p.cursor;
    if (c) {
      const s = px;
      items.push(
        <g key={`${peer.id}-cursor`} transform={`translate(${c.x} ${c.y}) scale(${s})`}>
          <path d="M0 0 L0 15 L4 11.5 L7 18 L9.5 17 L6.6 10.6 L11.5 10.6 Z" fill={peer.color} stroke="#fff" strokeWidth={1.2} />
          <g transform="translate(12 20)">
            <rect x={0} y={-11} width={peer.name.length * 6.6 + 10} height={16} rx={4} fill={peer.color} />
            <text x={5} y={1} fontSize={11} fill="#fff" fontFamily="system-ui, sans-serif">
              {peer.name}
            </text>
          </g>
        </g>,
      );
    }
  }
  return (
    <g className="peer-layer" pointerEvents="none">
      {items}
    </g>
  );
}

/** Opening a live link (#/live/<room>/<key>): brings the shared project into this browser and opens it. */
export function LiveJoinPage({ room }: { room: LiveRoom }) {
  const [error, setError] = useState<string | null>(null);
  const [needsName, setNeedsName] = useState(false);
  const [name, setName] = useState('');
  const join = async () => {
    try {
      const project = await joinFromLink(room);
      await saveProject(project);
      navigate(`/p/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The live project could not be opened.');
    }
  };
  useEffect(() => {
    if (!SYNC_URL) {
      setError('This copy of Neest has no sync server, so it cannot open live links.');
      return;
    }
    void liveIdentity().then((id) => (id ? void join() : setNeedsName(true)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="app-loading">
      <div className="live-join">
        {error ? (
          <>
            <strong>Could not open the live project</strong>
            <span>{error}</span>
            <Button onClick={() => navigate('/')}>All projects</Button>
          </>
        ) : needsName ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              setNeedsName(false);
              void setLiveIdentity(name).then(() => join());
            }}
          >
            <strong>Join live editing</strong>
            <label className="field">
              <span className="field-label">Your name (shown to the others)</span>
              <input className="input" autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            </label>
            <Button variant="primary" type="submit" disabled={!name.trim()}>
              Join
            </Button>
          </form>
        ) : (
          <span>Opening the live project…</span>
        )}
      </div>
    </div>
  );
}
