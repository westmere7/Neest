import type { CalloutColor } from '@/domain/model/schema';

/**
 * Note colours: `main` for leaders, marks, borders and filled labels, `fill` for the card tint,
 * `text` for text on the tint, `onMain` for text on a filled label. The first five are muted; the
 * rest are vivid. Kept free of other imports: the guest viewer bundles it.
 */
export const CALLOUT_PALETTE: Record<CalloutColor, { main: string; fill: string; text: string; onMain: string }> = {
  teal: { main: '#2a8a78', fill: '#eef7f4', text: '#14332d', onMain: '#ffffff' },
  brass: { main: '#b0862f', fill: '#fbf5e6', text: '#3a2c0d', onMain: '#ffffff' },
  coral: { main: '#d0584a', fill: '#fdf0ee', text: '#45160f', onMain: '#ffffff' },
  blue: { main: '#3f6fb5', fill: '#eef3fb', text: '#14264a', onMain: '#ffffff' },
  slate: { main: '#55606b', fill: '#f2f4f6', text: '#1f262c', onMain: '#ffffff' },
  red: { main: '#e5262f', fill: '#fdecec', text: '#4a0b0f', onMain: '#ffffff' },
  orange: { main: '#f26b0f', fill: '#fff1e6', text: '#4a1f02', onMain: '#ffffff' },
  yellow: { main: '#f5bf00', fill: '#fff8db', text: '#3d3000', onMain: '#2a2100' },
  green: { main: '#14a83c', fill: '#e8f8ec', text: '#06361a', onMain: '#ffffff' },
  cyan: { main: '#00a7d6', fill: '#e3f6fc', text: '#03323f', onMain: '#ffffff' },
  violet: { main: '#7c3aed', fill: '#f2ecfe', text: '#2a0f5c', onMain: '#ffffff' },
  pink: { main: '#e7268f', fill: '#fdeaf4', text: '#4d0a2e', onMain: '#ffffff' },
  black: { main: '#1d2125', fill: '#f1f2f3', text: '#111417', onMain: '#ffffff' },
};
