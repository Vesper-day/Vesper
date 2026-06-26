// ButlerVoice (mobile) — slots copy into the existing ButlerLine container (butler
// role); renders nothing when empty; authors no copy. Executes the composed
// ButlerLine to read its resolved className. react-native mocked.
import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({ Text: 'Text', View: 'View' }));

import { ButlerVoice } from './ButlerVoice';
import { ButlerLine } from './ButlerLine';

type Wrapper = { type: typeof ButlerLine; props: { className?: string; children?: string } };
type Line = { props: { className: string; children: string } } | null;

describe('ButlerVoice (mobile)', () => {
  it('renders slotted copy in the butler role via the existing container', () => {
    // copy supplied by the TEST (the surface), never authored by the component
    const el = ButlerVoice({ copy: 'Shall we begin with the morning?' }) as unknown as Wrapper;
    expect(el.type).toBe(ButlerLine);
    const line = ButlerLine(el.props) as Line;
    expect(line).not.toBeNull();
    for (const cls of ['font-display', 'italic', 'leading-butler', 'text-cream-faint']) {
      expect(line!.props.className).toContain(cls);
    }
    expect(line!.props.children).toBe('Shall we begin with the morning?');
  });

  it('renders nothing when the slot is empty', () => {
    expect(ButlerLine((ButlerVoice({}) as unknown as Wrapper).props)).toBeNull();
    expect(ButlerLine((ButlerVoice({ copy: '' }) as unknown as Wrapper).props)).toBeNull();
  });
});
