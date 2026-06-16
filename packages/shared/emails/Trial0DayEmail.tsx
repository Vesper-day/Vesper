// Authored in Chat 091. Copy is voice-gated (caveman + stop-slop): no exclamation
// marks, no em-dashes, no manufactured urgency, no gratitude language, butler tone.
//
// Trial day 7 (day of end). Tone: ACTION-ORIENTED. Presents the concrete week
// ledger, then the decision: Continue or End. Directness escalates across the
// three trial reminders: informational -> nudging -> action.
//
// Ledger figures are real counts passed in by the caller. No derived figures,
// no time-saved estimates (Layer 4 copy library).
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

export interface Trial0DayEmailProps {
  /** Blocks arranged this week. */
  blocksArranged: number;
  /** Scheduling conflicts resolved this week. */
  conflictsResolved: number;
  /** Meals planned this week. */
  mealsPlanned: number;
  /** Times the day was reshuffled this week. */
  daysReshuffled: number;
  /** Absolute URL to the continue/subscribe flow (no PII). */
  continueUrl: string;
  /** Absolute URL to end the account (no PII). */
  endUrl: string;
}

const ESPRESSO = '#1E1815';
const CREAM = '#E8DDC9';
const BRONZE = '#B8884A';
const FRAUNCES = 'Fraunces, Georgia, "Times New Roman", serif';
const INTER = 'Inter, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Email subject line (voice-gated). */
export const subject = 'Your week is up';

export function Trial0DayEmail({
  blocksArranged,
  conflictsResolved,
  mealsPlanned,
  daysReshuffled,
  continueUrl,
  endUrl,
}: Trial0DayEmailProps): React.JSX.Element {
  return (
    <Html>
      <Head />
      <Preview>Your week is up. Continue, or end here.</Preview>
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
            <Text
              style={{
                color: CREAM,
                fontFamily: INTER,
                fontSize: '16px',
                lineHeight: '24px',
                margin: '0 0 24px',
              }}
            >
              This week I arranged {blocksArranged} blocks, resolved{' '}
              {conflictsResolved} conflicts, planned {mealsPlanned} meals, and
              reshuffled your day {daysReshuffled} times.
            </Text>
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
              Your week is up.
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
              Continue and everything stays as it is. End here and I will keep
              your data for thirty days if you decide to come back.
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
                marginRight: '12px',
              }}
            >
              Continue
            </Button>
            <Button
              href={endUrl}
              style={{
                backgroundColor: 'transparent',
                color: CREAM,
                border: `1px solid ${CREAM}`,
                borderRadius: '6px',
                padding: '11px 24px',
                fontSize: '14px',
                fontFamily: INTER,
                fontWeight: 500,
                textDecoration: 'none',
                display: 'inline-block',
                marginTop: '16px',
              }}
            >
              End
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default Trial0DayEmail;
