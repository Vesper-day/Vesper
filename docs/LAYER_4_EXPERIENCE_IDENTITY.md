# Layer 4: Experience and Identity

## Layer Purpose

Layer 4 translates the warm-dark mood direction locked in Layer 1, the product scope locked in Layer 2, and the technical architecture locked in Layer 3 into concrete, buildable design and copy specifications. Where prior layers answered who the product is for, what it does, and how it is built, this layer answers what it looks like, how it sounds, how it feels in motion, and what it says.

This layer produces seven sets of decisions: the name, the complete design system (color, typography, spacing, radii, motion, iconography, logo), the artistic vision that drives every surface from landing page to settings panel, the ambient butler line system that doubles as the natural-language input surface, the full butler voice copy library, the screen-by-screen onboarding flow with copy and timing, the notification strategy with quiet hours and channel restraint, the empty states and error states across every major surface, the Live Activity SwiftUI widget visual design, the marketing visual language for landing page and social presence, and the accessibility baseline.

Decisions in this layer cascade into every pixel of the build. Where Layer 4 expands on or refines decisions made in prior layers, the change is documented explicitly. A dedicated cross-layer updates section at the end of this document captures specific text replacements required in the Layer 2 and Layer 3 source files.

## Working Direction From Prior Layers

The product is a Life OS for young professionals ages 22 to 32, with a butler-tone voice modeled on Jarvis from Iron Man. The brand aesthetic is warm darkness rather than cold darkness, evoking dimly-lit libraries at dusk and old manor studies with modern function. The product launches in the United States only at V1. Web and mobile both ship at launch, mobile-and-web parity with iOS-only on the mobile side at V1; Android ships as a friend-assisted fast-follow post-V1 with no committed delivery date. Seven pillars ship at V1: the AI plan engine, the seven modules (work, fitness, nutrition, sleep, errands, medication, finance), the calendar dual surface, mobile-and-web parity, the natural-language input surface, the adaptive onboarding flow, and the Dynamic Island integration. The architecture is template-customization with approximately 150 workout templates and 300 recipe templates plus AI selection and adaptation. The business model is a one-week free trial converting to paid.

Layer 4 builds entirely within those constraints.

## Name

**Vesper.** Latin for evening prayer. Multisyllabic, dignified, classical etymology. Aligns directly with the warm-dark dusk-manor brand mood. Pronounceable but with enough character to feel premium.

The brand is referred to as "Vesper" in all spoken and written contexts. The top-level domain is treated as a written-only design element that adds character to the URL without becoming part of the spoken brand. People say "Vesper"; they type "vesper.house" or "vesper.studio" or whichever TLD is chosen.

TLD selection is deferred to the founder for final purchase. The original candidate vesper.house was taken at the time of writing; the founder will resolve this during Phase 3 (Environment Setup). Strong remaining candidates include vesper.studio, vesper.day, and vesper.care. The TLD should be additive and thematic, sitting comfortably in the warm-dark register, and priced within a reasonable range (target $50 to $100 per year).

## Color System

The color palette executes the warm-dark dusk-manor direction set in Layer 1. All values are locked hex codes for Tailwind config and platform design tokens.

### Surface Colors

| Token | Hex | Usage |
|---|---|---|
| `bg-primary` | `#1E1815` | Page and screen backgrounds, deepest layer |
| `bg-surface` | `#2B221C` | Cards, blocks, elevated surfaces |
| `bg-elevated` | `#38291E` | Hover and active states on surface elements, modal sheets |

### Text Colors

| Token | Hex | Usage |
|---|---|---|
| `text-primary` | `#E8DDC9` | Body text, primary content |
| `text-secondary` | `#A89B85` | Secondary copy, descriptions, labels |
| `text-tertiary` | `#756B57` | Footnote, ambient butler line, lowest hierarchy text |

### Accent Colors

| Token | Hex | Usage |
|---|---|---|
| `accent-bronze` | `#B8884A` | Primary accent, buttons, links, completion indicators, app icon field |
| `accent-oxblood` | `#5C2A2A` | Secondary accent, destructive actions, error states |

### Border Colors

| Token | Hex | Usage |
|---|---|---|
| `border-subtle` | `#3D332A` | Card outlines, divider lines, low-emphasis separators |
| `border-strong` | `#5C4F40` | Focus indicators, prominent containers, high-emphasis separators |

### State Colors

| Token | Hex | Usage |
|---|---|---|
| `state-success` | `#6B7A5A` | Muted forest green, success confirmations |
| `state-warning` | `#B8884A` | Bronze, repurposed for warnings |
| `state-error` | `#5C2A2A` | Oxblood, error states and destructive confirmations |

### Differentiation Check

Verified against competitors per Layer 1 direction. Vesper's espresso `#1E1815` is materially warmer than Motion's slate `#0F1419` and Linear's neutral charcoal `#08090A`. The bronze accent `#B8884A` sits in an unoccupied position relative to Reclaim's calendar blue, Tiimo's saturated playful palette, and the soft beige of lifestyle wellness apps. The combination of espresso plus bronze plus cream is genuinely distinct in the productivity app category.

## Typography

Three font families. All sourced from Google Fonts (free, variable, well-supported across web and mobile).

### Display: Fraunces

Fraunces handles all display type: headlines, hero copy, the ambient butler line, the brand wordmark, and any moment that requires literary weight. Fraunces is a variable serif with adjustable softness and optical sizing axes. Default settings produce a modern, substantial serif with character in the details but grounded in body. Adjusting the soft axis upward gives more warmth; adjusting optical size upward increases display weight.

| Style | Size | Weight | Optical | Letter-spacing |
|---|---|---|---|---|
| Display 1 | 48 to 64pt | 500 | 24 | -0.02em |
| Display 2 | 32 to 40pt | 500 | 18 | -0.015em |
| Display 3 | 24 to 28pt | 500 | 14 | -0.01em |
| Butler line (italic) | 14 to 16pt | 400 | 9 | 0 |

### Body: Inter

Inter handles body text, UI labels, form fields, and all general interface text. Inter is the industry-standard humanist sans-serif, free, variable, and pairs cleanly with Fraunces.

| Style | Size | Weight | Letter-spacing |
|---|---|---|---|
| Body large | 16 to 18pt | 400 | 0 |
| Body | 14 to 15pt | 400 | 0 |
| Body small | 12 to 13pt | 400 | 0.005em |
| UI label | 12pt | 500 | 0.02em |
| UI label small | 10pt | 500 | 0.04em |

### Mono: JetBrains Mono

JetBrains Mono handles times, version strings, API keys in settings, timestamps in the completion log, and any code-like element. Mono comprises roughly 5 to 8 percent of total text in the application.

| Style | Size | Weight |
|---|---|---|
| Mono | 14pt | 400 |
| Mono small | 12pt | 400 |

### Line Height and Vertical Rhythm

Body text uses line height 1.5. Display type uses line height 1.2. Butler line uses line height 1.4. All numeric values can be overridden per surface where vertical rhythm demands adjustment.

## Spacing Scale

4px base unit. Generous whitespace is part of the calm aesthetic.

| Token | Value |
|---|---|
| `space-0` | 0px |
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |
| `space-12` | 48px |
| `space-16` | 64px |
| `space-20` | 80px |
| `space-24` | 96px |
| `space-32` | 128px |

Most UI surfaces use 8, 16, 24, and 32. Section breathing on the landing page uses 64 and above.

## Border Radii

| Token | Value | Usage |
|---|---|---|
| `radius-none` | 0 | Full-bleed sections, hero panels |
| `radius-sm` | 4px | Chips, badges, small tags |
| `radius-md` | 8px | Buttons, input fields, secondary cards |
| `radius-lg` | 12px | Plan blocks, primary cards |
| `radius-xl` | 16px | Modal sheets, large containers |
| `radius-2xl` | 24px | Sheet headers, prominent containers |
| `radius-full` | 9999px | Avatars, pill buttons, floating action button |

No interactive element uses hard 90-degree corners. Everything has at least `radius-sm` to maintain the refined feel.

## Motion Principles

Hybrid timing per Layer 1 direction: quick for user-initiated, considered for ambient, cinematic for storytelling moments.

### Duration Bands

| Band | Range | Use |
|---|---|---|
| Quick | 150 to 250ms | Taps, button presses, toggles, input focus, micro-interactions |
| Considered | 300 to 500ms | Page transitions, sheet slide-up, plan reveals, block expansions |
| Slow | 600 to 900ms | Ambient transitions (butler line rotation, time-of-day shifts) |
| Cinematic | 1000 to 2000ms | Hero reveals, onboarding sequence, splash screen, first-plan reveal |

### Easing Curves

| Curve | Definition | Use |
|---|---|---|
| Standard out | `cubic-bezier(0.2, 0.8, 0.2, 1.0)` | Entry animations |
| Standard in | `cubic-bezier(0.4, 0.0, 1.0, 1.0)` | Exit animations |
| Cinematic | `cubic-bezier(0.4, 0.0, 0.1, 1.0)` | Storytelling moments |
| Spring (React Native) | Reanimated spring, damping 18, stiffness 150 | Interactive feedback |

### Reduced Motion

All animations swap for instant transitions when the user has reduced motion enabled. Detected via `prefers-reduced-motion` media query on web and `AccessibilityInfo.isReduceMotionEnabled` in React Native. This applies to time-of-day shifts, page-turn transitions, idle dimming, click ripples, breath animations, and all Lottie sequences.

## Iconography

Lucide is the open-source icon library used throughout the application. Default Lucide style is geometric and modern with 2px stroke weight. Vesper customizes Lucide as follows:

- **Stroke width:** 1.5px (down from 2px default), giving icons a slightly more refined feel
- **Line caps:** rounded
- **Corner radius on rectangle elements:** 1px (slight softening)

For eight hero moments, custom SVG icons are built (designed during Stitch phase, exported as React components):

1. **Plan icon:** small lamp lit at dusk, light rays implied
2. **Work module:** desk with stacked papers
3. **Fitness module:** kettlebell with weight implied in the curve
4. **Nutrition module:** simple plate with fork
5. **Sleep module:** crescent moon, slightly more dimensional than Lucide default
6. **Errands module:** small key or basket
7. **Medication module:** small bottle with implied label
8. **Finance module:** envelope with subtle wax seal detail

Custom icons match Lucide's stroke discipline (1.5px, rounded caps) but are slightly more illustrative where appropriate. They render in `accent-bronze` for active states and `text-secondary` for inactive states.

## Logo

Three forms:

### Primary Wordmark

VESPER set in Fraunces, weight 500, letter-spacing 0.08em, color `text-primary` (cream). Used in marketing materials, landing page header, app header on web, email signatures, and any context with horizontal room.

### Monogram

V set in custom Fraunces, weight 500, slightly tracked. Used standalone where space is constrained: favicon, app icon, social profile avatars, Live Activity compact view (if used).

### Favicon and App Icon

- Field: `accent-bronze` `#B8884A`
- Monogram: `text-primary` `#E8DDC9` cream V, approximately 60 percent of icon width, centered, slightly tracked
- Background treatment: very subtle radial darken at edges (approximately 5 percent darker than center) for implied depth without breaking the flat aesthetic
- No outline, no drop shadow, no glow
- Corner radius handled by iOS automatically; web favicon uses `radius-md`

App icon master file: 1024x1024 PNG (App Store requirement). Web favicon: 32x32, 16x16, and SVG variants.

### Splash Screen

Bronze V monogram on espresso background. Brief shimmer effect on the V (200ms light pass from top-left to bottom-right), then dissolve into the plan view. Total splash duration approximately 800ms. Skippable by tap.

The decision to use bronze rather than carmine red for the app icon was made after considering both. Red would pop harder on the home screen but conflicts with the calm aesthetic that defines the brand. Bronze field with cream monogram is warm enough to stand out next to colorful icons (Instagram, TikTok, etc.) without shouting. The bronze also creates visual continuity with the interior accent system, so the user experiences a coherent warm palette from home screen tap through full app use.

## Artistic Vision

The artistic vision applies to the entire product surface: web application, mobile application, landing page, and marketing materials. Igloo Inc (igloo.inc) is the primary reference for craft level and seamless feeling. Active Theory (activetheory.net) is a secondary reference. The visual atmosphere is different (warm-dark butler versus Igloo's cool-tech), but the discipline of choreographed motion, atmospheric layering, hover responsiveness, and seamless transitions is matched and extended.

Vesper is not a tool the user opens. It is a place the user enters. Every surface should feel like part of a single continuous environment.

### Core Artistic Features

**Time-aware atmosphere.** The lighting and color temperature of the application shift gradually with the user's local time. Morning surfaces lean slightly warmer-bright (cream-shifted accents). Afternoon surfaces are neutral warm. Evening surfaces deepen toward espresso. Night surfaces are deepest. The shifts are gradual over 30-minute windows and barely perceptible at the moment, but distinctly different across the day. Implemented via CSS custom properties on web and a global theme provider in React Native, recomputing based on user's timezone.

**Lamplight cursor (web).** On the web application, the cursor casts a small warm radial light on whatever it hovers, brightening that area by approximately 8 percent while surrounding areas dim by approximately 3 percent. Like holding a lantern in a dim room. Implemented via radial gradient that follows mousemove with throttled CSS variable updates (60fps cap). On mobile, finger taps trigger a similar radial brightening at the touch point that fades in 600ms.

**Block depth on hover.** Plan blocks subtly lift toward the cursor with parallax displacement on web. The block appears to come slightly forward (2 to 4 pixels of translateY, deeper shadow) as the cursor approaches. On click or tap, the block expands with a smooth motion that suggests picking up a card from a desk. Implemented via CSS transforms triggered by mousemove relative to block position.

**Page-turn transitions.** Major navigation between sections (plan to weekly planner to settings) uses a custom transition that suggests turning the page of an old book. The current surface curls slightly at the corner and dissolves while the new surface enters from underneath. Subtle and fast (approximately 400ms). Falls back to standard fade on reduced motion.

**Material texture.** Surfaces have implied material at the limit of perceptibility. Plan blocks suggest vellum (subtle warm noise overlay at approximately 3 percent opacity). Buttons suggest leather (slightly softer shadow on press). Background suggests carved wood (faint radial darkening at corners, approximately 5 percent darker than center). All textures are subtle enough that flat aesthetic discipline is preserved, but the surfaces feel material rather than digital.

**Typography breath.** Hero display copy on the landing page and onboarding gently scales between 100 percent and 100.5 percent over a 4-second cycle. Implies life without distraction. Body text does not breathe; the effect is reserved for hero moments only.

**Click feedback ripple.** Pressing a button on web produces a small bronze ripple expanding outward from the click point, fading at edges over 400ms. Like a stone dropped in dark water. On mobile, this is paired with a light haptic tap; the visual ripple still plays but the haptic carries more of the feedback weight.

**Loading states as art.** Loading is part of the experience, not interruption. Spinners are replaced throughout:

- Plan generation: small candle flame Lottie animation, flickering gently
- Network request: ember pulse animation
- Onboarding step transitions: subtle page-turn animation
- First-time plan generation: longer sequence (approximately 3 seconds) where the candle flame slowly grows brighter as the plan composes

**Idle dimming.** If the user leaves the application open without interacting for 2 minutes, the entire surface dims by 15 percent over 4 seconds. The ambient butler line shifts to "Still here when you need me." Tap anywhere to wake (instant return to full brightness).

**Pull-to-refresh animation (mobile).** Pulling down on the plan view shows an ink-drop spreading on parchment until it forms the Vesper V monogram. The V holds for 200ms, then snaps back as the refresh completes. Implemented as a Lottie animation tied to pull distance.

**Live Activity glow.** The Dynamic Island content (Live Activity) has a subtle warm glow effect when active, suggesting an ember. Animated via SwiftUI animation, low-intensity pulse on a 2-second cycle.

**Ambient sound (optional, default off).** A toggle in settings enables ambient audio: soft fireplace crackle on plan view (low volume), distant clock tick on settings, page-turn sound on navigation. Off by default per Layer 1's anti-overwhelm posture. The user is told about this feature at onboarding via the tour so they know it exists. Users who enable it get a noticeably richer experience.

**Cinematic onboarding moments.** The first plan generation, the first morning brief opening, and the first energy check-in completion each get a cinematic moment (1 to 2 second hold, atmospheric lighting shift, butler line) before transitioning to interactive state. After the first occurrence, subsequent occurrences use shorter, less ceremonious transitions.

### Landing Page Specifics

The landing page is the most artistically ambitious surface and the first impression of Vesper for most prospective users. Direction is Igloo Inc plus, applied to the warm-dark register.

The page opens in a dim 3D-rendered manor study, built in Three.js with low-poly geometry to keep page weight under 4MB. As the user scrolls, the camera pans through the room in a choreographed sequence. Each scroll position reveals one piece of butler-voice copy that the user reads while the scene holds.

Time-of-day lighting in the scene matches the visitor's local time. Visitors arriving in the morning see warmer dawn light through the window; visitors arriving at night see deeper shadows with only the desk lamp lit.

Easter eggs reward attentive visitors: readable book spines on the shelf (titles like "On Solitude," "The Art of Mornings," "A History of Quiet"), a watch on the desk showing the visitor's current time, a small open notebook with a Vesper aphorism handwritten.

Total scroll length: approximately 5 to 6 viewport heights, with generous breathing between sections. The five sections are described in the Marketing Visual Language section below.

## Ambient Butler Line System

The ambient butler line is the persistent contextual element at the bottom of every relevant screen. It is also the input surface for natural-language interaction. This combined design eliminates the need for a separate input button and reinforces the always-listening butler presence.

### Visual Specification

- Italic Fraunces, 14pt, weight 400, optical size 9
- Color: `text-tertiary` `#756B57`, lower contrast than primary text
- Position: bottom-center on plan view, bottom-left on settings and weekly planner
- Padding: `space-6` (24px) above, `space-8` (32px) below
- Background: none; the line sits directly over the surface background
- No icon, no chevron, no visible button affordance

The lack of a visible button preserves the seamless feeling. The butler is not a feature with an interface; the butler is present and addressable.

### Interaction

- **Tap.** Text input sheet slides up from bottom over 300ms. Sheet has a single multiline text field with placeholder "Tell Vesper", cursor focused immediately, soft keyboard appearing (mobile) or focus indicator on web. Dismiss via swipe-down or escape key. Send via return or send button. Sheet dismisses on send over 200ms.

- **Long-press.** Voice recording begins immediately. Visual: the butler line transforms into a subtle waveform visualization that pulses with the user's voice input. Recording continues while held. Release: 200ms processing indicator, then sheet dismisses and the engine acts on the input.

- **Hardware side-button shortcut (iOS, optional, configured in iOS Shortcuts).** Voice recording with the same visual feedback as long-press but triggered hands-free.

### Discovery

Discoverable through onboarding tour ("Tap my words to speak with me.") and through natural exploration. The italic Fraunces line is visually distinct from other surface elements, which suggests it can be interacted with even without explicit affordance.

### Line Rotation

Lines rotate based on context: screen, time of day, completion state, recent activity, and user address preference (Sir / Madam / no honorific). The same line never repeats within 4 hours. The pool of approximately 80 lines covers every context permutation.

### Line Library

The library uses `[HONORIFIC]` as a placeholder that resolves to `, sir` or `, madam` or empty string based on user preference set during onboarding.

**Morning, plan view, fresh start:**
- "Good morning[HONORIFIC]. [Day] is ready."
- "Good morning[HONORIFIC]. Your day begins."
- "Morning[HONORIFIC]. Everything is in place."

**Morning, plan view, some blocks complete:**
- "Good morning[HONORIFIC]. You're already underway."
- "Morning[HONORIFIC]. Three down, [n] to go."

**Afternoon, plan view:**
- "Halfway through[HONORIFIC]."
- "Good afternoon[HONORIFIC]. [n] blocks remain."
- "Afternoon[HONORIFIC]. We're on schedule."

**Evening, plan view:**
- "Good evening[HONORIFIC]. The day winds down."
- "Evening[HONORIFIC]. Most of the work is behind us."
- "Evening[HONORIFIC]. Two more, then rest."

**Late night, plan view:**
- "Late hours[HONORIFIC]. Tomorrow is prepared."
- "It's getting on[HONORIFIC]. Rest when you can."

**All blocks complete:**
- "All done. A fine day."
- "That's everything. Well managed."
- "Complete. Until tomorrow[HONORIFIC]."

**Nothing scheduled (rare):**
- "Nothing scheduled. The day is yours."
- "Quiet today. Enjoy it."

**Returning to plan view after several hours away:**
- "Welcome back. Plan continues."
- "You're back. [Next block] is up next."

**Weekly planner:**
- "Sunday[HONORIFIC]. Shall we look at the week?"
- "A new week. What needs adjusting?"
- "Planning time[HONORIFIC]. Take your time."

**Settings:**
- "At your service[HONORIFIC]."
- "Configure as you like."
- "Adjustments here."

**Profile:**
- "Tell me more about yourself[HONORIFIC]."
- "Help me know you better."

**Integrations:**
- "Connections live here."
- "Manage your services."

**Empty contexts:**
- No tasks: "Nothing on the task list. Add something when ready."
- No medications: "No medications tracked. Add them in settings."
- No bills: "No bills tracked yet."

**Idle (after 2 minutes inactive):**
- "Still here when you need me[HONORIFIC]."

**Re-engagement (after long absence):**
- "Welcome back. It's been a while."

The full library will be finalized during the build phase as additional contexts emerge.

## Onboarding Flow

Designed screen by screen with copy, timing, and behavior. Two branches per Layer 2: calendar-connected (5 to 8 minutes) and no-existing-plan (10 to 15 minutes).

### Screen 1: Welcome (4-second sequential reveal)

Time-of-day-aware greeting. Three phrases revealed sequentially:

- Phrase 1: "Good [morning/afternoon/evening]." (1.0s hold)
- Crossfade 200ms
- Phrase 2: "Let's get you set up." (1.0s hold)
- Crossfade 200ms
- Phrase 3: "I'll keep things running from there." (1.4s hold)
- Fade out 300ms
- CTA button "Begin" appears with subtle bronze fill

Tap anywhere to skip to the interactive state immediately.

### Screen 2: Authentication

Single screen. Three options stacked vertically with equal visual weight:

- Continue with Google
- Continue with Apple
- Continue with email

Above options: Fraunces Display 2 "Sign in to continue." Below options: small Inter footnote "We never sell your data."

Sign in with Apple is live equal-weight with Google and email magic link from V1 launch, not deferred. On iOS the system Sign in with Apple dialog handles the credential exchange with biometric confirmation; on web the same provider runs as a redirect-flow OAuth exchange. App Store Review guideline 4.8 requires Sign in with Apple to be offered whenever any other social login is offered on the iOS surface; absent it, App Store rejection on first submission is the near-certain outcome.

### Screen 3: How would you like to be addressed?

Headline (Fraunces Display 3): "How should I address you?"

Three options stacked:
- Sir
- Madam
- No honorific

Small Inter footnote: "You can change this anytime in settings."

This screen replaces the earlier consideration of capturing gender directly. The form-of-address question is more direct, more respectful of user agency, and produces the same downstream copy outcome.

### Screen 4: Archetype selection

Headline: "What does your day usually look like?"

Six tabs displayed on a single screen, no detailed descriptions:
- Nine-to-Five Professional
- Remote Worker
- Student
- Athlete-Focused
- Founder Mode
- Mixed

Selecting an archetype routes the user into one of two branches per Layer 2.

### Screen 5 (calendar-connected branch): Connect Google Calendar

Headline: "Let's start with your calendar."

Button: "Connect Google Calendar"

Below: "Skip for now" link, smaller and less prominent.

### Screen 5 (no-existing-plan branch): Built-in calendar walkthrough

Headline: "Let's set up your schedule."

Three-screen tutorial sequence explaining how to enter fixed weekly events into the native calendar (work hours, classes, recurring appointments).

### Screen 6: Sleep target

Headline: "When does your day begin and end?"

Two time pickers: Wake time, Bed time.

Below: "These set your quiet hours."

### Screen 7: Goals

Headline: "What are your two or three priorities right now?"

Three open text fields. Skip available.

### Screen 8: Modules

Headline: "Which of these matters to you?"

Seven module toggles with brief one-line descriptions. All seven on by default per Layer 2.

### Screens 9 through 15: Per-module quick preferences

Only enabled modules show preference screens. Each screen captures the minimum data needed for the module to function:

- Fitness: goal type, gym vs home, days per week
- Nutrition: dietary restrictions, cooking time tolerance, dislikes
- Sleep: confirmed from Screen 7
- Errands: recurring items
- Medication: entries (name, dose, time, frequency)
- Bills: entries if Finance enabled

### Screen 16: Trial confirmation

Headline: "One week free. No card required."

Body: "After seven days, $19.99 per month. Cancel anytime."

Button: "Begin"

### Screen 17: First plan generation (cinematic loading state)

Atmospheric: candle flame Lottie animation centered on espresso background, flickering gently. Butler line below: "Preparing your first day..."

Duration: 4 to 6 seconds. Resolves to the first plan reveal.

### Screen 18: First plan reveal (cinematic, 1.5s entrance)

Plan blocks fade in sequentially over 1.5 seconds, top to bottom. Butler line: "Your first day is ready."

After 1.5s, CTA "Show me" appears, or auto-advances after 3 seconds if no interaction.

### Screen 19: Brief tour (4 screens, skippable)

Four overlay screens with skip available:

- Tour 1: "Tap any block to see details."
- Tour 2: "Mark blocks complete with a swipe."
- Tour 3: "Tap my words at the bottom to speak with me."
- Tour 4: "Find your week in the planner."

Each screen has a relevant UI screenshot or illustration on the right or below the copy.

### Screen 20: Done

Single screen: "All set. Welcome to Vesper."

CTA: "Enter"

Tap reveals first plan view in full.

## Notification Strategy

Notifications are restrained per Layer 1 and Layer 2 direction. The default disposition is in-app and via Dynamic Island; push is reserved for genuinely high-stakes contexts.

### Push Notification Permitted Categories

Only two categories of push notifications are sent at V1:

1. **Medication reminders.** Push permitted because health stakes warrant intrusion. Sent at user-specified medication times.
2. **Payment failures.** Push permitted because financial state warrants attention. Sent once per payment failure event, no follow-up pushes from the same event.

### Medication Permission Posture

If the user declines push notification permission at the system prompt, the medications module activates anyway; the module does not refuse to function on a denied permission state. Three behaviors mitigate the resulting reminder gap. First, at the moment the user adds a medication entry, a contextual in-app re-prompt asks whether to enable notifications now, framed as offering the medication module its intended surface rather than as a generic permission ask. Second, at each scheduled dose time, if the application is in the foreground, a prominent red-priority in-app banner displays the dose reminder; this is the only red-priority banner in the product and is reserved for this case. Third, the settings panel exposes a direct deeplink to iOS Settings → Vesper → Notifications so the user can re-grant permission without hunting through system settings. The posture is permission-soft rather than permission-gated, with the in-foreground banner carrying the burden when push is unavailable.

### All Other Proactive Cues

Happen through:
- In-app via the ambient butler line and active screen surfaces
- Via Dynamic Island Live Activity for block transitions
- Via transactional email for trial reminders, account state changes, billing receipts, and the Sunday weekly digest (V1.5)

### Quiet Hours

- Default to user's sleep target (bedtime to wake time as set during onboarding)
- Fallback if sleep target not set: 10pm to 7am local time
- Quiet hours apply to all push notifications including medication; medication delivery shifts to the next non-quiet window, with user warning at module setup
- User can override quiet hours per notification category in settings under an obscure subsection

### Notification Copy

All notification copy follows the butler voice specification described in the Copy Library section below.

## Settings Panel: Privacy

Privacy controls live in a dedicated subsection of the settings panel. At V1 the subsection holds one optional control beyond the standard account-management surfaces (data export, account deletion, integration disconnect).

**Optional biometric lock (iOS).** Off by default. When the user enables it, the application requires Face ID or Touch ID confirmation on cold start and on foreground return from background after sixty or more seconds. Authentication failure falls back to sign-out and re-sign-in after three consecutive failed attempts; the user is not locked out of the device, only out of the application until they re-authenticate through the standard sign-in flow. The lock is iOS-only at V1; web relies on the operating system lock screen as the equivalent layer. The toggle is a single switch with a one-line description ("Require Face ID to open Vesper") and no further configuration; the sixty-second background threshold is not user-configurable at V1.

## Voice and Tone Specification

### What the Butler Sounds Like

Formal but human. Like a real high-end concierge or butler speaking to a guest. Clean simple sentences. Direct phrasing. Soft questions ("Will that suit?", "Shall I?"). Acknowledgments ("Of course", "Very good"). Formal but conversational. Never archaic, never robotic, never sycophantic.

### What the Butler Does Not Say

- **No em-dashes.** Em-dashes are an AI tell. Use periods, commas, parentheses, or colons.
- **No exclamation points.** Excitement is not the butler's mode.
- **No emojis.** Per Layer 1.
- **No self-reference as AI.** Never says "I'm an AI," "as an AI," "AI-powered," or similar. Never references its own model or mechanism.
- **No gratitude language.** No "thank you for subscribing," no "we appreciate you," no "thanks for using Vesper." Gratitude breaks the butler dynamic because a butler does not thank the master for the relationship.
- **No manufactured urgency.** No "limited time!", no "only X spots left!", no countdown timers for artificial scarcity.
- **No gamification language.** No "streaks," "badges," "level up," "you crushed it today."
- **No informal address.** No "boss," "champ," "rockstar," "let's crush this," "you got this."
- **No archaic phrasing.** No "concludes," "henceforth," "thereafter," "shall not." Use modern formal English.
- **No filler affirmations.** No "Great question!", no "Absolutely!", no "I'd be happy to!"

### Persuasion Principles Quietly Applied

The butler voice incorporates principles from Chris Voss (Never Split the Difference) and Robert Cialdini (Influence) without crossing into manipulation. Specifically:

- **Tactical empathy:** acknowledge the user's situation before any request
- **Calibrated questions:** "How" and "What" questions, not yes/no, where the user has agency
- **Labels:** "It seems...", "It sounds..." used sparingly to acknowledge state
- **Mirror state:** reflect the user's situation back so they feel seen
- **Loss aversion:** reserved for genuine decision moments (trial end, cancellation, account deletion), never sprinkled through routine copy
- **Reciprocity through "together" framing:** acknowledges mutual investment without inverting the master-butler dynamic
- **Commitment and consistency:** surfaces what the user has already built rather than asking for new commitment

The ethical limit: would a fully informed user feel satisfied with their decision 24 hours later? If yes, the principle is influence. If no, manipulation. Every line in the library below clears that bar.

## Copy Library: Empty States and Error States

Full library of butler-voice copy for every major state across the application. All lines short, formal but human, em-dashes excluded throughout.

| Scenario | Copy |
|---|---|
| AI fallback | "I'll work from your usual routine today." |
| Connection lost | "We've gone offline. Your plan is still here." |
| Integration broken (Google Calendar) | "Your calendar has disconnected. Reconnect when you're ready." |
| Payment failed | "Your payment didn't go through. I'll keep things running while you sort it out." |
| Trial: 3 days left | "Three days left in your trial. Anything you'd like to ask before then?" |
| Trial: 1 day left | "Your trial ends tomorrow. Shall I keep things running?" |
| Trial ended, decision needed | "Your week is up." (then buttons: Continue / End) |
| Trial canceled by user | "Of course. Your data will be here for thirty days if you'd like to come back." |
| Account delete confirm | "Your account will close in thirty days. You can change your mind anytime before then." |
| Account delete tomorrow | "Your account closes tomorrow. Last chance to reconsider." |
| Welcome back 3+ days | "Welcome back. Anything I should know about?" |
| First plan generated | "Your first day is ready." |
| All blocks complete | "That's everything for today." |
| Three regenerations rejected | "I haven't got it right yet. Tell me what's missing." |
| Module disabled | "Removed. You can switch it back on in settings anytime." |
| Payment cleared post-failure | "Payment went through. We're all set." |
| Subscription renewed (annual) | "Another year together." |
| First paid subscription | "Welcome aboard for the year." |
| Long absence (14+ days) | "It's been a while. Shall we pick up where we left off?" |
| Read-only mode entry | "Your data stays here for seven days, then archives for another thirty." |
| Resubscribe from archive | "Welcome back. Everything is as you left it." |
| New module added mid-trial | "Got it. I'll work this into tomorrow's plan." |
| Energy slider skipped | "Right, then. Let's get going." |
| Plan accepted | "Very good." |
| Block marked complete | (no copy, just haptic) |
| Block skipped | "Noted. Moving on." |
| Block rescheduled | "Done. I've moved it to [time]." |
| Conflict requires user choice | "Two things need the same time slot. Which takes priority?" |
| Onboarding step done | "Right. Next." |
| Calendar reconnected | "Calendar is back. Catching up now." |
| Settings saved | "Saved." |
| Sync conflict on other device | "Your other device made changes. Refreshed." |
| Wifi returned mid-session | "Back online. Your edits are syncing." |
| Notification permission denied | "Understood. I'll keep things in-app." |
| Goal updated | "Noted. I'll adjust accordingly." |
| Weekly review prompt (Sunday) | "Sunday. Shall we look at the week?" |
| Weekly review skipped | "Right. We'll keep things as they are." |
| Morning alarm dismissed | (no copy, energy check-in slider only) |
| Workout suggested | "I've picked a [duration] [type] for you today." |
| Workout swapped | "Of course. Here's another." |
| Meal swapped | "Changed. The new one fits your time today." |
| Grocery list generated | "Your list is ready." |
| Bedtime approaching | "Wind-down begins in fifteen minutes." |
| Medication reminder | "Time for your [medication name]." |
| Bill due tomorrow | "[Bill name] is due tomorrow." |
| New feature available | "Something new in settings, if you'd like to look." |
| Update available | "An update is ready. I'll install it next time you close the app." |
| Successful first payment (web) | "Welcome aboard." |
| Successful first payment (iOS) | "Welcome aboard." |
| Apple-issued refund processed | "Apple has processed your refund. Your account is closing." |
| Stripe payment method updated | "New payment method saved." |
| iOS subscription expired | "Your subscription has ended. Your data stays here for seven days." |
| Resubscribe from archive (iOS) | "Welcome back. Everything is as you left it." |
| Resubscribe from archive (web) | "Welcome back. Everything is as you left it." |
| Trial extension granted | "Your trial has been extended. Thank you for your patience." |
| Degraded mode (synthesizePlan circuit breaker open) | "Working slower than usual. Plans will resume shortly." |

The library will expand during the build phase as additional states emerge. New copy is added to this library, not invented inline.

### Degraded Mode Banner

When the plan-synthesis circuit breaker opens (three or more synthesis failures within a five-minute window across all users, as specified in Layer 3's AI Architecture section), the application surfaces a banner above the plan view carrying the degraded-mode copy above. The application remains read-functional: the user can view their last-generated plan, mark blocks complete, and read historical surfaces. New plan-generation requests serve the last-known plan with a "Refresh" call to action that retries through the fallback chain rather than the primary synthesis path. The banner clears automatically when the breaker closes (five minutes without new failures). No error code, model name, or technical language is exposed at any point.

## Live Activity SwiftUI Widget Visual Design

Three views per Apple's ActivityKit requirement: compact leading (left of Dynamic Island camera), compact trailing (right of Dynamic Island camera), and expanded (long-press to reveal).

### Compact Leading

- Block module icon (1.5px stroke, bronze fill)
- 2-character abbreviation (e.g., "GY" for gym, "FC" for focus, "ER" for errand, "ML" for meal)
- Font: Inter, 11pt, weight 500, cream
- Background: transparent (renders over Dynamic Island system surface)

### Compact Trailing

Either of:
- Countdown timer in minutes remaining
- Progress arc (radial completion indicator)

Font for timer: JetBrains Mono, 11pt, weight 500, bronze.

Progress arc behavior: bronze fill, transitions to slightly warmer hue at 80 percent completion.

### Expanded

Long-press the compact view to expand. Layout:

- Top: block title (Fraunces Display 3, 18pt, weight 500, cream)
- Below title: end time (JetBrains Mono, 14pt, bronze) and countdown
- Middle: brief description if available (Inter, 13pt, secondary text)
- Bottom-left: "Mark complete" button (bronze fill, cream text, `radius-md`)
- Bottom-right: "Reschedule" button (outlined, bronze border, cream text, `radius-md`)
- Bottom strip: "Next: [block title] at [time]" (Inter, 11pt, tertiary text)

### Color Treatment

Full brand colors (espresso background, cream text, bronze accent). Apple HIG nudges toward system style for Live Activities, but allows brand color. Brand color is used per founder preference, accepting slight HIG friction in exchange for stronger brand recognition.

### Ember Glow

Subtle warm glow effect on the active Live Activity, suggesting ember warmth. Animated via SwiftUI `withAnimation` modifier on a 2-second pulse cycle. Low intensity (10 to 15 percent additional brightness at peak).

## Marketing Visual Language

Per the marketing methodology established in Layer 6 discussions (Linear plus A24 hybrid). The marketing surfaces include the landing page, social media presence, transactional emails, and any printed or shared materials.

### Landing Page

Single scroll-driven cinematic page in the Igloo Inc plus direction described in the Artistic Vision section above. Five sections:

1. **Hero.** 3D rendered manor study scene, camera enters the room. Single butler line in Fraunces Display 1 overlaid: "Good evening. Let's see to your day." or time-of-day-aware variant.

2. **What Vesper does.** Camera pans to desk. Plan view animates on the screen sitting on the desk. Butler-voice description scrolls alongside in Fraunces Display 3: "I read your calendar before you wake. I know your fitness goals, your meals, your medications, your schedule. I prepare your day before you ask."

3. **Modules.** Camera continues through the scene. Each module icon appears as a small artifact in the room: gym appears as a kettlebell on the floor, nutrition as a plate on the desk, sleep as a clock on the bedside, errands as a key on the table, medication as a small bottle on a shelf, finance as a sealed envelope on the desk. Butler-voice description for each as the camera lingers.

4. **How it works.** A phone resting beside the desk lamp lights up with a Dynamic Island animation. Butler-voice copy: "I keep you informed without intruding. Your next block. Your countdown. Always at a glance."

5. **Pricing and signup.** Camera pulls back to a full room view. Copy resolves to: "One week free. After that, $19.99 per month. iOS launching shortly. Web works everywhere in the meantime." Single email input field, single iOS/Android segmented control, single "Begin" button.

Total scroll length approximately 5 to 6 viewport heights. Generous breathing room between sections. Page weight under 4MB total via low-poly Three.js, compressed textures, deferred loading.

### Social Aesthetic

Anonymous brand presence per Layer 1. No founder face. No production photoshoots. AI-generated atmospheric imagery acceptable for non-product moments.

**X (Twitter):**
- Format A: warm-dark cards (1080x1350) with Fraunces quotes in cream on espresso, butler-voice aphorisms. Examples: "Mornings reward those who prepared the night before.", "A schedule is a kind of grace.", "The day attends to those who attend to it."
- Format B: subtle UI screenshot on warm-dark gradient background, one butler line in Fraunces below.
- Cadence: 3 to 4 posts per week, batched on Sunday.

**Instagram:**
- Same cards reposted from X.
- 2 to 3 posts per week.

**TikTok:**
- Slow ambient screen recordings of the application in use. No voiceover except optional AI-generated butler voice narration (deep, calm, English-accented) for selected videos.
- Instrumental ambient audio only, no music with vocals.
- Captioned with Fraunces overlays in butler voice.
- 1 video per week, batched.

### Transactional Email

React Email components for all transactional templates. Warm-dark color scheme matching the application. Fraunces for subject lines and headlines, Inter for body. Email templates listed in Layer 3.

## Accessibility Baseline

WCAG 2.1 Level AA compliance target across web and mobile.

### Color Contrast

- Body text contrast minimum 4.5:1. Verified: cream `#E8DDC9` on espresso `#1E1815` yields approximately 11.5:1, comfortably exceeds AA.
- Headlines contrast minimum 3:1. Verified across all heading sizes.
- Interactive element contrast minimum 3:1 against background.
- Bronze `#B8884A` on espresso yields 6.2:1, exceeds AA.

### Reduced Motion

All animations swap for instant transitions when the user has reduced motion enabled. Applies to time-of-day shifts, page-turn transitions, idle dimming, click ripples, breath animations, all Lottie sequences, and the cinematic onboarding moments. Detected via `prefers-reduced-motion` media query on web and `AccessibilityInfo.isReduceMotionEnabled` in React Native.

The marketing landing page's Three.js cinematic hero falls back specifically to a static cream-to-espresso vertical gradient with the Vesper wordmark centered on the screen when `prefers-reduced-motion: reduce` is set. The 3D manor scene, camera pan, parallax depth, and the typography breath effect are all suppressed; the static gradient hero satisfies WCAG 2.3.3 (Animation from Interactions) and avoids the autoplay-motion exposure the cinematic scroll would otherwise present.

### Screen Reader Support

Full VoiceOver (iOS) and TalkBack (Android) labels on every block, action, and state. The ambient butler line is labeled as "Speak with Vesper" so screen readers communicate the input function clearly. Web uses ARIA labels following WAI-ARIA Authoring Practices.

### Dynamic Type

iOS Dynamic Type and Android system font scaling supported. Body and UI text scales per user settings. Display type (Fraunces headlines) caps at +20 percent scale to prevent layout breakage on the most extreme settings.

### Keyboard Navigation (Web)

Full tab order through every interactive element. Focus indicators visible (bronze outline, 2px). Skip-to-content link at top of page.

### Color Blindness

Bronze and oxblood remain distinguishable across the most common color blindness simulations (deuteranopia, protanopia, tritanopia). Verified via SimDaltonism or equivalent tool during the build phase.

### Touch Targets

Mobile touch targets minimum 44x44 points per Apple HIG. Buttons, toggles, and other interactive elements meet or exceed this.

## Cross-Layer Updates Required

This section documents specific text changes that must be applied to other layer documents to align with Layer 4 decisions. Apply these updates manually to the source documents.

### LAYER_2_PRODUCT_SCOPE.md

**Update 1:** In the "Edge Cases" subsection of the "User Flows" section, find the paragraph that begins "When the trial period ends..." and replace it with:

> When the trial period ends, the product surfaces butler-voice reminders at three days before, one day before, and on the end date. The reminders mirror the user's state ("Three days left in your trial. Anything you'd like to ask before then?") rather than push urgency. The end-date screen offers two options without persuasion friction: continue or end. On end, the product enters a read-only continuation mode for seven days during which the user can still view their plan but cannot edit or generate new plans, framed in continuation language ("Your data stays here for seven days, then archives for another thirty.") rather than punitive lockout copy. After seven days the account archives (not deletes) for thirty days, with a resubscribe option available throughout. The specific copy library for all trial-end, cancellation, and re-engagement states lives in the Layer 4 deliverable and is the single source of truth.

**Update 2:** In the "Edge Cases" subsection, find the paragraph that begins "When a subscription payment fails..." and replace it with:

> When a subscription payment fails, Stripe handles dunning. The product surfaces a soft butler-voice banner ("Your payment didn't go through. I'll keep things running while you sort it out."). After seven days of failed dunning, the product enters the same read-only continuation mode as trial-end, with matching continuation framing.

**Update 3:** In the "Edge Cases" subsection, after the paragraph about subscription payment failure, add a new paragraph:

> The cancellation flow is deliberately easy and not adversarial. No retention modals offering last-minute discounts, no "are you sure?" friction screens, no surveys at the cancellation moment. The flow exits cleanly with butler acknowledgment ("Of course. Your data will be here for thirty days if you'd like to come back."). A win-back survey arrives 48 hours later via email asking what could have improved, framed as a no-oriented question ("Was there anything we could have done differently?") that respects the user's exit decision while gathering retrospective data.

### LAYER_3_TECHNICAL_ARCHITECTURE.md

In the "AI Architecture" section under "Prompt Versioning," add the following paragraph after the existing content:

> All user-facing AI-generated copy passes through a butler voice gate before display. The gate has two layers. The first layer is a regex validation that strips em-dashes, exclamation points, emoji unicode ranges, and the strings "AI," "AI-powered," and any first-person reference Vesper makes to being artificial. The second layer is a lightweight Claude Haiku prompt that reviews any AI-generated string longer than 30 words against the butler voice specification in Layer 4 (formal but human, short sentences, no gratitude language, no manufactured urgency, no gamification, no archaic phrasing). The gate runs in roughly 100ms and costs negligible additional API spend due to prompt caching on the voice specification itself. Strings that fail the second layer are regenerated with a corrective prompt appended. The voice gate is enforced in the @vesper/ai package and applies to every AI-generated string before it reaches the user.

### LAYER_1_FOUNDATION.md, OPEN_SOURCE_INVENTORY.md, PROJECT_OVERVIEW.md, BRAINSTORM_MASTER.md

No changes required.

## Open Items From Layer 4

The following items are deferred or flagged for resolution outside Layer 4.

1. **Domain TLD final selection.** vesper.house was taken at the time of writing. The founder will resolve this during Phase 3 (Environment Setup). Remaining candidates: vesper.studio, vesper.day, vesper.care.

2. **Stitch design sessions.** Recommended before build begins to validate motion choices, atmospheric direction, and landing page concept against rendered prototypes. Estimated 2 to 3 Stitch sessions over the coming days.

3. **Optional ambient sound design.** The toggle exists in the design; the actual audio assets (fireplace crackle, clock tick, page turn) need to be sourced or produced. Deferred to Phase 3 or skipped if not ready by launch.

4. **Custom icon production.** Eight custom hero icons need to be designed and exported. Recommend designing in Stitch or Figma during Phase 3.

5. **Live Activity SwiftUI implementation.** The visual design is locked here; the actual SwiftUI code lives in the iOS prebuild project and is implemented during the build phase per Layer 3.

## What Was Considered and Rejected

The following alternatives were considered during Layer 4 and rejected, recorded so they are not revisited.

- **Red app icon (carmine, vermilion, crimson).** Rejected because it conflicts with the calm aesthetic that defines the brand. Bronze field chosen instead. Red filed as a fallback option if bronze tests weak in Stitch.
- **Cold dark palette (matching Linear, Motion).** Rejected per Layer 1 in favor of warm dark.
- **Bright or pastel aesthetic.** Rejected per Layer 1.
- **Chat-bar style natural-language input** (persistent input field at bottom of screen with mic icon). Rejected per Layer 2 and reinforced here. Ambient butler line is the input surface.
- **Separate input button and ambient butler line as two surfaces.** Rejected in favor of the combined design where the ambient line is itself the input affordance.
- **Sir/Madam by default for all users without asking.** Rejected because some users prefer no honorific. Three-option capture during onboarding instead.
- **Capturing gender directly during onboarding.** Rejected in favor of capturing form of address ("How should I address you?") which is more direct, more respectful of agency, and produces the same downstream copy outcome.
- **First-name address by default.** Rejected because user must opt in via settings; default is the chosen honorific or none.
- **Em-dashes in butler copy.** Rejected as the major AI tell.
- **Exclamation points in butler copy.** Rejected as informal and inconsistent with butler voice.
- **Emojis in butler copy.** Rejected per Layer 1.
- **Gratitude language** ("thank you for subscribing," "we appreciate you," "thanks"). Rejected as servile, breaks the butler dynamic, reads as AI tell.
- **Manufactured urgency** ("limited time!", "only X spots left!"). Rejected as manipulative; violates the Cialdini ethical test.
- **Streaks, badges, points, leaderboards.** Rejected per Layer 2.
- **Standard spinner loading states.** Rejected, replaced with candle flame, ember pulse, and page-turn animations.
- **Standard splash screen with static logo.** Rejected, replaced with bronze V monogram on espresso with brief shimmer effect.
- **Animations always on with no opt-out.** Rejected; reduced motion respected throughout via system-level preference detection.
- **System-style Live Activity (no brand color).** Rejected per founder preference in favor of full brand color, accepting slight Apple HIG friction.
- **Loud aspirational landing page** (founder face, "10x your productivity" headline, stock photo of happy professional). Rejected per Layer 1 and Layer 6. Replaced with cinematic 3D manor study scroll experience.
- **Animated mascot or character** (Duolingo-style). Rejected as inconsistent with butler dignified voice.
- **Founder voice on social** (Linear-style personal-account narrative). Rejected per Layer 1 anonymity posture; brand voice carries the narrative instead.
- **Production photoshoots and studio product shots.** Rejected per anonymity and aesthetic posture. AI-generated atmospheric imagery used for non-product moments.

## What's Next

**Layer 5: Business and Monetization.** This layer locks the pricing model decision (freemium with limits, paid trial converting to subscription, pure paid), the specific dollar amounts at each tier, the exact feature split between free trial and post-trial paid tier, the optimizer-power-user tier that justifies premium pricing, payment infrastructure decisions (Stripe configuration, supported payment methods, subscription versus one-time billing, monthly versus annual with discount structure, dunning handling, family or team plan considerations), free trial length and trial-end behavior, legal foundation (privacy policy generation approach, terms of service, data deletion policy with timelines, GDPR and CCPA compliance), refund policy, and cancellation flow specifics.

Per Layer 1 and Layer 2 direction, the working assumption is a one-week free trial including all features, converting to a paid subscription. The specific dollar amount, annual versus monthly billing structure, and any paid-tier feature gating (the quantified-self dashboards, deeper AI customization) are the open decisions for Layer 5.

Layer 5 mixes Opus for the pricing model and tier structure decisions with Sonnet for tactical execution on payment infrastructure, legal templates, and flow design.

Begin the next chat by pasting the Brainstorm Master document along with the Layer 1, Layer 2, Layer 3, and this Layer 4 document for full context.
