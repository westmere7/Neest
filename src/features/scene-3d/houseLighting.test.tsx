import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { IBL_HEMI_EQUIVALENT, resolveHouseLighting } from './houseLighting';
import { HouseLightToggle } from '@/components/HouseLightToggle';
import { useEditorStore } from '@/state/editorStore';
import { usePrefsStore } from '@/state/uiStores';

describe('houseLighting', () => {
  it('keeps daytime parameters in light mode and matches diffuse irradiance when PMREM fails', () => {
    const withEnv = resolveHouseLighting({
      mode: 'light',
      envOk: true,
      envIntensity: 0.3,
      sunColor: '#fffbf2',
      sunIntensity: 0.6,
    });
    expect(withEnv).toEqual({
      environmentIntensity: 0.3,
      hemiSky: '#f7f9fb',
      hemiGround: '#888c90',
      hemiIntensity: 0.35 * 0.3,
      sunColor: '#fffbf2',
      sunIntensity: 0.6,
      lampGain: 1,
    });

    const fallback = resolveHouseLighting({
      mode: 'light',
      envOk: false,
      envIntensity: 0.3,
      sunColor: '#fffbf2',
      sunIntensity: 0.6,
    });
    expect(fallback.environmentIntensity).toBe(0);
    expect(fallback.hemiIntensity).toBeCloseTo((0.35 + IBL_HEMI_EQUIVALENT) * 0.3, 5);
    expect(fallback.sunIntensity).toBe(0.6);
    expect(fallback.lampGain).toBe(1);
  });

  it('dims exterior sun and ambient in dark mode while boosting indoor lamps', () => {
    const dark = resolveHouseLighting({
      mode: 'dark',
      envOk: true,
      envIntensity: 0.9,
      sunColor: '#fffbf2',
      sunIntensity: 2.2,
    });
    expect(dark.environmentIntensity).toBeLessThanOrEqual(0.04);
    expect(dark.sunIntensity).toBeLessThanOrEqual(0.16);
    expect(dark.sunColor).toBe('#bfd0ee');
    expect(dark.lampGain).toBeGreaterThan(1);

    const darkFallback = resolveHouseLighting({
      mode: 'dark',
      envOk: false,
      envIntensity: 0.9,
      sunColor: '#fffbf2',
      sunIntensity: 2.2,
    });
    expect(darkFallback.environmentIntensity).toBe(0);
    expect(darkFallback.hemiIntensity).toBeGreaterThan(dark.hemiIntensity);
    expect(darkFallback.sunIntensity).toBe(dark.sunIntensity);
  });

  it('toggles house lighting via an accessible switch without changing the app UI theme', () => {
    useEditorStore.setState({ houseLighting: 'light' });
    const initialTheme = usePrefsStore.getState().theme;
    const initialPref = usePrefsStore.getState().themePref;

    const { rerender } = render(
      <HouseLightToggle
        mode={useEditorStore.getState().houseLighting}
        onChange={(houseLighting) => useEditorStore.getState().set({ houseLighting })}
      />,
    );
    const sw = screen.getByRole('switch', { name: 'House light mode' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    for (const svg of sw.querySelectorAll('svg')) {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    }

    fireEvent.click(sw);
    expect(useEditorStore.getState().houseLighting).toBe('dark');
    expect(usePrefsStore.getState().theme).toBe(initialTheme);
    expect(usePrefsStore.getState().themePref).toBe(initialPref);

    rerender(
      <HouseLightToggle
        mode={useEditorStore.getState().houseLighting}
        onChange={(houseLighting) => useEditorStore.getState().set({ houseLighting })}
      />,
    );
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });
});
