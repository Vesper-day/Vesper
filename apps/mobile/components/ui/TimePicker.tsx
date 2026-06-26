// TimePicker — RN time-of-day capture (Layer 4 / Chat 107a), sized for the onboarding
// wake/bed capture and the module-preference surfaces. Mechanism: no datetime-picker
// dependency is a mobile dep and RN has no native time <input>, so this composes the
// 107 TextField primitive as a validated "HH:mm" entry rather than adding a heavy
// picker dep (a native wheel picker is a later on-device pass).
//
// Data shape: emits/consumes "HH:mm" (24-hour, zero-padded) via TextField's
// onChangeText — the exact wire format of BaseProfile.wakeTarget / bedtimeTarget
// (parsed live as /^(\d{2}):(\d{2})$/ in apps/mobile/lib/alarm.ts). Round-trips
// with no conversion.
import { TextField } from './TextField';

export interface TimePickerProps {
  /** "HH:mm" (24-hour) — the wakeTarget/bedtimeTarget wire format. */
  value: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  return (
    <TextField
      value={value}
      onChangeText={onChange}
      placeholder="HH:mm"
      keyboardType="numbers-and-punctuation"
      autoCapitalize="none"
      autoCorrect={false}
      maxLength={5}
      accessibilityLabel="Time, 24-hour HH:mm"
      className={className}
    />
  );
}
