// Web core primitives (Layer 4 / Chat 107). Later screens compose from these;
// they never re-derive the surface, button, block, or butler-line treatment.
export { Card, type CardProps } from './Card';
export { Button, type ButtonProps, type ButtonVariant } from './Button';
export { BlockRow, type BlockRowProps } from './BlockRow';
export { ButlerLine, type ButlerLineProps } from './ButlerLine';

// Part-2 components (Chat 107a): form controls, pickers, the rendered butler-line
// voice surface, and the motion primitives — all composing the same tokens.
export { TextField, type TextFieldProps } from './TextField';
export { Toggle, type ToggleProps } from './Toggle';
export { Select, type SelectProps, type SelectOption } from './Select';
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
  Reveal,
  type RevealProps,
  Interaction,
  type InteractionProps,
  useReducedMotion,
  motionDurationClass,
  type MotionBand,
} from './motion';

// Rich-posture smooth-scroll provider (ADD-D) — composes the Lenis library for
// immersive scroll surfaces; reduced-motion falls back to native scroll.
export { SmoothScroll, type SmoothScrollProps } from './SmoothScroll';
