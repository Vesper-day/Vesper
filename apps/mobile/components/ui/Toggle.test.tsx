// Toggle (mobile) — both states; on/off via prop; quick-band token; react-native mocked.
import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({ Pressable: 'Pressable', View: 'View', Text: 'Text' }));

import { Toggle } from './Toggle';

type El = { props: { className: string; children: { props: { className: string } } } };
const NO_HEX = /#[0-9a-fA-F]{3,6}/;

describe('Toggle (mobile)', () => {
  it('renders the on state (bronze track, knob shifted)', () => {
    const el = Toggle({ checked: true }) as unknown as El;
    expect(el.props.className).toContain('bg-bronze');
    expect(el.props.className).toContain('duration-quick');
    expect(el.props.children.props.className).toContain('translate-x-5');
  });

  it('renders the off state (surface track, knob home)', () => {
    const el = Toggle({ checked: false }) as unknown as El;
    expect(el.props.className).toContain('bg-surface');
    expect(el.props.className).not.toContain('bg-bronze');
    expect(el.props.children.props.className).toContain('translate-x-0');
  });

  it('hardcodes no hex', () => {
    const el = Toggle({ checked: true }) as unknown as El;
    expect(el.props.className).not.toMatch(NO_HEX);
    expect(el.props.children.props.className).not.toMatch(NO_HEX);
  });
});
