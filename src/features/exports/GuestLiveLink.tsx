import { useEffect, useState } from 'react';
import { Copy, Download, ExternalLink, Globe, RefreshCw, Share2, Trash2 } from 'lucide-react';
import type { Project } from '@/domain/model/schema';
import { useProjectStore } from '@/state/projectStore';
import { confirmAction, toast } from '@/state/uiStores';
import { Button } from '@/components/ui';
import { useAuthStore } from '@/sync/auth';
import { canPublishLinks, guestSlug, publishGuestLink, unpublishGuestLink } from './guestShare';

/** The link as a QR code (SVG markup), for phones: scan to open. */
function useQr(url: string | null): string | null {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setSvg(null);
    if (!url) return;
    void import('qrcode').then((QR) =>
      QR.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1d1f22', light: '#ffffff' } }).then((s) => live && setSvg(s)),
    );
    return () => {
      live = false;
    };
  }, [url]);
  return svg;
}

/** Saves the QR code as a PNG (print it, put it in a message). */
async function downloadQr(url: string, name: string): Promise<void> {
  const QR = await import('qrcode');
  const data = await QR.toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: 'M' });
  const a = document.createElement('a');
  a.href = data;
  a.download = `${name}-qr.png`;
  a.click();
}

/**
 * Live link of the guest walkthrough: published on the team's server with the signed-in account; anyone with the
 * link can open it. The link stays the same; Update republishes the current project, Take down removes it. The
 * project keeps the link (`guest.share`); a link from before the move (GitHub Pages) moves on the next Update.
 */
export function GuestLiveLink({ project, busy, run }: { project: Project; busy: boolean; run: (fn: () => Promise<void>) => Promise<void> }) {
  const signedIn = useAuthStore((s) => !!s.user);
  /** What publishing is doing right now (building, compressing, uploading n %), shown on the button. */
  const [stage, setStage] = useState<string | null>(null);
  const share = project.guest.share;
  const qr = useQr(share?.url ?? null);

  if (!canPublishLinks() || !signedIn)
    return (
      <p className="field-hint" data-testid="live-link-off">
        {canPublishLinks()
          ? 'Sign in (Shared with the team, on the start page) to publish live links.'
          : 'Live links need the team server, which this copy of Neest is not set up for.'}
      </p>
    );

  const setShare = (next: Project['guest']['share']) =>
    useProjectStore.getState().execute(next ? 'Publish live link' : 'Take down live link', (d) => {
      d.guest.share = next;
    });
  const publish = () =>
    run(async () => {
      const slug = share?.slug ?? guestSlug(project);
      setStage('Building the walkthrough…');
      try {
        const { buildGuestHtml } = await import('./guestExport');
        const html = await buildGuestHtml(project);
        const url = await publishGuestLink(slug, html, setStage);
        setShare({ slug, url, at: Date.now() });
        toast.success(share?.url === url ? 'Updated: guests see it the next time they open the link.' : 'Published. The link works now.');
      } catch (e) {
        toast.error(`Could not publish: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setStage(null);
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
  /** The system share sheet where there is one (phones, Safari, Edge), else the link is copied. */
  const shareLink = async () => {
    if (!share) return;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: project.guest.title.trim() || project.name, text: 'A 3D walkthrough to look around in', url: share.url });
        return;
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return;
      }
    }
    copy();
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
          <div className="guest-live-share">
            <div className="guest-live-qr" data-testid="live-link-qr" aria-label="QR code of the link" role="img" dangerouslySetInnerHTML={qr ? { __html: qr } : undefined} />
            <div className="guest-live-side">
              <div className="guest-live-url">
                <Globe size={14} />
                <a href={share.url} target="_blank" rel="noopener noreferrer" data-testid="live-link-url">
                  {share.url.replace(/^https:\/\//, '')}
                </a>
              </div>
              <p className="field-hint">Scan with a phone camera to open it, or share the link.</p>
              <div className="btn-row">
                <Button size="sm" variant="primary" onClick={() => void shareLink()} data-testid="live-link-share">
                  <Share2 size={13} /> Share
                </Button>
                <Button size="sm" onClick={copy}>
                  <Copy size={13} /> Copy link
                </Button>
                <Button size="sm" onClick={() => void downloadQr(share.url, share.slug)} data-testid="live-link-qr-download">
                  <Download size={13} /> QR image
                </Button>
              </div>
            </div>
          </div>
          <p className="field-hint">
            {`Published ${new Date(share.at).toLocaleString()}.`}{' '}
            Guests see what was published; press Update after changes.
          </p>
          <div className="btn-row">
            <Button size="sm" variant="info" disabled={busy} onClick={() => void publish()} data-testid="live-link-update">
              <RefreshCw size={13} /> {stage ?? (busy ? 'Publishing…' : 'Update')}
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
            Publish the walkthrough on the team's server and send guests a link instead of a file. Anyone with the
            link can view it; it is kept out of search engines.
          </p>
          <Button variant="primary" disabled={busy} onClick={() => void publish()} data-testid="live-link-publish">
            <Globe size={14} /> {stage ?? (busy ? 'Publishing…' : 'Publish live link')}
          </Button>
        </>
      )}
    </div>
  );
}
