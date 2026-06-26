// BlockRow (mobile) — plan-block tokens, bronze active rail; react-native mocked.
import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable' }));

import { BlockRow } from './BlockRow';

const NO_HEX = /#[0-9a-fA-F]{3,6}/;

describe('BlockRow (mobile)', () => {
  it('applies the plan-block surface tokens', () => {
    const el = BlockRow({ time: '09:00', title: 'Deep work', meta: 'Focus' }) as {
      props: { className: string };
    };
    expect(el.props.className).toContain('rounded-lg');
    expect(el.props.className).toContain('bg-surface');
    expect(el.props.className).not.toContain('border-l-bronze');
  });

  it('adds the bronze rail only when active, with no hex literal', () => {
    const el = BlockRow({ title: 'x', active: true }) as { props: { className: string } };
    expect(el.props.className).toContain('border-l-bronze');
    expect(el.props.className).not.toMatch(NO_HEX);
  });
});
