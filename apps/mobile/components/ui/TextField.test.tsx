// TextField (mobile) — token classes; value passthrough; react-native mocked.
import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({ TextInput: 'TextInput', View: 'View', Text: 'Text' }));

import { TextField } from './TextField';

type El = { props: { className: string; value?: string } };
const NO_HEX = /#[0-9a-fA-F]{3,6}/;

describe('TextField (mobile)', () => {
  it('applies the 107 input tokens and body role', () => {
    const el = TextField({ placeholder: 'e.g. 30' }) as unknown as El;
    for (const cls of ['rounded-md', 'border-line-subtle', 'bg-surface', 'font-body', 'text-sm', 'text-cream']) {
      expect(el.props.className).toContain(cls);
    }
  });

  it('passes a controlled value through', () => {
    const el = TextField({ value: 'hello' }) as unknown as El;
    expect(el.props.value).toBe('hello');
  });

  it('hardcodes no hex', () => {
    const el = TextField({}) as unknown as El;
    expect(el.props.className).not.toMatch(NO_HEX);
  });
});
