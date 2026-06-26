// ButlerVoice surface — renders the slotted line in the butler role via the existing
// ButlerLine container; renders nothing when empty; authors no copy; not scorekeeping.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ButlerVoice } from './ButlerVoice';

const NO_HEX = /#[0-9a-fA-F]{3,6}/;

describe('ButlerVoice', () => {
  it('renders slotted copy in the butler role via the existing container', () => {
    // copy supplied by the TEST (the surface), never authored by the component
    const html = renderToStaticMarkup(<ButlerVoice copy="Shall we begin with the morning?" />);
    expect(html).toContain('Shall we begin with the morning?');
    expect(html).toContain('font-display');
    expect(html).toContain('italic');
    expect(html).toContain('leading-butler');
    expect(html).toContain('text-cream-faint');
  });

  it('renders nothing when the slot is empty (no chrome, no authored copy)', () => {
    expect(renderToStaticMarkup(<ButlerVoice />)).toBe('');
    expect(renderToStaticMarkup(<ButlerVoice copy="" />)).toBe('');
  });

  it('is not a scorekeeping surface and hardcodes no hex', () => {
    const html = renderToStaticMarkup(<ButlerVoice copy="x" />);
    expect(html).not.toContain('progressbar');
    expect(html).not.toMatch(NO_HEX);
  });
});
