// SegmentedControl primitive — renders options; selected segment via value; token
// classes; not a scorekeeping/progress control; no literals.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SegmentedControl } from './SegmentedControl';

const NO_HEX = /#[0-9a-fA-F]{3,6}/;
const NO_ARBITRARY_PX = /\[\d+px\]/;

const OPTIONS = [
  { label: 'Morning', value: 'am' },
  { label: 'Evening', value: 'pm' },
] as const;

describe('SegmentedControl', () => {
  it('renders every option in a token-styled track', () => {
    const html = renderToStaticMarkup(<SegmentedControl options={OPTIONS} value="am" onChange={() => {}} />);
    expect(html).toContain('Morning');
    expect(html).toContain('Evening');
    expect(html).toContain('rounded-md');
    expect(html).toContain('border-line-subtle');
    expect(html).toContain('bg-surface');
    expect(html).toContain('duration-quick');
  });

  it('marks the selected segment (bronze) and only that one', () => {
    const html = renderToStaticMarkup(<SegmentedControl options={OPTIONS} value="pm" onChange={() => {}} />);
    expect(html).toMatch(/aria-selected="true"[^>]*>Evening/);
    // exactly one bronze fill (the selected segment)
    expect(html.match(/bg-bronze/g)?.length).toBe(1);
  });

  it('is not a scorekeeping/progress control and hardcodes no literals', () => {
    const html = renderToStaticMarkup(<SegmentedControl options={OPTIONS} value="am" onChange={() => {}} />);
    expect(html).not.toContain('progressbar');
    expect(html).not.toMatch(NO_HEX);
    expect(html).not.toMatch(NO_ARBITRARY_PX);
  });
});
