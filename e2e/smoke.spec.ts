import { expect, test, type Page } from '@playwright/test';

/** Snapshot of the dev-only debug stores (window.__NEEST__). */
interface Snapshot {
  walls: number;
  rooms: string[];
  objects: number;
  camera: { cx: number; cy: number; zoom: number };
  workspace: string;
  /** Centre of all wall nodes (plan metres). */
  centre: { x: number; y: number } | null;
}

async function snapshot(page: Page): Promise<Snapshot | null> {
  return page.evaluate(() => {
    type Store<T> = { getState(): T };
    const dev = (
      window as unknown as {
        __NEEST__?: {
          project: Store<{
            project: { walls: object; nodes: Record<string, { x: number; y: number }>; rooms: Record<string, { name: string }>; objects: object } | null;
          }>;
          editor: Store<{ planCamera: { cx: number; cy: number; zoom: number }; workspace: string }>;
        };
      }
    ).__NEEST__;
    const p = dev?.project.getState().project;
    if (!dev || !p) return null;
    const ed = dev.editor.getState();
    const nodes = Object.values(p.nodes);
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    return {
      walls: Object.keys(p.walls).length,
      rooms: Object.values(p.rooms).map((r) => r.name),
      objects: Object.keys(p.objects).length,
      camera: ed.planCamera,
      workspace: ed.workspace,
      centre: nodes.length ? { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 } : null,
    };
  });
}

test('creates a project, draws a room, undoes and redoes it, and keeps it after a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('new-project').click();
  await page.getByTestId('project-name').fill('E2E flat');
  await page.getByTestId('create-project').click();
  await expect(page).toHaveURL(/#\/p\//);
  const canvas = page.getByTestId('plan-canvas');
  await expect(canvas).toBeVisible();

  // Room tool: click one corner, type an exact size.
  await page.keyboard.press('r');
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.45);
  await page.keyboard.type('4x3');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot(page))?.walls).toBe(4);
  await expect.poll(async () => (await snapshot(page))?.rooms.length).toBe(1);

  await page.getByTestId('undo').click();
  await expect.poll(async () => (await snapshot(page))?.walls).toBe(0);
  await page.getByTestId('redo').click();
  await expect.poll(async () => (await snapshot(page))?.walls).toBe(4);

  // Select the room and read its clear area in the inspector.
  await page.keyboard.press('Escape');
  await page.keyboard.press('v');
  const s = (await snapshot(page))!;
  await page.mouse.click(
    box.x + box.width / 2 + (s.centre!.x - s.camera.cx) * s.camera.zoom,
    box.y + box.height / 2 + (s.centre!.y - s.camera.cy) * s.camera.zoom,
  );
  await expect(page.getByTestId('room-area')).toContainText('m²');

  await expect(page.getByTestId('save-indicator')).toContainText(/Saved/);
  await page.reload();
  await expect(page.getByTestId('plan-canvas')).toBeVisible();
  await expect.poll(async () => (await snapshot(page))?.walls).toBe(4);
  await expect.poll(async () => (await snapshot(page))?.rooms.length).toBe(1);
});

test('opens the studio sample fitted to the free canvas, shows it in 3D, and exports DXF', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('open-sample-studio').click();
  await expect(page).toHaveURL(/#\/p\//);
  const canvas = page.getByTestId('plan-canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(async () => (await snapshot(page))?.objects ?? 0).toBeGreaterThanOrEqual(30);

  // The start-up fit centres the 9 m × 4.5 m studio between the floating panels.
  await page.waitForTimeout(1200);
  const fit = await page.evaluate(() => {
    const host = document.querySelector('[data-testid="plan-canvas"]')!.getBoundingClientRect();
    const right = (sel: string) => document.querySelector(sel)?.getBoundingClientRect().right ?? host.left;
    const left = (sel: string) => document.querySelector(sel)?.getBoundingClientRect().left ?? host.right;
    return { host: { l: host.left, w: host.width, h: host.height }, freeL: Math.max(right('.library'), right('.tool-rail')), freeR: left('.inspector') };
  });
  const snap = (await snapshot(page))!;
  const toScreenX = (x: number) => fit.host.l + (x - snap.camera.cx) * snap.camera.zoom + fit.host.w / 2;
  const leftEdge = toScreenX(-0.25);
  const rightEdge = toScreenX(9.25);
  expect(leftEdge).toBeGreaterThanOrEqual(fit.freeL);
  expect(rightEdge).toBeLessThanOrEqual(fit.freeR);
  expect(Math.abs((leftEdge + rightEdge) / 2 - (fit.freeL + fit.freeR) / 2)).toBeLessThan(4);

  // 3D view.
  await page.keyboard.press('4');
  await expect(page.getByTestId('scene-3d').locator('canvas')).toBeVisible();
  await expect.poll(async () => (await snapshot(page))?.workspace).toBe('3d');

  // The export dialog frame appears at once; the panel loads into it.
  await page.getByTestId('open-export').click();
  await expect(page.getByTestId('export-dialog')).toBeVisible({ timeout: 1000 });
  await page.getByTestId('export-dxf').click();
  const download = page.waitForEvent('download');
  await page.getByTestId('download-dxf').click();
  expect((await download).suggestedFilename()).toMatch(/\.dxf$/);
});
