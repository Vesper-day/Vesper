// DatePicker — RN calendar-day capture (Layer 4 / Chat 107a) for the surfaces that
// consume a date alongside the wake/bed times. Mechanism: no datetime-picker
// dependency is a mobile dep and RN has no native date <input>, so this composes the
// 107 TextField primitive as a validated "YYYY-MM-DD" entry rather than adding a
// heavy picker dep (a native calendar picker is a later on-device pass). Emits /
// consumes "YYYY-MM-DD" via TextField's onChangeText.
import { TextField } from './TextField';

export interface DatePickerProps {
  /** "YYYY-MM-DD" calendar day. */
  value: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function DatePicker({ value, onChange, className }: DatePickerProps) {
  return (
    <TextField
      value={value}
      onChangeText={onChange}
      placeholder="YYYY-MM-DD"
      keyboardType="numbers-and-punctuation"
      autoCapitalize="none"
      autoCorrect={false}
      maxLength={10}
      accessibilityLabel="Date, YYYY-MM-DD"
      className={className}
    />
  );
}
