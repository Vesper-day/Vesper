// DatePicker (mobile) — composes TextField; round-trips a "YYYY-MM-DD" value via
// onChangeText; react-native mocked (TextField imports it).
import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({ TextInput: 'TextInput', View: 'View', Text: 'Text' }));

import { DatePicker } from './DatePicker';
import { TextField } from './TextField';

type El = { type: unknown; props: { value: string; placeholder: string; onChangeText?: (v: string) => void } };

describe('DatePicker (mobile)', () => {
  it('composes the TextField primitive with the YYYY-MM-DD slot', () => {
    const el = DatePicker({ value: '2026-06-26' }) as unknown as El;
    expect(el.type).toBe(TextField);
    expect(el.props.value).toBe('2026-06-26');
    expect(el.props.placeholder).toBe('YYYY-MM-DD');
  });

  it('wires onChange to TextField.onChangeText', () => {
    let got = '';
    const el = DatePicker({ value: '2026-06-26', onChange: (v) => (got = v) }) as unknown as El;
    el.props.onChangeText?.('2026-01-01');
    expect(got).toBe('2026-01-01');
  });
});
