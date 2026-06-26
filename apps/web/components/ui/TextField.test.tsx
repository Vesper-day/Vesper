// TextField primitive — token-styled input; body role; value wired; no literals.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TextField } from './TextField';

const NO_HEX = /#[0-9a-fA-F]{3,6}/;
const NO_ARBITRARY_PX = /\[\d+px\]/;

describe('TextField', () => {
  it('applies the 107 input tokens and body type role', () => {
    const html = renderToStaticMarkup(<TextField placeholder="e.g. 30" />);
    for (const cls of ['rounded-md', 'border-line-subtle', 'bg-surface', 'font-body', 'text-sm', 'text-cream']) {
      expect(html).toContain(cls);
    }
    // focus is a quick-band token transition, not a hardcoded ms
    expect(html).toContain('duration-quick');
  });

  it('round-trips a controlled value', () => {
    const html = renderToStaticMarkup(<TextField value="hello" readOnly />);
    expect(html).toContain('value="hello"');
  });

  it('hardcodes no hex or arbitrary px', () => {
    const html = renderToStaticMarkup(<TextField className="mt-2" />);
    expect(html).not.toMatch(NO_HEX);
    expect(html).not.toMatch(NO_ARBITRARY_PX);
  });
});
