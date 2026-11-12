import { describe, expect, it } from 'vitest';
import { parseRoute } from './App';

describe('routes', () => {
  it('opens a project for editing, or view-only with /view', () => {
    expect(parseRoute('#/p/prj_abc123')).toEqual({ name: 'editor', id: 'prj_abc123' });
    expect(parseRoute('#/p/prj_abc123/view')).toEqual({ name: 'editor', id: 'prj_abc123', view: true });
    expect(parseRoute('#/guest/prj_abc123')).toEqual({ name: 'guest', id: 'prj_abc123' });
    expect(parseRoute('#/')).toEqual({ name: 'home' });
  });
});
