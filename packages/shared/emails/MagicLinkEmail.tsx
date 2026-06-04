// DRAFT — copy is NOT voice-gated yet; finalized in Chat 091. Do not wire into a
// runtime send path.
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
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export interface MagicLinkEmailProps {
  /** Opaque, single-use confirmation URL (no email/PII in the link). */
  confirmationUrl: string;
}

const ESPRESSO = '#1E1815';
const CREAM = '#E8DDC9';
const BRONZE = '#B8884A';

export function MagicLinkEmail({
  confirmationUrl,
}: MagicLinkEmailProps): React.JSX.Element {
  return (
    <Html>
      <Head />
      <Preview>Your Vesper sign-in link</Preview>
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
            <Text style={{ color: CREAM, fontSize: '16px', lineHeight: '24px' }}>
              Use the button below to sign in to Vesper. The link is single-use
              and expires shortly.
            </Text>
            <Button
              href={confirmationUrl}
              style={{
                backgroundColor: BRONZE,
                color: ESPRESSO,
                borderRadius: '6px',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
                display: 'inline-block',
                marginTop: '16px',
              }}
            >
              Sign in to Vesper
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default MagicLinkEmail;
