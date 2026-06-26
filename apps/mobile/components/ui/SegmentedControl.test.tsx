// SegmentedControl (mobile) — options; selected segment via value; tokens; not a
// scorekeeping control; react-native mocked.
import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({ Pressable: 'Pressable', View: 'View', Text: 'Text' }));

import { SegmentedControl } from './SegmentedControl';

type Segment = { props: { className: string; children: { props: { className: string; children: string } } } };
type El = { props: { className: string; children: Segment[] } };
const NO_HEX = /#[0-9a-fA-F]{3,6}/;

const OPTIONS = [
  { label: 'Morning', value: 'am' },
  { label: 'Evening', value: 'pm' },
] as const;

describe('SegmentedControl (mobile)', () => {
  it('renders a token-styled track of segments', () => {
    const el = SegmentedControl({ options: OPTIONS, value: 'am' }) as unknown as El;
    expect(el.props.className).toContain('rounded-md');
    expect(el.props.className).toContain('border-line-subtle');
    expect(el.props.className).toContain('bg-surface');
    expect(el.props.children).toHaveLength(2);
  });

  it('fills only the selected segment with bronze', () => {
    const el = SegmentedControl({ options: OPTIONS, value: 'pm' }) as unknown as El;
    const segments = el.props.children;
    expect(segments).toHaveLength(2);
    expect(segments[0]!.props.className).toContain('bg-transparent');
    expect(segments[1]!.props.className).toContain('bg-bronze');
    expect(segments[1]!.props.children.props.children).toBe('Evening');
  });

  it('hardcodes no hex', () => {
    const el = SegmentedControl({ options: OPTIONS, value: 'am' }) as unknown as El;
    expect(el.props.className).not.toMatch(NO_HEX);
  });
});
