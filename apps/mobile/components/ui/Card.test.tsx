// Card (mobile) — applies the Layer 4 surface tokens via NativeWind className.
// react-native is mocked to plain host tags so importing it never pulls RN's Flow
// source into vite's SSR transform (mandatory for any RN-importing module). We
// call the component as a function and inspect the returned element's className.
import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable' }));

import { Card } from './Card';

const NO_HEX = /#[0-9a-fA-F]{3,6}/;
const NO_ARBITRARY_PX = /\[\d+px\]/;

describe('Card (mobile)', () => {
  it('renders a token-styled surface', () => {
    const el = Card({ children: 'x' }) as { props: { className: string } };
    for (const cls of ['rounded-lg', 'border-line-subtle', 'bg-surface']) {
      expect(el.props.className).toContain(cls);
    }
  });

  it('merges caller className and hardcodes no hex/px', () => {
    const el = Card({ children: 'x', className: 'mt-4' }) as { props: { className: string } };
    expect(el.props.className).toContain('mt-4');
    expect(el.props.className).not.toMatch(NO_HEX);
    expect(el.props.className).not.toMatch(NO_ARBITRARY_PX);
  });
});
