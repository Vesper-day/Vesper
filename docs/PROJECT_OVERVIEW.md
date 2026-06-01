# Project Overview: AI-Powered Daily Life Planner

## What This Project Is

A web and mobile app that ingests a user's full context (work, fitness, nutrition, location, calendar) and generates a complete personalized daily plan. The target audience is young professionals (ages 22 to 32), with secondary appeal to ambitious students. The product positions itself as a "Life OS with adaptive planning" — a calm, butler-like AI assistant that schedules the entire day rather than acting as a cold scheduling tool.

The core differentiation: existing apps in this space (Motion, Reclaim, Morgen, Simplified, Tiimo) each cover only one slice of life, such as work scheduling, calendar management, or fitness and nutrition. No current competitor unifies all domains with a warm, anti-overwhelm user experience.

## Founder Context

Built by a single student founder using Claude Code as the primary development tool. There are no external code contributors planned at launch. The Claude Pro plan ($20 per month) provides Claude Code access with rate-limit windows that reset every 5 hours. Sessions are batched around these window resets so that high-intensity Claude Code work happens within the available capacity. Real-world usage data from comparable indie projects indicates this is sufficient for the full build without additional API spend, provided the founder structures work to respect the rate limits.

Living expenses are covered by family during the build, which means no external investment is required and no salary pressure exists during the runway to launch.

## Project Phases

### Phase 1: Brainstorming (Weeks 1 through 3)

Front-loaded thinking organized into six layers: Foundation, Product Scope, Technical Architecture, Experience and Identity, Business and Monetization, and Launch and Growth. Each layer produces a written deliverable document that feeds into the next phase. The intent of front-loading is so that the build phase becomes pure execution rather than a series of fresh decisions.

### Phase 2: Product Requirements Document and Technical Specification (Week 4)

Consolidate the six layer documents into a single Product Requirements Document (PRD) plus a separate technical specification. These two artifacts become the source of truth that Claude Code references throughout the build. Every coding session begins by loading the relevant section of the PRD as context.

### Phase 3: Environment Setup (Week 5)

Domain registration, hosting account setup (Vercel for web, Supabase for database and authentication), repository initialization, design system tokens, third-party API accounts (Stripe, Google OAuth, recipe APIs), and Claude Code configuration with project-specific context files. This phase is short but critical: time invested here saves significant friction later. Two paid items are intentionally deferred from Phase 3 to approximately Project Week 22 (start of Phase 5 internal alpha): the Apple Developer Program enrollment ($99/year) and the domain TLD purchase ($15-30 one-time). Both are gated on parental funding contingent on a working prototype. iOS development proceeds in the iOS Simulator, and external surfaces use Vercel preview URLs (*.vercel.app) and Resend's sandbox sender until Week 22.

### Phase 4: V1 Build (Months 2 through 5)

Approximate sequencing across the build period. Mobile and web are built in parallel from Month 1 since both ship at V1, with iOS as the only mobile target at V1 launch. Android development begins as a friend-assisted fast-follow project immediately after V1 ships, rather than being deferred to V1.5. The Android shipping date is contingent on friend availability and is not pinned in the master calendar.

- Build month 1: User authentication, onboarding flow, profile data model, core database schema, mobile and web shells initialized in parallel
- Build month 2: Core AI planning engine (template library plus AI selection model), daily plan display on both surfaces, Google Calendar sync
- Build month 3: Fitness module, nutrition module, meal plan and grocery list generation, built-in calendar (forked from open-source base such as react-native-calendars)
- Build month 4: Sleep module, medication module, finance module, errands module, task auto-scheduling engine, Dynamic Island integration via iOS Live Activity Push Starts
- Build month 5: Polish pass, Stripe payments integration, internal testing, bug triage, App Store submission preparation

Sequencing assumes approximately 56 hours per week of focused founder time. Lighter weekly commitments extend this timeline proportionally. The Phase 4 build is decomposed into approximately 110 to 111 Claude Code sessions across the four build months — 105 primary build chats, plus six sessions added during the post-Layer review pass to cover items surfaced during architecture sign-off, plus one conditional session held in reserve for an Apple StoreKit integration fallback path.

Apple Sign In is live at V1 launch as an equal-weight option alongside Google OAuth and email magic link. The implementation activates at Cutover step C-09 of the Phase 3 environment cutover and is required before the chat 010 production deploy; App Store Review guideline 4.8 mandates Apple Sign In whenever any other social login is offered on the iOS surface.

### Phase 5: Internal Alpha (Month 6)

The founder uses the app daily for one month to surface real-world friction. A personal usage log is maintained. Critical bugs are fixed. Onboarding is refined based on the founder's experience of re-onboarding the app multiple times in different contexts.

### Phase 6: Closed Beta (Month 7)

Twenty to fifty beta testers are recruited from existing networks or from anonymous waitlist signups. Structured feedback is collected via in-app surveys and direct conversations. The highest-friction screens are iterated. Pricing willingness is confirmed through direct conversations with willing beta users.

### Phase 7: Public Launch (Month 8)

Launch on Product Hunt. Coordinated launch announcement across the anonymous brand social accounts that have been building presence during the development period. Waitlist email blast converts waiting users into trial users. Paid acquisition is held in reserve and only triggered if organic traction is strong.

### Phase 8: Growth and Iteration (Month 9 onward)

Activation, retention, and conversion metrics are monitored against the success criteria locked in Layer 1. The V1.5 roadmap begins immediately post-launch (voice input, email AI-read for scheduling, default paid dashboard, Apple Calendar sync, mood module). The V2 feature roadmap begins based on user behavior data and beta feedback. A decision point arrives at approximately $100,000 ARR: continue as an indie operation, or begin acquisition conversations with potential buyers in the productivity software space. Android shipping is a fast-follow post-V1 (friend-assisted), not a V1.5 item.

## Tools and Infrastructure

- AI development: Claude Pro subscription ($20 per month, includes Claude Code with 5-hour rate-limit windows)
- Web hosting: Vercel Pro ($20/month, required from launch — Hobby tier prohibits commercial use)
- Database and authentication: Supabase, free tier initially
- Mobile framework: React Native, with iOS as the only target at V1 launch and Android as a friend-assisted fast-follow post-V1 with no committed shipping date
- Mobile distribution: Apple Developer Program ($99 per year), Google Play Console ($25 one-time fee, deferred post-V1)
- Payments: Stripe, pay-per-transaction with no upfront cost
- Domain: approximately $12 per year
- Transactional email: Resend or a similar service
- Product analytics: PostHog free tier or Vercel Analytics
- Recipe data: TheMealDB free API as baseline, Edamam or Spoonacular for nutritional metadata
- Workout template seed: ExerciseDB free API

## Total Cost to Launch

Approximately $351 in the first year: domain (~$12), Apple Developer Program ($99), and Vercel Pro ($240, at $20/month required from launch). Supabase and Resend are free at low user counts. The Claude Pro subscription ($20/month) is the primary build tool and is tracked separately. No external investment is required to reach a publicly launched, payment-enabled product. Hosting and database costs only begin to climb meaningfully after several hundred active users, at which point subscription revenue covers infrastructure.

## Time Investment

The founder commits approximately 8 hours per day (roughly 56 hours per week) to the build. At this cadence, V1 reaches public launch in approximately 8 months from project start, including brainstorming (3 weeks), PRD and technical specification (1 week), environment setup (1 week), build (4 months), internal alpha (1 month), and closed beta (1 month). Rate-limit windows on the Claude Pro plan introduce some throttle on uninterrupted Claude Code sessions; the founder batches work around 5-hour window resets to maximize productive use of the rate-limited tool.

## Communication Preferences

The founder prefers terse, compressed responses during brainstorming and coding sessions to maximize signal density. The convention drops articles and filler, avoids affirmations, and uses compressed phrases rather than full sentences. Formal deliverable documents like this one are written in complete prose for clarity and future reference.