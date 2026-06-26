// Button (mobile) — variant tokens; bronze primary is the single bronze action;
// react-native mocked (RN-importing module). Inspect container + label className.
import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable' }));

import { Button } from './Button';

type El = { props: { className: string; children: { props: { className: string } } } };
const NO_HEX = /#[0-9a-fA-F]{3,6}/;

describe('Button (mobile)', () => {
  it('primary is the bronze action with espresso label', () => {
    const el = Button({ title: 'Begin', variant: 'primary' }) as unknown as El;
    expect(el.props.className).toContain('bg-bronze');
    expect(el.props.children.props.className).toContain('text-espresso');
    expect(el.props.className).toContain('rounded-md');
  });

  it('destructive uses oxblood; default secondary is not bronze', () => {
    const d = Button({ title: 'Delete', variant: 'destructive' }) as unknown as El;
    expect(d.props.className).toContain('border-oxblood');
    expect(d.props.children.props.className).toContain('text-oxblood');

    const s = Button({ title: 'Cancel' }) as unknown as El;
    expect(s.props.className).not.toContain('bg-bronze');
    expect(s.props.className).toContain('border-line-strong');
  });

  it('hardcodes no hex', () => {
    const el = Button({ title: 'x', variant: 'primary' }) as unknown as El;
    expect(el.props.className).not.toMatch(NO_HEX);
    expect(el.props.children.props.className).not.toMatch(NO_HEX);
  });
});
