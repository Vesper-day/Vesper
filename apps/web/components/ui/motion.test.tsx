// Motion primitives (web) — band/easing tokens (no inline ms/bezier); reduced-motion
// yields the instant token; no literals.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Entrance, Interaction, motionDurationClass } from './motion';

const NO_HEX = /#[0-9a-fA-F]{3,6}/;
const NO_ARBITRARY_PX = /\[\d+px\]/;
// a raw inline duration would look like `duration-[200ms]` or `200ms` in markup
const NO_INLINE_MS = /\d+ms/;
const NO_BEZIER = /cubic-bezier/;

describe('motionDurationClass', () => {
  it('maps bands to the preset token classes', () => {
    expect(motionDurationClass('quick', false)).toBe('duration-quick');
    expect(motionDurationClass('considered', false)).toBe('duration-considered');
  });
  it('collapses to the instant token under reduced motion', () => {
    expect(motionDurationClass('quick', true)).toBe('duration-instant');
    expect(motionDurationClass('considered', true)).toBe('duration-instant');
  });
});

describe('Entrance', () => {
  it('uses the considered band + standard-out easing tokens by default', () => {
    const html = renderToStaticMarkup(<Entrance>hi</Entrance>);
    expect(html).toContain('duration-considered');
    expect(html).toContain('ease-standard-out');
    expect(html).not.toMatch(NO_INLINE_MS);
    expect(html).not.toMatch(NO_BEZIER);
  });
  it('reduced motion yields the instant token and no hidden transform', () => {
    const html = renderToStaticMarkup(<Entrance reduceMotion>hi</Entrance>);
    expect(html).toContain('duration-instant');
    expect(html).toContain('opacity-100');
    expect(html).not.toContain('opacity-0');
  });
});

describe('Interaction', () => {
  it('uses the quick band token and a press scale by default', () => {
    const html = renderToStaticMarkup(<Interaction>tap</Interaction>);
    expect(html).toContain('duration-quick');
    expect(html).toContain('active:scale-95');
  });
  it('reduced motion drops the scale and uses the instant token', () => {
    const html = renderToStaticMarkup(<Interaction reduceMotion>tap</Interaction>);
    expect(html).toContain('duration-instant');
    expect(html).not.toContain('active:scale-95');
  });
  it('hardcodes no hex or arbitrary px', () => {
    const html = renderToStaticMarkup(<Interaction>tap</Interaction>);
    expect(html).not.toMatch(NO_HEX);
    expect(html).not.toMatch(NO_ARBITRARY_PX);
  });
});
