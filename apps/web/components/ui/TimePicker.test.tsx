// TimePicker primitive — native time input; round-trips the "HH:mm" wakeTarget /
// bedtimeTarget shape; token-styled; no literals.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TimePicker } from './TimePicker';

const NO_HEX = /#[0-9a-fA-F]{3,6}/;
const NO_ARBITRARY_PX = /\[\d+px\]/;

describe('TimePicker', () => {
  it('renders a token-styled native time input', () => {
    const html = renderToStaticMarkup(<TimePicker value="07:30" onChange={() => {}} />);
    expect(html).toContain('type="time"');
    for (const cls of ['rounded-md', 'border-line-subtle', 'bg-surface', 'font-body', 'text-cream']) {
      expect(html).toContain(cls);
    }
  });

  it('round-trips the "HH:mm" value (the wakeTarget/bedtimeTarget format)', () => {
    const html = renderToStaticMarkup(<TimePicker value="07:30" onChange={() => {}} />);
    expect(html).toContain('value="07:30"');
  });

  it('hardcodes no hex or arbitrary px', () => {
    const html = renderToStaticMarkup(<TimePicker value="22:00" onChange={() => {}} />);
    expect(html).not.toMatch(NO_HEX);
    expect(html).not.toMatch(NO_ARBITRARY_PX);
  });
});
