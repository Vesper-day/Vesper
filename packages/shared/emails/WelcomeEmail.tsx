// Authored in Chat 091. Copy is voice-gated (caveman + stop-slop): no exclamation
// marks, no em-dashes, no manufactured urgency, no gratitude language, butler tone.
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

export interface WelcomeEmailProps {
  /** Absolute URL into the app (no PII). */
  appUrl: string;
}

const ESPRESSO = '#1E1815';
const CREAM = '#E8DDC9';
const BRONZE = '#B8884A';
const FRAUNCES = 'Fraunces, Georgia, "Times New Roman", serif';
const INTER = 'Inter, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Email subject line (voice-gated). */
export const subject = 'Welcome to Vesper';

export function WelcomeEmail({ appUrl }: WelcomeEmailProps): React.JSX.Element {
  return (
    <Html>
      <Head />
      <Preview>Your account is ready. Here is what to expect.</Preview>
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
              Welcome to Vesper.
            </Heading>
            <Text
              style={{
                color: CREAM,
                fontFamily: INTER,
                fontSize: '16px',
                lineHeight: '24px',
                margin: '0 0 16px',
              }}
            >
              Your account is ready. Each morning a plan will be waiting,
              built from your calendar, your modules, and what I learn as we
              go. Each evening you can review the next day before it begins.
            </Text>
            <Text
              style={{
                color: CREAM,
                fontFamily: INTER,
                fontSize: '16px',
                lineHeight: '24px',
                margin: '0 0 8px',
              }}
            >
              Tell me what to change in plain words and I will adjust around
              it. For now, open Vesper and we will set up your first day.
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

export default WelcomeEmail;
