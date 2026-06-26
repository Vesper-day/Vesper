// Button primitive — variants render with the right token classes; the bronze
// primary is the single bronze action; no hex/px literals.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from './Button';

const NO_HEX = /#[0-9a-fA-F]{3,6}/;
const NO_ARBITRARY_PX = /\[\d+px\]/;

describe('Button', () => {
  it('primary is the bronze leather action', () => {
    const html = renderToStaticMarkup(<Button variant="primary">Begin</Button>);
    expect(html).toContain('Begin');
    expect(html).toContain('bg-bronze');
    expect(html).toContain('text-espresso');
    expect(html).toContain('rounded-md');
    // quick press duration token, not a literal
    expect(html).toContain('duration-quick');
  });

  it('destructive uses the oxblood token', () => {
    const html = renderToStaticMarkup(<Button variant="destructive">Delete</Button>);
    expect(html).toContain('text-oxblood');
    expect(html).toContain('border-oxblood');
    expect(html).not.toContain('bg-bronze');
  });

  it('defaults to a non-bronze secondary variant (bronze stays singular)', () => {
    const html = renderToStaticMarkup(<Button>Cancel</Button>);
    expect(html).not.toContain('bg-bronze');
    expect(html).toContain('border-line-strong');
  });

  it('hardcodes no hex or arbitrary px', () => {
    const html = renderToStaticMarkup(<Button variant="primary">x</Button>);
    expect(html).not.toMatch(NO_HEX);
    expect(html).not.toMatch(NO_ARBITRARY_PX);
  });
});
