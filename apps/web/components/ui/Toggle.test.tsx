// Toggle primitive — renders both states; on/off via prop; quick-band motion token
// (not an inline ms); no literals.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Toggle } from './Toggle';

const NO_HEX = /#[0-9a-fA-F]{3,6}/;
const NO_ARBITRARY_PX = /\[\d+px\]/;

describe('Toggle', () => {
  it('renders the on state (bronze track, knob shifted)', () => {
    const html = renderToStaticMarkup(<Toggle checked onChange={() => {}} />);
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('bg-bronze');
    expect(html).toContain('translate-x-6');
  });

  it('renders the off state (surface track, knob home)', () => {
    const html = renderToStaticMarkup(<Toggle checked={false} onChange={() => {}} />);
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('bg-surface');
    expect(html).toContain('translate-x-1');
    expect(html).not.toContain('bg-bronze');
  });

  it('animates with the quick-band token, not an inline duration', () => {
    const html = renderToStaticMarkup(<Toggle checked onChange={() => {}} />);
    expect(html).toContain('duration-quick');
    expect(html).not.toMatch(NO_HEX);
    expect(html).not.toMatch(NO_ARBITRARY_PX);
  });
});
