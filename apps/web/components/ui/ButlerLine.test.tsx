// ButlerLine primitive — Fraunces italic, text-tertiary, butler line-height;
// renders nothing when empty; no hex/px literals.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ButlerLine } from './ButlerLine';

const NO_HEX = /#[0-9a-fA-F]{3,6}/;
const NO_ARBITRARY_PX = /\[\d+px\]/;

describe('ButlerLine', () => {
  it('renders the ambient line with the butler type treatment', () => {
    const html = renderToStaticMarkup(
      <ButlerLine>Shall we begin with the morning?</ButlerLine>,
    );
    expect(html).toContain('Shall we begin with the morning?');
    expect(html).toContain('font-display');
    expect(html).toContain('italic');
    expect(html).toContain('leading-butler');
    expect(html).toContain('text-cream-faint');
  });

  it('renders nothing when empty (no chrome for an absent line)', () => {
    expect(renderToStaticMarkup(<ButlerLine>{''}</ButlerLine>)).toBe('');
    expect(renderToStaticMarkup(<ButlerLine />)).toBe('');
  });

  it('hardcodes no hex or arbitrary px', () => {
    const html = renderToStaticMarkup(<ButlerLine>x</ButlerLine>);
    expect(html).not.toMatch(NO_HEX);
    expect(html).not.toMatch(NO_ARBITRARY_PX);
  });
});
