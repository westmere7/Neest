import { useEffect, useState } from 'react';
import { Copy, ExternalLink, Globe, RefreshCw, Trash2 } from 'lucide-react';
import type { Project } from '@/domain/model/schema';
import { useProjectStore } from '@/state/projectStore';
import { confirmAction, toast } from '@/state/uiStores';
import { Button } from '@/components/ui';
import { guestSlug, isLinkLive, publishGuestLink, shareStatus, unpublishGuestLink, type ShareTarget } from './guestShare';

/**
 * Live link of the guest walkthrough: published to GitHub Pages by the local server with this machine's
 * git sign-in (no account set-up in Neest). The link stays the same; Update republishes the current
 * project, Take down removes it. The project keeps the link (`guest.share`).
 */
export function GuestLiveLink({ project, busy, run }: { project: Project; busy: boolean; run: (fn: () => Promise<void>) => Promise<void> }) {
  const [target, setTarget] = useState<ShareTarget | null | undefined>(undefined);
  const [waiting, setWaiting] = useState<string | null>(null);
  const share = project.guest.share;
  useEffect(() => {
    let live = true;
    void shareStatus().then((t) => live && setTarget(t));
    return () => {
      live = false;
    };
  }, []);
  // After a first publish: GitHub Pages builds the site (about a minute); check until it answers.
  useEffect(() => {
    if (!waiting) return;
    let stop = false;
    const started = Date.now();
    const tick = async () => {
      if (stop) return;
      if (await isLinkLive(waiting)) {
        if (!stop) {
          setWaiting(null);
          toast.success('The live link is up.');
        }
        return;
      }
      if (Date.now() - started > 5 * 60 * 1000) return setWaiting(null);
      setTimeout(() => void tick(), 5000);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [waiting]);

  if (target === undefined) return null;
  if (!target)
    return (
      <p className="field-hint" data-testid="live-link-off">
        Live links need Neest running from its folder (<code>npm run dev</code> or start-neest.bat): it publishes with this
        computer's GitHub sign-in.
      </p>
    );

  const setShare = (next: Project['guest']['share']) =>
    useProjectStore.getState().execute(next ? 'Publish live link' : 'Take down live link', (d) => {
      d.guest.share = next;
    });
  const publish = () =>
    run(async () => {
      const slug = share?.slug ?? guestSlug(project);
      const { buildGuestHtml } = await import('./guestExport');
      const html = await buildGuestHtml(project);
      try {
        const url = await publishGuestLink(slug, html);
        setShare({ slug, url, at: Date.now() });
        if (share) toast.success('Updated. GitHub Pages refreshes the link within a minute.');
        else {
          toast.success('Published. The link goes live in about a minute.');
          setWaiting(slug);
        }
      } catch (e) {
        toast.error(`Could not publish: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
  const takeDown = async () => {
    if (!share) return;
    const ok = await confirmAction({
      title: 'Take down the live link?',
      message: 'Guests with the link will no longer see the walkthrough. You can publish again later (same link).',
      confirmLabel: 'Take down',
      danger: true,
    });
    if (!ok) return;
    await run(async () => {
      try {
        await unpublishGuestLink(share.slug);
        setShare(null);
        toast.success('Live link taken down.');
      } catch (e) {
        toast.error(`Could not take it down: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
  };
  const copy = () => {
    if (!share) return;
    void navigator.clipboard?.writeText(share.url).then(
      () => toast.success('Link copied.'),
      () => toast.error('Could not copy; select the link instead.'),
    );
  };

  return (
    <div className="guest-live" data-testid="live-link">
      {share ? (
        <>
          <div className="guest-live-url">
            <Globe size={14} />
            <a href={share.url} target="_blank" rel="noopener noreferrer" data-testid="live-link-url">
              {share.url.replace(/^https:\/\//, '')}
            </a>
          </div>
          <p className="field-hint">
            {waiting ? 'Going live… GitHub Pages is building it (about a minute).' : `Published ${new Date(share.at).toLocaleString()}.`}{' '}
            Guests see what was published; press Update after changes.
          </p>
          <div className="btn-row">
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void publish()} data-testid="live-link-update">
              <RefreshCw size={13} /> {busy ? 'Publishing…' : 'Update'}
            </Button>
            <Button size="sm" onClick={copy}>
              <Copy size={13} /> Copy link
            </Button>
            <Button size="sm" onClick={() => window.open(share.url, '_blank', 'noopener')}>
              <ExternalLink size={13} /> Open
            </Button>
            <Button size="sm" variant="subtle" disabled={busy} onClick={() => void takeDown()} data-testid="live-link-remove">
              <Trash2 size={13} /> Take down
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="field-hint">
            Publish the walkthrough to GitHub Pages ({target.repo}) and send guests a link instead of a file. Anyone with
            the link can view it; it is kept out of search engines.
          </p>
          <Button variant="primary" disabled={busy} onClick={() => void publish()} data-testid="live-link-publish">
            <Globe size={14} /> {busy ? 'Publishing…' : 'Publish live link'}
          </Button>
        </>
      )}
    </div>
  );
}
