import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Cloud, Copy, Link2, LogOut, RefreshCw, Settings, Trash2, Users, WifiOff } from 'lucide-react';
import { Dialog } from '@/components/Overlays';
import { Button, IconButton } from '@/components/ui';
import { Logo } from '@/components/Logo';
import { navigate } from '@/app/App';
import { useProjectStore } from '@/state/projectStore';
import { useDialogStore, confirmAction, toast } from '@/state/uiStores';
import { derivePlan } from '@/domain/geometry/derive';
import { rectPolygon } from '@/domain/geometry/polygon';
import { viewedOption } from '@/domain/sync/doc';
import { listOptions } from '@/domain/commands/options';
import type { Project } from '@/domain/model/schema';
import type { Peer } from '@/domain/sync/protocol';
import { polyPath } from '@/features/plan-2d/PlanDrawing';
import { pointAt } from '@/domain/geometry/wallPath';
import { add, leftNormal, scale } from '@/domain/geometry/vec';
import type { Vec2 } from '@/domain/model/schema';
import { usePeerSelections } from './peerSelections';
import { saveProject } from '@/features/projects/projectService';
import { ProjectThumb, type ThumbSource } from '@/features/projects/ProjectThumb';
import { preferenceRepository } from '@/storage/indexeddb/db';
import { MIN_PASSWORD, changePassword, signIn, signOut, signOutOthers, useAuthStore } from './auth';
import {
  SYNC_URL,
  createRoom,
  fetchRoom,
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

export function Avatar({ name, color, title, dim, small }: { name: string; color: string; title?: string; dim?: boolean; small?: boolean }) {
  return (
    <span
      className={`live-avatar${dim ? ' dim' : ''}${small ? ' small' : ''}`}
      style={{ background: color }}
      title={title ?? name}
      aria-label={title ?? name}
    >
      {initials(name)}
    </span>
  );
}

/** A person in the room by name; the signed-in account on another device (same name and colour) says so. */
export function peerName(peer: Pick<Peer, 'name' | 'color'>, me: { name: string; color: string } | null): string {
  return me && peer.name === me.name && peer.color === me.color ? `${peer.name} (another device)` : peer.name;
}

/**
 * Which layout option someone is looking at: its id and name, whether it is the one shown here, or null when the
 * project has a single layout or they have not said yet.
 */
export function peerOption(project: Project, peer: Pick<Peer, 'p'>): { id: string; name: string; same: boolean } | null {
  const { options, activeId } = listOptions(project);
  const view = peer.p?.view;
  if (options.length < 2 || !view) return null;
  const o = options.find((x) => x.id === view);
  return o ? { id: o.id, name: o.name, same: o.id === activeId } : null;
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
        <input className="input" autoComplete="username" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
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
  const project = useProjectStore((s) => s.project);
  const me = useAuthStore((s) => s.user);
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
      {list.slice(0, 4).map((p) => {
        const where = project ? peerOption(project, p) : null;
        const who = peerName(p, me);
        return (
          <Avatar
            key={p.id}
            name={p.name}
            color={p.color}
            dim={where ? !where.same : false}
            title={where ? `${who} · on ${where.name}${where.same ? ' (same as you)' : ''}` : who}
          />
        );
      })}
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
      toast.success('Shared with the team', 'Your team finds it under Cloud projects on the start page, or opens the link.');
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
            Puts this project on the team's shared list. Everyone on the team can open it and edit it at the same time,
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
              {Object.values(peers).map((p) => {
                const where = peerOption(project, p);
                return (
                  <div className="live-person" key={p.id}>
                    <Avatar name={p.name} color={p.color} />
                    <span>{peerName(p, user)}</span>
                    <span className="live-state">{where ? `on ${where.name}${where.same ? ' (same as you)' : ''}` : ''}</span>
                  </div>
                );
              })}
            </div>
            {error && <p className="live-error">{error}</p>}
          </>
        )}
        <button className="live-link-button" onClick={() => useDialogStore.getState().open('account')}>
          Account settings (password, sign out)…
        </button>
      </div>
    </Dialog>
  );
}

/** The outline of a selected thing on the plan: a wall, a door or window, an item or a room (null for the rest). */
function selectionOutline(project: Project, derived: ReturnType<typeof derivePlan>, id: string): { pts: Vec2[]; room: boolean } | null {
  const wall = derived.network.walls.get(id);
  if (wall) return { pts: wall.footprint, room: false };
  const obj = project.objects[id];
  if (obj) return { pts: rectPolygon(obj.x, obj.y, obj.width, obj.depth, obj.rotation), room: false };
  if (project.openings[id]) {
    // Across the wall's thickness (a little past both faces), along the opening's span; three points follow a curve.
    for (const wg of derived.network.walls.values()) {
      const sp = wg.spans.find((x) => x.id === id);
      if (!sp) continue;
      const e = wg.h + 0.04;
      const at = [sp.s0, (sp.s0 + sp.s1) / 2, sp.s1].map((t) => pointAt(wg.path, t));
      const left = at.map(({ p, tangent }) => add(p, scale(leftNormal(tangent), e)));
      const right = at.map(({ p, tangent }) => add(p, scale(leftNormal(tangent), -e))).reverse();
      return { pts: [...left, ...right], room: false };
    }
    return null;
  }
  const face = derived.roomFaces.get(id);
  return face ? { pts: face.inner, room: true } : null;
}

/** A person's name on the plan, in their colour, its top-left corner at (x, y) in plan metres. */
function NameTag({ x, y, name, color, px }: { x: number; y: number; name: string; color: string; px: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${px})`}>
      <rect x={0} y={-11} width={name.length * 6.6 + 10} height={16} rx={4} fill={color} />
      <text x={5} y={1} fontSize={11} fill="#fff" fontFamily="system-ui, sans-serif">
        {name}
      </text>
    </g>
  );
}

/**
 * Other people's pointers and selections on the 2D plan (only those looking at the same option): what they selected
 * is outlined in their colour (walls, doors and windows, items, rooms), with their name at it when their pointer is
 * not on the plan (they are working in 3D, or away from the canvas).
 */
export function PeerLayer({ px }: { px: number }) {
  const peers = useLiveStore((s) => s.peers);
  const selections = usePeerSelections();
  const project = useProjectStore((s) => s.project);
  const derived = useMemo(() => (project ? derivePlan(project) : null), [project]);
  if (!project || !derived) return null;
  const view = viewedOption(project);
  const items: ReactNode[] = [];
  for (const sel of selections) {
    let tagAt: Vec2 | null = null;
    for (const id of sel.ids) {
      const o = selectionOutline(project, derived, id);
      if (!o || o.pts.length < 2) continue;
      items.push(
        <path
          key={`${sel.id}-${id}`}
          d={polyPath(o.pts)}
          fill={o.room ? sel.color : 'none'}
          fillOpacity={o.room ? 0.08 : undefined}
          stroke={sel.color}
          strokeWidth={2 * px}
          strokeDasharray={`${5 * px} ${3 * px}`}
        />,
      );
      if (!tagAt) tagAt = { x: Math.min(...o.pts.map((p) => p.x)), y: Math.min(...o.pts.map((p) => p.y)) - 6 * px };
    }
    if (tagAt && !peers[sel.id]?.p?.cursor) items.push(<NameTag key={`${sel.id}-tag`} x={tagAt.x} y={tagAt.y} name={sel.name} color={sel.color} px={px} />);
  }
  for (const peer of Object.values(peers)) {
    if (!peer.p || (peer.p.view && peer.p.view !== view)) continue;
    const c = peer.p.cursor;
    if (!c) continue;
    items.push(
      <g key={`${peer.id}-cursor`}>
        <g transform={`translate(${c.x} ${c.y}) scale(${px})`}>
          <path d="M0 0 L0 15 L4 11.5 L7 18 L9.5 17 L6.6 10.6 L11.5 10.6 Z" fill={peer.color} stroke="#fff" strokeWidth={1.2} />
        </g>
        <NameTag x={c.x + 12 * px} y={c.y + 20 * px} name={peer.name} color={peer.color} px={px} />
      </g>,
    );
  }
  return (
    <g className="peer-layer" pointerEvents="none">
      {items}
    </g>
  );
}

/** Account settings: change the password, sign out on other devices, sign out. */
export function AccountDialog({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [others, setOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;
  const mismatch = repeat.length > 0 && next !== repeat;
  const tooShort = next.length > 0 && next.length < MIN_PASSWORD;
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await changePassword(current, next, others);
      toast.success('Password changed', others ? 'Your other devices are signed out.' : undefined);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change the password.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title="Account" onClose={onClose} testId="account-dialog">
      <div className="live-dialog">
        <div className="live-person">
          <Avatar name={user.name} color={user.color} />
          <strong>{user.name}</strong>
        </div>
        <form
          className="live-signin compact"
          data-testid="password-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && current && next && next === repeat && !tooShort) void save();
          }}
        >
          <strong className="live-subhead">Change password</strong>
          <label className="field">
            <span className="field-label">Current password</span>
            <input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} data-autofocus />
          </label>
          <label className="field">
            <span className="field-label">New password</span>
            <input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">New password again</span>
            <input className="input" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
          </label>
          <label className="live-check">
            <input type="checkbox" checked={others} onChange={(e) => setOthers(e.target.checked)} /> Sign out on my other devices
          </label>
          {tooShort && <p className="live-error">At least {MIN_PASSWORD} characters.</p>}
          {mismatch && <p className="live-error">The two new passwords are not the same.</p>}
          {error && (
            <p className="live-error" role="alert">
              {error}
            </p>
          )}
          <Button variant="primary" type="submit" disabled={busy || !current || !next || next !== repeat || tooShort} data-testid="password-save">
            {busy ? 'Saving…' : 'Change password'}
          </Button>
        </form>
        <div className="live-account-actions">
          <Button
            variant="ghost"
            onClick={async () => {
              try {
                await signOutOthers();
                toast.success('Signed out on your other devices');
              } catch (e) {
                toast.error('Could not sign out the other devices', e instanceof Error ? e.message : undefined);
              }
            }}
          >
            Sign out on other devices
          </Button>
          <Button
            variant="ghost"
            data-testid="account-signout"
            onClick={async () => {
              await signOut();
              onClose();
            }}
          >
            <LogOut size={14} /> Sign out
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * Opens a shared project: brings the team's copy into this browser and opens it, view-only (others' changes still
 * arrive live; Edit in the top bar opens it for editing).
 */
async function openShared(room: LiveRoom, viewOnly = true): Promise<void> {
  const project = await joinFromLink(room);
  await saveProject(project);
  navigate(`/p/${project.id}${viewOnly ? '/view' : ''}`);
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
/** Plan previews of shared projects, kept in this browser so the list shows them at once (refreshed after). */
const THUMBS_PREF = 'sharedThumbs';

export function SharedProjects() {
  const user = useAuthStore((s) => s.user);
  const [rooms, setRooms] = useState<SharedRoom[] | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  /** A new list load renders the previews again from the team's current versions. */
  const [loadedAt, setLoadedAt] = useState(0);
  useEffect(() => {
    void preferenceRepository
      .get<Record<string, string>>(THUMBS_PREF)
      .then((t) => t && setThumbs(t))
      .catch(() => undefined);
  }, []);
  const thumbSource = (r: SharedRoom): ThumbSource => ({
    key: `room:${r.room}:${loadedAt}`,
    load: async () => (await fetchRoom(r)).project,
    persist: (svg) =>
      void preferenceRepository
        .get<Record<string, string>>(THUMBS_PREF)
        .then((t) => preferenceRepository.set(THUMBS_PREF, { ...(t ?? {}), [r.room]: svg }))
        .catch(() => undefined),
  });
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [account, setAccount] = useState(false);
  /** Loads the list; `previews` also renders the plan previews again (on opening and on Refresh, not when polling). */
  const refresh = useCallback(async (previews = true) => {
    if (!user) return;
    try {
      setRooms(await listRooms());
      if (previews) setLoadedAt(Date.now());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the shared projects.');
    }
  }, [user]);
  useEffect(() => {
    void refresh();
    // Who is working on what: the list is asked again every half minute while it is on screen.
    const poll = setInterval(() => document.visibilityState === 'visible' && void refresh(false), 30_000);
    return () => clearInterval(poll);
  }, [refresh]);
  if (!SYNC_URL) return null;
  const title = (
    <div className="cloud-title">
      <h2>
        <Cloud size={19} className="cloud-mark" aria-hidden /> Cloud projects
      </h2>
      <p>Shared with the team on its server: everyone signed in opens the same copy and sees changes live.</p>
    </div>
  );
  if (!user)
    return (
      <section className="live-shared" data-testid="shared-projects">
        {title}
        <p className="live-note">Sign in to see and edit the projects your team shares.</p>
        <SignInForm compact />
      </section>
    );
  const open = (r: SharedRoom) => {
    setOpening(r.room);
    openShared(r).catch((e) => {
      toast.error('Could not open the shared project', e instanceof Error ? e.message : undefined);
      setOpening(null);
    });
  };
  return (
    <section className="live-shared" data-testid="shared-projects">
      <div className="live-shared-head">
        {title}
        <span className="live-account">
          <Avatar name={user.name} color={user.color} />
          {user.name}
          <IconButton label="Refresh the list" onClick={() => void refresh()}>
            <RefreshCw size={15} />
          </IconButton>
          <IconButton label="Account settings" onClick={() => setAccount(true)} data-testid="account">
            <Settings size={15} />
          </IconButton>
          <IconButton label="Sign out" onClick={() => void signOut()} data-testid="signout">
            <LogOut size={15} />
          </IconButton>
        </span>
      </div>
      {account && <AccountDialog onClose={() => setAccount(false)} />}
      {error && <p className="live-error">{error}</p>}
      {rooms && !rooms.length && <p className="live-note">Nothing shared yet. Open a project and use the people button at the top to share it.</p>}
      <div className="project-grid cloud-grid">
        {rooms?.map((r) => {
          const here = r.here?.map((p) => peerName(p, user)).join(', ');
          return (
            <article key={r.room} className="project-card cloud" data-testid="cloud-card">
              <button type="button" className="card-open" disabled={!!opening} onClick={() => open(r)} aria-label={`Open ${r.name}`}>
                <div className="cloud-thumb">
                  <ProjectThumb stored={thumbs[r.room] ?? null} source={loadedAt ? thumbSource(r) : null} empty={<Cloud size={22} />} />
                  {!!r.here?.length && (
                    <span className="live-room-here" data-testid="room-here" aria-label={`Working on it now: ${here}`} title={`Working on it now: ${here}`}>
                      {r.here.slice(0, 3).map((p) => (
                        <Avatar key={p.name + p.color} name={p.name} color={p.color} small title={peerName(p, user)} />
                      ))}
                      {r.here.length > 3 && <span className="live-more">+{r.here.length - 3}</span>}
                    </span>
                  )}
                </div>
                <div className="card-meta">
                  <h3 title={r.name}>
                    <Cloud size={14} className="cloud-mark" aria-label="On the team server" />
                    {r.name}
                  </h3>
                  <p>Shared by {r.owner === user.id ? 'you' : (r.ownerName ?? r.owner)} · {new Date(r.createdAt).toLocaleDateString()}</p>
                  <p className="card-time">{opening === r.room ? 'Opening…' : here ? `Working on it now: ${here}` : 'On the team server'}</p>
                </div>
              </button>
              {r.owner === user.id && (
                <div className="card-tools">
                  <IconButton
                    label="Remove from the shared list"
                    tooltipSide="top"
                    className="danger-hover"
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
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
