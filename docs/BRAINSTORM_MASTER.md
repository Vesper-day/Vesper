# Brainstorm Master Document

## Purpose of This Document

This document is the context bootstrap for new conversations during the brainstorming phase of the project. When a fresh chat is started for the next brainstorming layer, this document should be pasted at the start of the conversation so the assistant immediately understands the project's scope, current status, communication preferences, and the depth of decisions already made. The full Layer 1 (and any subsequent completed layer) document should be pasted immediately after this one for complete context.

## Project Snapshot

**Working name:** deferred. The name is not locked at the time of this brainstorming phase. The product can be referred to by any placeholder during the build. Final name selection happens closer to Layer 4 or pre-launch. Direction for the eventual choice: dignified, multi-syllable, classically-rooted names (Latin, Greek, refined English) that align with the warm-dark butler aesthetic. Compound smashed-together names and short single-syllable invented words are explicitly rejected as patterns. Thematically-appropriate alternative TLDs (.life, .house, .care, .haus, .studio) are acceptable in place of forcing a compromised .com.

**Product category:** Personal AI life planner, available as both a web application and a mobile application.

**One-line pitch:** "It's the app that schedules your whole day for young professionals."

**Differentiator:** Life OS with adaptive planning. The product unifies work scheduling, fitness, nutrition, sleep, errands, medication, and finance into a single warm, butler-like daily output.

**Target user:** Young professionals (ages 22 to 32) as the primary audience, ambitious students as a secondary audience, and quantified-self optimizers as a paid power-user tier rather than a separate target.

**Voice and tone:** Modeled on Jarvis from Iron Man, framed as a butler rather than a chatbot. Warm, professional, calm, quietly competent. The voice never refers to itself as AI and never uses emojis or exclamation points.

**Brand mood:** Warm darkness, not cold darkness. References include dimly-lit libraries at dusk, hotel concierge desks after hours, old manor studies with modern function inside. Color direction (locked in Layer 4) is deep charcoal/espresso backgrounds, cream text, bronze/amber accents, avoiding stark white, neon blue, pastels, and farmhouse beige. Distinct from cold-dark productivity apps (Motion, Linear), bright productivity apps (Reclaim), and soft wellness apps (Headspace, Calm).

**Founder:** Solo student founder. Building with Claude Code on a Claude Max 5x subscription. No external investment. Operating anonymously until a major relevance milestone is reached. Living expenses covered by family during the build period.

## The Six-Layer Brainstorming Structure

The brainstorming phase is organized into six layers, sequenced because each layer's decisions feed into the next. Each layer produces a written deliverable document that subsequent layers reference. The intent of front-loading all this thinking is to prevent mid-build paralysis: once the brainstorming is done, the build phase becomes pure execution against a written specification.

### Layer 1: Foundation

The bedrock of every other decision. Locks who the product is for, what it stands for, what success looks like, and the brand's emotional center. This is the layer where foundational tradeoffs are made: which audience to design for, which features will never be built, which aesthetic direction to commit to, and what the realistic ambition track is. Decisions made here cascade into every other layer, which is why this layer alone uses the most expensive model (Opus) for thinking.

Specific decisions locked in Layer 1: primary target user profile, secondary audience, power-user paid tier audience, audiences explicitly not targeted, the one-line pitch, the primary positioning lens, secondary and paid-tier positioning lenses, voice and tone with reference models, brand mood and aesthetic direction (which functions as a strategic north star for Layer 4's execution), geographic launch scope, platform strategy with the split between mobile and web responsibilities, three-month success criteria framed as decision triggers, AI disclosure philosophy and the reasoning behind keeping AI invisible to the user, build-in-public versus stealth strategy with specific posting cadence guidance, founder identity strategy and reveal threshold direction, name selection criteria (with actual name selection deferred), and ambition track (indie scale, acquisition target, or VC-funded startup path).

Deliverable: `LAYER_1_FOUNDATION.md`.

### Layer 2: Product Scope

The biggest brainstorming session of the entire phase, where the abstract vision becomes a concrete feature list. This is where painful tradeoffs are made about what ships in V1 versus what waits. Without rigorous cuts here, the V1 build expands indefinitely and never ships. The goal is to identify the smallest possible set of features that still delivers the product's core promise.

Specific work in Layer 2: the complete unrestrained feature inventory across every domain the product touches (work scheduling, fitness, nutrition, errands, calendar integration, AI personalization, social features, analytics, notifications, integrations, onboarding, account management). From that inventory, hard cuts identify the four to seven features that ship in V1. Larger V2 and V3 roadmaps capture what's parked but planned. An explicit killed-features list documents what the project will never build (just as important as the V1 list). Primary user flows are mapped in detail: the onboarding journey for new users (multi-step setup, profile data collection, first daily plan generation), the daily journey for returning users (morning brief, mid-day check-in, evening review), and the weekly journey (planning sessions, retrospectives, goal updates). Edge case flows are also covered: what happens when users miss days, when plans go off-track, when integrations break, when the AI fails to generate a coherent plan.

Deliverable: `LAYER_2_PRODUCT_SCOPE.md`.

### Layer 3: Technical Architecture

The bridge between product decisions and actual code. Decisions made here are the hardest to change later, which is why this layer also uses Opus. A wrong tech stack choice or a poorly-designed database schema can cost months to refactor.

Specific work in Layer 3: tech stack selection with reasoning (likely Next.js for web, React Native for mobile, Supabase for database and authentication, Stripe for payments, but each choice is examined). Full database schema design including user profiles, daily plans, completion data, integration connections, subscription state, audit logs. Authentication strategy across web and mobile with social login support (Google, Apple, email). AI architecture specification in detail: which model handles plan generation and which handles lighter tasks, how user context is constructed and passed in (system prompt structure, user data injection, conversation history), prompt templates with versioning, fallback handling for AI errors, caching strategy for repeated requests, cost-per-user estimates. Complete integration list with priority and effort estimates: Google Calendar, Apple Calendar, Apple Health, Google Fit. Hosting and infrastructure choices (Vercel tiers, Supabase tiers, when paid plans get triggered). Data privacy and storage approach including what is encrypted at rest, what is purged on account deletion, what is logged for debugging, and GDPR/CCPA compliance basics.

Deliverable: `LAYER_3_TECHNICAL_ARCHITECTURE.md`.

### Layer 4: Experience and Identity

Translates the brand mood direction set in Layer 1 into concrete, implementable design decisions. This is the layer where the visual identity becomes specific enough to hand to Claude Code. The strategic direction is mostly Opus work; the token-level execution (specific hex codes, type scales, spacing values) can be Sonnet.

Specific work in Layer 4: complete design system tokenization with color tokens at specific hex values (executing against the warm-dark dusk-manor direction from Layer 1), typography selections with families, weights, and sizes, spacing scale, border radii, motion principles, iconography style. Branding direction refined and specified: logo concept and variations (primary, secondary, monochrome, favicon), marketing voice and tone in copy with do/don't examples, visual language for marketing materials (web hero patterns, social post templates, screenshot framing). Onboarding flow designed screen-by-screen including the data the app collects from users and how it is structured to feel welcoming rather than interrogative. Notification strategy with specific rules about timing windows, channel preferences, quiet hours, and a deliberately-restrained default. Empty states and error states designed for every major surface (no daily plan yet, integration broken, no internet, AI failed to generate). Accessibility baseline (target WCAG level, contrast minimums, screen reader support, motion-reduction support, keyboard navigation).

Deliverable: `LAYER_4_EXPERIENCE_IDENTITY.md`.

### Layer 5: Business and Monetization

Locks how the product makes money and stays legally protected. The pricing model decision is a high-stakes Opus moment; everything else in this layer is mostly tactical execution (Sonnet-appropriate).

Specific work in Layer 5: pricing model selection (freemium with limits, paid trial converting to subscription, pure paid). Pricing tier definitions with specific dollar amounts at each tier and exact feature splits between tiers, including the optimizer-power-user tier that justifies premium pricing. Payment infrastructure decisions: Stripe configuration, supported payment methods, subscription versus one-time billing, monthly versus annual with discount structure, handling of failed payments and dunning, family or team plan considerations. Free trial length and what happens at trial end (auto-charge versus convert-to-free). Legal foundation: privacy policy generation approach (template, Termly, custom), terms of service, data deletion policy with specific timelines, GDPR and CCPA compliance considerations (the bare minimum required for US launch with eventual expansion). Refund policy. Cancellation flow (deliberately easy, not adversarial).

Deliverable: `LAYER_5_BUSINESS_MONETIZATION.md`.

### Layer 6: Launch and Growth

The plan for getting from "built" to "in users' hands and making money." All decisions in this layer are tactical and reversible, so it's appropriate to use Sonnet throughout.

Specific work in Layer 6: pre-launch waitlist landing page strategy (what the page says, what it captures, how it converts). Launch channel mix designed and prioritized: Product Hunt strategy and ideal launch day, Reddit subreddits with seeding plan (productivity subreddits, biohacking subreddits, student subreddits), X and TikTok content cadence and themes with a Claude-driven generation pipeline; founder review approximately 30 minutes per week. Content and marketing angles that thread the needle of subtle AI positioning (talking about what the app does without leading with how). Pricing experiments planned for the first six months post-launch (price points to test, trial length variants, tier-definition variants). Analytics infrastructure (PostHog free tier or Vercel Analytics) and the specific metrics that matter: signups, activation (defined precisely), day-1, day-7, and day-30 retention, free-to-paid conversion rate, monthly recurring revenue, net revenue retention, churn reasons captured at cancellation. Founder content calendar with what gets posted where and when, including evergreen content versus reactive content.

Deliverable: `LAYER_6_LAUNCH_GROWTH.md`.

## Current Status

Layer 1 (Foundation) is complete. The dedicated `LAYER_1_FOUNDATION.md` document contains all locked decisions and remaining open items. Layer 2 (Product Scope) is the next session. Subsequent layers proceed in sequence after Layer 2.

## Model Selection By Layer

The Claude Max 5x plan gives shared 5-hour usage windows across Opus and Sonnet. Strategic model selection per layer:

- **Layer 1 (Foundation):** Opus. Foundational cascade.
- **Layer 2 (Product Scope):** Opus. Biggest decision layer.
- **Layer 3 (Technical Architecture):** Opus. Hard to change later.
- **Layer 4 (Experience and Identity):** Opus for direction and design philosophy. Sonnet for token-level execution.
- **Layer 5 (Business and Monetization):** Sonnet for most work. Opus moments for pricing model and tier structure decisions.
- **Layer 6 (Launch and Growth):** Sonnet throughout. All tactical and reversible.

For the coding phase that follows brainstorming: Sonnet handles roughly 90 percent of execution work. Opus is reserved for getting unstuck, major refactors, and the AI prompt design that powers the daily plan generation.

## How to Use This Document in a New Chat

1. Start the new chat.
2. Paste this entire document as the first message, with no other content.
3. After the assistant acknowledges, paste the most recent completed layer document (for example, `LAYER_1_FOUNDATION.md` when beginning Layer 2).
4. State which layer is starting next.
5. State communication preference (see below).
6. State model preference for the session (typically Opus for Layers 1-3, mixed for Layer 4, Sonnet for Layers 5-6).

## Communication Preferences

The founder prefers terse, compressed responses during brainstorming sessions to maximize signal density. The convention is:

- Drop articles such as "the" and "a" where the meaning remains clear
- Skip preamble, affirmations, and filler phrases
- Use compressed phrases rather than full sentences
- Lead with signal, never with throat-clearing

Formal deliverable documents like this one are written in complete prose for archival clarity. The terse style applies only to chat responses, not to documents intended as references. When asking the assistant to generate a deliverable document, the founder will explicitly say so, and the document itself will be written in proper prose.

## Founder Context Summary

Solo founder. Student. Living expenses covered, no investment needed. Building primarily with Claude Code on a Claude Max 5x plan ($100 per month, includes both Claude.ai and Claude Code in a unified subscription). Prefers anonymity until a major relevance milestone (revenue, press, or other significant signal). Hybrid stealth launch approach: anonymous brand presence on social media during build, face never shown, marketing voice matches the in-app butler tone.

## Why This Front-Loaded Approach

The brainstorming phase exists to prevent mid-build paralysis. By making all foundational, product, technical, design, and business decisions in advance, the build phase becomes pure execution. Claude Code can focus on implementation rather than asking decision-making questions, and the founder can focus on directing the build rather than discovering open questions on a feature-by-feature basis. Each layer document is designed to be self-contained enough that a new Claude conversation can pick up the work without needing to re-derive context.

The trade-off is real: front-loading takes three to four weeks before any code gets written. The alternative is a stop-and-restart pattern during the build that costs significantly more time. The math favors front-loading.
