// Select primitive — renders options; selection via value; token classes; not a
// scorekeeping/progress control; no literals.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Select } from './Select';

const NO_HEX = /#[0-9a-fA-F]{3,6}/;
const NO_ARBITRARY_PX = /\[\d+px\]/;

const OPTIONS = [
  { label: 'Low', value: 'low' },
  { label: 'High', value: 'high' },
] as const;

describe('Select', () => {
  it('renders its options inside a token-styled control', () => {
    const html = renderToStaticMarkup(<Select options={OPTIONS} value="low" onChange={() => {}} />);
    expect(html).toContain('Low');
    expect(html).toContain('High');
    for (const cls of ['rounded-md', 'border-line-subtle', 'bg-surface', 'font-body', 'text-cream']) {
      expect(html).toContain(cls);
    }
  });

  it('reflects the selected value', () => {
    const html = renderToStaticMarkup(<Select options={OPTIONS} value="high" onChange={() => {}} />);
    // react-dom marks the selected <option> on a controlled <select>
    expect(html).toMatch(/<option[^>]*value="high"[^>]*selected/);
  });

  it('is not a scorekeeping/progress control and hardcodes no literals', () => {
    const html = renderToStaticMarkup(<Select options={OPTIONS} value="low" onChange={() => {}} />);
    expect(html).not.toContain('progressbar');
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toMatch(NO_HEX);
    expect(html).not.toMatch(NO_ARBITRARY_PX);
  });
});
