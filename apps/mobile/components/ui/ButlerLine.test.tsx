// ButlerLine (mobile) — Fraunces italic / cream-faint / butler line-height; renders
// nothing when empty; react-native mocked.
import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable' }));

import { ButlerLine } from './ButlerLine';

describe('ButlerLine (mobile)', () => {
  it('renders the ambient line with the butler type treatment', () => {
    const el = ButlerLine({ children: 'Shall we begin?' }) as { props: { className: string } };
    for (const cls of ['font-display', 'italic', 'leading-butler', 'text-cream-faint']) {
      expect(el.props.className).toContain(cls);
    }
  });

  it('renders nothing when empty', () => {
    expect(ButlerLine({ children: '' })).toBeNull();
    expect(ButlerLine({})).toBeNull();
  });
});
