// TimePicker (mobile) — composes TextField; round-trips the "HH:mm" wakeTarget /
// bedtimeTarget shape via onChangeText; react-native mocked (TextField imports it).
import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({ TextInput: 'TextInput', View: 'View', Text: 'Text' }));

import { TimePicker } from './TimePicker';
import { TextField } from './TextField';

type El = { type: unknown; props: { value: string; placeholder: string; onChangeText?: (v: string) => void } };

describe('TimePicker (mobile)', () => {
  it('composes the TextField primitive with the HH:mm slot', () => {
    const el = TimePicker({ value: '07:30' }) as unknown as El;
    expect(el.type).toBe(TextField);
    expect(el.props.value).toBe('07:30');
    expect(el.props.placeholder).toBe('HH:mm');
  });

  it('wires onChange to TextField.onChangeText (string round-trip)', () => {
    let got = '';
    const el = TimePicker({ value: '07:30', onChange: (v) => (got = v) }) as unknown as El;
    el.props.onChangeText?.('22:00');
    expect(got).toBe('22:00');
  });
});
