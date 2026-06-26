// Card primitive — renders, applies the Layer 4 surface tokens, and hardcodes no
// hex/px. @testing-library is not a dependency here (TaskForm.test precedent), so
// we render to static markup and assert on the emitted class attributes.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Card } from './Card';

const NO_HEX = /#[0-9a-fA-F]{3,6}/;
const NO_ARBITRARY_PX = /\[\d+px\]/;

describe('Card', () => {
  it('renders children inside a token-styled surface', () => {
    const html = renderToStaticMarkup(<Card>Hello</Card>);
    expect(html).toContain('Hello');
    for (const cls of ['rounded-lg', 'border-line-subtle', 'bg-surface', 'text-cream']) {
      expect(html).toContain(cls);
    }
  });

  it('includes the vellum overlay by default and omits it when asked', () => {
    expect(renderToStaticMarkup(<Card>x</Card>)).toContain('vellum-overlay');
    expect(renderToStaticMarkup(<Card noVellum>x</Card>)).not.toContain('vellum-overlay');
  });

  it('hardcodes no hex or arbitrary px where a token exists', () => {
    const html = renderToStaticMarkup(<Card className="mt-4">x</Card>);
    expect(html).not.toMatch(NO_HEX);
    expect(html).not.toMatch(NO_ARBITRARY_PX);
  });
});
