// DatePicker primitive — native date input; emits a "YYYY-MM-DD" value;
// token-styled; no literals.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DatePicker } from './DatePicker';

const NO_HEX = /#[0-9a-fA-F]{3,6}/;
const NO_ARBITRARY_PX = /\[\d+px\]/;

describe('DatePicker', () => {
  it('renders a token-styled native date input', () => {
    const html = renderToStaticMarkup(<DatePicker value="2026-06-26" onChange={() => {}} />);
    expect(html).toContain('type="date"');
    for (const cls of ['rounded-md', 'border-line-subtle', 'bg-surface', 'font-body', 'text-cream']) {
      expect(html).toContain(cls);
    }
  });

  it('round-trips a "YYYY-MM-DD" value', () => {
    const html = renderToStaticMarkup(<DatePicker value="2026-06-26" onChange={() => {}} />);
    expect(html).toContain('value="2026-06-26"');
  });

  it('hardcodes no hex or arbitrary px', () => {
    const html = renderToStaticMarkup(<DatePicker value="2026-01-01" onChange={() => {}} />);
    expect(html).not.toMatch(NO_HEX);
    expect(html).not.toMatch(NO_ARBITRARY_PX);
  });
});
