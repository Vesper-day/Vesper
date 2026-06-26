// BlockRow primitive — plan-block treatment (radius-lg), mono time, bronze active
// rail; no hex/px literals.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BlockRow } from './BlockRow';

const NO_HEX = /#[0-9a-fA-F]{3,6}/;
const NO_ARBITRARY_PX = /\[\d+px\]/;

describe('BlockRow', () => {
  it('renders title, mono time and meta with plan-block tokens', () => {
    const html = renderToStaticMarkup(
      <BlockRow time="09:00" title="Deep work" meta="Focus" />,
    );
    expect(html).toContain('Deep work');
    expect(html).toContain('09:00');
    expect(html).toContain('Focus');
    expect(html).toContain('rounded-lg');
    expect(html).toContain('bg-surface');
    expect(html).toContain('font-mono');
  });

  it('shows the bronze rail only when active', () => {
    expect(renderToStaticMarkup(<BlockRow title="x" active />)).toContain('border-l-bronze');
    expect(renderToStaticMarkup(<BlockRow title="x" />)).not.toContain('border-l-bronze');
  });

  it('hardcodes no hex or arbitrary px', () => {
    const html = renderToStaticMarkup(<BlockRow time="08:00" title="x" meta="y" active />);
    expect(html).not.toMatch(NO_HEX);
    expect(html).not.toMatch(NO_ARBITRARY_PX);
  });
});
