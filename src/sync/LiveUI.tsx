import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Copy, Link2, LogOut, RefreshCw, Trash2, Users, WifiOff } from 'lucide-react';
import { Dialog } from '@/components/Overlays';
import { Button, IconButton } from '@/components/ui';
import { Logo } from '@/components/Logo';
import { navigate } from '@/app/App';
import { useProjectStore } from '@/state/projectStore';
import { useDialogStore, confirmAction, toast } from '@/state/uiStores';
import { derivePlan } from '@/domain/geometry/derive';
import { rectPolygon } from '@/domain/geometry/polygon';
import { viewedOption } from '@/domain/sync/doc';
import { polyPath } from '@/features/plan-2d/PlanDrawing';
import { saveProject } from '@/features/projects/projectService';
import { signIn, signOut, useAuthStore } from './auth';
import {
  SYNC_URL,
  createRoom,
  joinFromLink,
  leaveRoom,
  listRooms,
  liveLink,
  removeRoom,
  startLive,
  useLiveStore,
  type LiveRoom,
  type SharedRoom,
} from './live';
import './live.css';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

export function Avatar({ name, color, title }: { name: string; color: string; title?: string }) {
  return (
    <span className="live-avatar" style={{ background: color }} title={title ?? name} aria-label={title ?? name}>
      {initials(name)}
    </span>
  );
}

/** Name + password, for the team's accounts. */
export function SignInForm({ onDone, compact }: { onDone?: () => void; compact?: boolean }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className={`live-signin${compact ? ' compact' : ''}`}
      data-testid="signin-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || !password) return;
        setBusy(true);
        setError(null);
        try {
          await signIn(name, password);
          onDone?.();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not sign in.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="field">
        <span className="field-label">Name</span>
        <input className="input" autoComplete="username" autoFocus value={name} placeholder="danh, ngan or linh" onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Password</span>
        <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      <Button variant="primary" type="submit" disabled={busy || !name.trim() || !password} data-testid="signin-submit">
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}

/**
 * The deployed site (a production build with a sync server) asks for an account before anything else; local
 * and development builds open straight away.
 */
export function SignInGate({ children }: { children: ReactNode }) {
  const { ready, user } = useAuthStore();
  if (!import.meta.env.PROD || !SYNC_URL || user) return <>{children}</>;
  if (!ready) return <div className="app-loading">Loading Neest…</div>;
  return (
    <div className="app-loading">
      <div className="live-gate">
        <Logo size={44} />
        <strong>Sign in to Neest</strong>
        <SignInForm />
      </div>
    </div>
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
          : status === 'signin'
            ? 'Live: sign in to edit with the team'
            : status === 'error'
              ? 'Live: could not connect'
              : 'Share with the team for live editing';
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

/** The Live dialog: sign in, share the open project, copy its link, see who is here, stop. */
export function LiveDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const user = useAuthStore((s) => s.user);
  const { status, room, peers, error, pending } = useLiveStore();
  const [busy, setBusy] = useState(false);
  if (!project) return null;
  const link = room ? liveLink(room) : null;

  const share = async () => {
    setBusy(true);
    try {
      await createRoom(project);
      await startLive(project.id);
      toast.success('Shared with the team', 'Danh, Ngân and Linh find it under Shared projects, or open the link.');
    } catch (e) {
      toast.error('Could not share the project', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success('Link copied', 'Team members open it after signing in.');
  };
  const stop = async () => {
    await leaveRoom(project.id);
    toast.info('Live editing stopped here', 'The project stays in this browser. The shared copy stays on the team list.');
    onClose();
  };

  if (!user)
    return (
      <Dialog title="Live editing" onClose={onClose} testId="live-dialog">
        <div className="live-dialog">
          <p className="live-note">
            {status === 'signin' ? 'This project is shared with the team. Sign in to edit it together.' : 'Sign in with your team account to share projects and edit them together.'}
          </p>
          <SignInForm compact onDone={() => void (status === 'signin' ? startLive(project.id) : undefined)} />
        </div>
      </Dialog>
    );

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
            <Button variant="primary" disabled={busy} onClick={() => void share()} data-testid="live-start">
              {busy ? 'Sharing…' : 'Share with the team'}
            </Button>
          </>
        )
      }
    >
      <div className="live-dialog">
        {!room && (
          <p className="live-note">
            Puts this project on the team's shared list. Danh, Ngân and Linh can open it and edit it at the same time,
            seeing each other's pointers and selections. Undo only undoes your own changes.
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
            <p className="live-note">The team finds it under Shared projects; the link opens it directly (after signing in).</p>
            <div className="live-people">
              <div className="live-person">
                <Avatar name={user.name} color={user.color} />
                <span>{user.name} (you)</span>
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

/** Opens a shared project: brings the team's copy into this browser and opens it. */
async function openShared(room: LiveRoom): Promise<void> {
  const project = await joinFromLink(room);
  await saveProject(project);
  navigate(`/p/${project.id}`);
}

/** Opening a live link (#/live/<room>/<key>): sign in if needed, then open the shared project. */
export function LiveJoinPage({ room }: { room: LiveRoom }) {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const [error, setError] = useState<string | null>(SYNC_URL ? null : 'This copy of Neest has no sync server, so it cannot open live links.');
  useEffect(() => {
    if (!SYNC_URL || !ready || !user) return;
    openShared(room).catch((e) => setError(e instanceof Error ? e.message : 'The shared project could not be opened.'));
  }, [room, ready, user]);
  return (
    <div className="app-loading">
      <div className="live-join">
        {error ? (
          <>
            <strong>Could not open the shared project</strong>
            <span>{error}</span>
            <Button onClick={() => navigate('/')}>All projects</Button>
          </>
        ) : ready && !user ? (
          <>
            <strong>Sign in to open the shared project</strong>
            <SignInForm />
          </>
        ) : (
          <span>Opening the shared project…</span>
        )}
      </div>
    </div>
  );
}

/** Launcher: who is signed in, and the projects shared with the team. */
export function SharedProjects() {
  const user = useAuthStore((s) => s.user);
  const [rooms, setRooms] = useState<SharedRoom[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setRooms(await listRooms());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the shared projects.');
    }
  }, [user]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  if (!SYNC_URL) return null;
  if (!user)
    return (
      <section className="live-shared" data-testid="shared-projects">
        <h2>Shared with the team</h2>
        <p className="live-note">Sign in to see and edit the projects Danh, Ngân and Linh share.</p>
        <SignInForm compact />
      </section>
    );
  return (
    <section className="live-shared" data-testid="shared-projects">
      <div className="live-shared-head">
        <h2>Shared with the team</h2>
        <span className="live-account">
          <Avatar name={user.name} color={user.color} />
          {user.name}
          <IconButton label="Refresh the list" onClick={() => void refresh()}>
            <RefreshCw size={15} />
          </IconButton>
          <IconButton label="Sign out" onClick={() => void signOut()} data-testid="signout">
            <LogOut size={15} />
          </IconButton>
        </span>
      </div>
      {error && <p className="live-error">{error}</p>}
      {rooms && !rooms.length && <p className="live-note">Nothing shared yet. Open a project and use the people button at the top to share it.</p>}
      <ul className="live-room-list">
        {rooms?.map((r) => (
          <li key={r.room}>
            <button
              className="live-room"
              disabled={!!opening}
              onClick={() => {
                setOpening(r.room);
                openShared(r).catch((e) => {
                  toast.error('Could not open the shared project', e instanceof Error ? e.message : undefined);
                  setOpening(null);
                });
              }}
            >
              <strong>{r.name}</strong>
              <span>
                Shared by {r.owner === user.id ? 'you' : (r.ownerName ?? r.owner)} · {new Date(r.createdAt).toLocaleDateString()}
                {opening === r.room ? ' · opening…' : ''}
              </span>
            </button>
            {r.owner === user.id && (
              <IconButton
                label="Remove from the shared list"
                onClick={async () => {
                  const ok = await confirmAction({
                    title: `Stop sharing “${r.name}”?`,
                    message: 'It leaves the team list. Copies already in people’s browsers stay there.',
                    confirmLabel: 'Remove',
                    danger: true,
                  });
                  if (!ok) return;
                  try {
                    await removeRoom(r.room);
                    await refresh();
                  } catch (e) {
                    toast.error('Could not remove it', e instanceof Error ? e.message : undefined);
                  }
                }}
              >
                <Trash2 size={15} />
              </IconButton>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
