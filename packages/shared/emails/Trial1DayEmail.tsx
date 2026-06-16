// Authored in Chat 091. Copy is voice-gated (caveman + stop-slop): no exclamation
// marks, no em-dashes, no manufactured urgency, no gratitude language, butler tone.
//
// Trial day 6 (one day before end). Tone: GENTLY NUDGING. Cross-channel matched
// pair with chat 089's day-6 push (forward reference only; wiring is later).
// Directness escalates informational -> nudging -> action.
//
// Standalone React Email template. Imports ONLY @react-email/components and is
// NOT exported from packages/shared/src/index.ts (keeping it out of the barrel
// avoids the @vesper/db <-> @vesper/shared cycle). It lives outside src/ so the
// package's tsc build and `eslint src` never touch it.
//
// Layer 4 palette (docs/LAYER_4_EXPERIENCE_IDENTITY.md): espresso #1E1815
// background, cream #E8DDC9 foreground, bronze #B8884A button.
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export interface Trial1DayEmailProps {
  /** Absolute URL to the continue/subscribe flow (no PII). */
  continueUrl: string;
}

const ESPRESSO = '#1E1815';
const CREAM = '#E8DDC9';
const BRONZE = '#B8884A';
const FRAUNCES = 'Fraunces, Georgia, "Times New Roman", serif';
const INTER = 'Inter, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Email subject line (voice-gated). */
export const subject = 'Your trial ends tomorrow';

export function Trial1DayEmail({
  continueUrl,
}: Trial1DayEmailProps): React.JSX.Element {
  return (
    <Html>
      <Head />
      <Preview>Your trial ends tomorrow. Shall I keep things running?</Preview>
      <Body style={{ backgroundColor: ESPRESSO, margin: 0, padding: '40px 0' }}>
        <Container
          style={{
            backgroundColor: ESPRESSO,
            maxWidth: '480px',
            margin: '0 auto',
            padding: '32px',
          }}
        >
          <Section>
            <Heading
              style={{
                color: CREAM,
                fontFamily: FRAUNCES,
                fontSize: '26px',
                fontWeight: 500,
                lineHeight: '32px',
                margin: '0 0 16px',
              }}
            >
              Your trial ends tomorrow.
            </Heading>
            <Text
              style={{
                color: CREAM,
                fontFamily: INTER,
                fontSize: '16px',
                lineHeight: '24px',
                margin: '0 0 8px',
              }}
            >
              Shall I keep things running? Continue and your plans, your
              modules, and everything I have learned stay exactly as they are.
              Nothing changes until tomorrow.
            </Text>
            <Button
              href={continueUrl}
              style={{
                backgroundColor: BRONZE,
                color: ESPRESSO,
                borderRadius: '6px',
                padding: '12px 24px',
                fontSize: '14px',
                fontFamily: INTER,
                fontWeight: 500,
                textDecoration: 'none',
                display: 'inline-block',
                marginTop: '16px',
              }}
            >
              Continue with Vesper
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default Trial1DayEmail;
