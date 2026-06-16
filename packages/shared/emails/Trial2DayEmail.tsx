// Authored in Chat 091. Copy is voice-gated (caveman + stop-slop): no exclamation
// marks, no em-dashes, no manufactured urgency, no gratitude language, butler tone.
//
// Trial day 5 (two days before end). Tone: INFORMATIONAL. First of three trial
// reminders; directness escalates informational -> nudging -> action.
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

export interface Trial2DayEmailProps {
  /** Absolute URL into the app (no PII). */
  appUrl: string;
}

const ESPRESSO = '#1E1815';
const CREAM = '#E8DDC9';
const BRONZE = '#B8884A';
const FRAUNCES = 'Fraunces, Georgia, "Times New Roman", serif';
const INTER = 'Inter, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Email subject line (voice-gated). */
export const subject = 'Two days left in your trial';

export function Trial2DayEmail({ appUrl }: Trial2DayEmailProps): React.JSX.Element {
  return (
    <Html>
      <Head />
      <Preview>Two days left in your trial. Nothing changes until then.</Preview>
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
              Two days left in your trial.
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
              You have two days remaining. Everything runs as normal until
              then. Anything you would like to ask before then?
            </Text>
            <Button
              href={appUrl}
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
              Open Vesper
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default Trial2DayEmail;
