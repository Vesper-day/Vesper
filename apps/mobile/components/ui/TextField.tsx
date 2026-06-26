// TextField — RN token-styled text input (Layer 4 / Chat 107a), the mobile twin of
// the web TextField. Composes the 107 input tokens via NativeWind className only:
// bg-surface, border-line-subtle, rounded-md, Inter body role (font-body text-sm),
// text-cream, cream-faint placeholder. Controlled via RN's onChangeText (string)
// contract. No hex/px literal — the placeholder colour rides the placeholder:
// className variant, not an inline placeholderTextColor hex.
import { TextInput, type TextInputProps } from 'react-native';
import { cn } from './utils';

export interface TextFieldProps extends TextInputProps {
  className?: string;
}

export function TextField({ className, ...props }: TextFieldProps) {
  return (
    <TextInput
      className={cn(
        'w-full rounded-md border border-line-subtle bg-surface px-3 py-2',
        'font-body text-sm text-cream placeholder:text-cream-faint',
        className,
      )}
      {...props}
    />
  );
}
