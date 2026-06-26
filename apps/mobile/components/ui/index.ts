// Mobile core primitives (Layer 4 / Chat 107). Later screens compose from these;
// they never re-derive the surface, button, block, or butler-line treatment.
export { Card, type CardProps } from './Card';
export { Button, type ButtonProps, type ButtonVariant } from './Button';
export { BlockRow, type BlockRowProps } from './BlockRow';
export { ButlerLine, type ButlerLineProps } from './ButlerLine';

// Part-2 components (Chat 107a): form controls, pickers, the rendered butler-line
// voice surface, and the motion primitives — all composing the same tokens. RN has
// no native <select>, so the select/segmented role ships as SegmentedControl only.
export { TextField, type TextFieldProps } from './TextField';
export { Toggle, type ToggleProps } from './Toggle';
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentOption,
} from './SegmentedControl';
export { TimePicker, type TimePickerProps } from './TimePicker';
export { DatePicker, type DatePickerProps } from './DatePicker';
export { ButlerVoice, type ButlerVoiceProps } from './ButlerVoice';
export {
  Entrance,
  type EntranceProps,
  Interaction,
  type InteractionProps,
  useReducedMotion,
  bandDurationMs,
  springConfig,
  type MotionBand,
} from './motion';
