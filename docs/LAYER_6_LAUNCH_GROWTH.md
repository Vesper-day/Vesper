# Layer 6: Launch and Growth

## Layer Purpose

Layer 6 translates the locked product, technical, experience, and business decisions from prior layers into a concrete, sequenced plan for getting Vesper from "built" to "in users' hands and generating revenue." Where Layer 1 set the strategic posture, Layer 2 defined what ships, Layer 3 defined how it is built, Layer 4 defined how it looks and sounds, and Layer 5 defined how it makes money, Layer 6 defines exactly what the founder does each week from now through three months post-launch to acquire users, convert them to paying subscribers, and measure whether the business is working.

This layer produces six sets of decisions: the master launch calendar with explicit week-by-week founder action items so nothing falls through the cracks during a long build; the waitlist strategy covering landing page mechanics, capture fields, tooling, and pre-launch nurture cadence; the launch channel mix prioritized for top-of-funnel signups across Product Hunt, Hacker News, Indie Hackers, Designer News, Reddit, BetaList, startup directories, newsletter pitches, and AMAs; the content strategy with five pillars, batched volume targets, and a Claude-driven generation workflow that drops the prior 3-to-5-hour weekly founder time cap; precise definitions of activation, day-one retention, day-seven retention, and day-thirty retention so that PostHog funnels can be wired against Layer 3's tracked events; and the policies on referrals and Android-waitlist communication.

Decisions in this layer interact with Layer 3's analytics infrastructure (PostHog event names already defined), Layer 4's marketing visual language (landing page sections and social aesthetics already locked), and Layer 5's win-back posture (single 48-hour survey email already locked). Where Layer 6 expands on or modifies prior-layer decisions, the change is documented explicitly in the cross-layer updates section at the end of this document.

Because Layer 6 is tactical and reversible throughout, it is appropriate for Sonnet rather than Opus, and the founder's content time constraint has been deliberately removed in favor of a Claude-driven generation pipeline that produces high-volume output with minimal founder review overhead.

## Working Direction From Prior Layers

The product is Vesper, a Life OS for young professionals ages 22 to 32, launching in the United States only at V1. The brand voice is butler-modeled, warm but calm and quietly competent, never referring to itself as AI and never using emojis or exclamation points. The aesthetic is warm darkness rather than cold darkness. The business model is a one-week (seven-day) free trial at $19.99 per month, with no permanent free tier, no card required to start the trial, and a deliberately frictionless cancellation flow with a single 48-hour win-back survey email after exit. Both web and iOS mobile ship at V1, with Android arriving shortly after launch through friend-assisted development rather than waiting for V1.5. The founder maintains media anonymity, meaning no face on camera and no voice in recordings, but is comfortable with text-based outreach, newsletter pitches, and brand-account engagement on social platforms. 

Layer 6 builds entirely within those constraints.

## Master Launch Calendar

This calendar exists because the build phase is long, there are many time-sensitive actions to coordinate, and the founder has explicitly requested explicit week-level reminders so that nothing is forgotten. Each row maps to a specific project week (numbered from the start of brainstorming) and an absolute action that must be taken in that week. The Claude Code agent reading this document during the build phase should surface upcoming items proactively whenever the calendar is referenced in a prompt, and the founder should treat this calendar as the single authoritative source of "what do I need to be doing this week from a launch perspective."

The calendar assumes the eight-month timeline from Project Overview: brainstorming complete by end of Project Week 3, PRD and technical specification produced in Project Week 4, environment setup in Project Week 5, V1 build across Project Weeks 6 through 21 (Build Months 1 through 4), polish and payments integration in Project Weeks 22 through 25 (Build Month 5), internal alpha in Project Weeks 26 through 27, closed beta in Project Weeks 28 through 29, and public launch in Project Week 30. If the founder's actual cadence diverges from the 56-hour-per-week assumption, every date below shifts proportionally and the founder should re-pin the calendar to the new launch target before proceeding.

### Phase 1 and 2: Brainstorming and Specification (Project Weeks 1 through 5)

**Week 1 through 3.** Complete the six brainstorming layers. Layer 6 (this document) closes the brainstorming phase. No launch-specific actions in this window other than preserving anonymity hygiene on existing social accounts if any pre-existing reference to the project exists.

**Week 4.** Consolidate the six layer documents into a single Product Requirements Document and a separate technical specification. These artifacts become the reference source-of-truth that Claude Code loads at the start of every build session. No launch actions in this week.

**Week 5.** Environment setup. Four launch-relevant actions occur in this week alongside the technical setup: register the chosen Vesper TLD (vesper.studio, vesper.day, or vesper.care, final selection during this week), reserve the brand handle on X, TikTok, Instagram, Threads, Bluesky, Reddit, Indie Hackers, BetaList, Product Hunt, Hacker News, and LinkedIn (do not post yet; reservation only), and create a Resend account for transactional and marketing email plus a PostHog account on the free tier. Note: two paid items are intentionally deferred from Phase 3 to approximately Project Week 22 (start of Phase 5 internal alpha), at which point a working prototype exists to justify the spend. First, the Apple Developer Program enrollment ($99/year) is required for App Store submission and physical-device Live Activity testing, but is not required for iOS Simulator development; iOS work during Build proceeds entirely in the simulator until Week 22. Second, the domain TLD purchase ($15-30 one-time) is held until the same window; during Build, the application runs against localhost for development and Vercel preview URLs (*.vercel.app) for any external surface, with Resend's sandbox domain (onboarding@resend.dev) used for any pre-Week-22 email testing. The TLD itself is selected during Phase 3 even though purchase is deferred, so the chosen name (vesper.studio, vesper.day, or vesper.care) is used as a placeholder throughout all configs. Production OAuth redirect URLs and Stripe webhook URLs are configured against the real domain when it is purchased in Week 22.

### Phase 4: V1 Build (Project Weeks 6 through 25)

**Build Month 1 (Project Weeks 6 through 9).** No outward-facing launch actions. The brand accounts created in Week 5 remain dormant. The founder uses this period to build authentication, onboarding, profile data model, core database schema, and the mobile and web shells.

**Build Month 2 (Project Weeks 10 through 13).** No outward-facing launch actions. Internal focus continues on the AI planning engine, daily plan display, and Google Calendar sync. At the end of Build Month 2 (end of Week 13), the founder should have a recognizable plan-view screen and a working butler-voice ambient line, which is the minimum visual material needed to begin content production in Build Month 3.

**Build Month 3 (Project Weeks 14 through 17). Begin content production.** This is the trigger week for the build-in-public posting strategy. Three content-production actions occur:

1. In Week 14, the founder runs a Claude-driven content generation session to produce the first batch of 20 evergreen butler-aphorism posts in the Layer 4 X card format, plus 5 philosophy thread drafts. These are queued in Typefully or Buffer.
2. In Week 14, the brand account on X begins posting at a cadence of 7 to 10 posts per week, drawing from the queue. The Sunday batch-and-queue cadence locks in: every Sunday, Claude generates the next week's content, the founder spends approximately 30 minutes reviewing for tone, and the queue is populated.
3. In Week 14 through 17, the founder records short screen-recordings of working features as they ship (plan view, calendar sync, module toggles). These become source material for future TikTok posts and product preview content.

By end of Build Month 3, the X account should have approximately 30 to 40 posts published, with engagement metrics establishing the baseline. The brand should feel established by this point, even if follower counts remain low.

**Build Month 4 (Project Weeks 18 through 21).** Content cadence continues. Add TikTok production at a rate of 2 to 3 ambient screen-recording videos per week, batched and scheduled. Add Instagram reposts of X card content at 3 to 4 posts per week. Begin organic Reddit participation under the brand account in Tier 1 subreddits (r/productivity, r/getdisciplined, r/zenhabits, r/decidingtobebetter, r/selfimprovement). Reddit participation means commenting on existing threads with genuine perspectives, never linking to the brand, building visible comment karma against future launch-day posts. Plan for approximately 1 to 2 substantive Reddit comments per week during Build Month 4.

**Build Month 5 (Project Weeks 22 through 25). Waitlist live, BetaList submission, directory carpet-bomb.** This is the densest launch-prep month. The following actions occur in order:

1. **Project Week 22.** The waitlist landing page goes live. The cinematic Three.js scroll experience locked in Layer 4 is the live page on the chosen TLD. Email capture plus iOS/Android dropdown is the only form on the page. The page goes live exactly two months before public launch per founder direction. Announce waitlist availability across all established brand accounts (X, Instagram, TikTok).

2. **Project Week 23.** Submit to BetaList free tier with the waitlist URL. Approval typically takes 1 to 4 weeks, which times the BetaList feature to align with launch week. Begin the directory carpet-bomb: submit to Launching Next, StartupBase, OpenHunts, BetaPage, Uneed, SaaS Hub, AlternativeTo (as a planned alternative to Motion and Reclaim), Foundigy, Startupranking, Indie Hackers Products, ProductHunt's Coming Soon page, Tiny Launch, MicroLaunch, BetaPage, and approximately 10 other consumer-app-friendly directories. Claude can fill the bulk of these forms in approximately 3 to 4 hours of one-time work. The founder reviews and submits.

3. **Project Week 24.** Send the first nurture email to the waitlist: a midpoint butler-voice update with one or two screen-recording GIFs or short clips showing recent build progress. Subject line in butler tone. Body short, less than 200 words. Resend handles delivery. Continue all content cadences.

4. **Project Week 25.** Begin newsletter pitch outreach. Email-only pitches to Indie Hackers newsletter, The Pragmatic Engineer, Refind, Lenny's Newsletter, Morning Brew Sidekick, Every.to Superorganizers, and Stratechery (long-shot but free to pitch). Each pitch is approximately 150 words, brand-only, leading with the philosophy rather than feature inventory. Use the Vesper domain email account.

### Phase 5: Internal Alpha (Project Weeks 26 through 27)

**Project Weeks 26 and 27.** The founder uses the product daily as a real user. Real-world friction surfaces are logged. Critical bugs are fixed. Onboarding is iterated against the founder's own re-onboarding experience. No public-facing launch actions other than continued content cadence.

### Phase 6: Closed Beta (Project Weeks 28 through 29)

**Project Week 28. Closed beta begins.** Recruit 20 to 50 beta testers. Sources: friends and family connections to industry, network introductions, and AI-driven website-testing tools running overnight per founder note. The closed beta is invitation-only via direct outreach, not via the public waitlist (the waitlist preserves the launch-day moment).

**Project Week 28 through 29.** Collect structured feedback via in-app surveys (Layer 3 already specifies the survey infrastructure) and direct conversations with willing beta users. Pricing willingness is confirmed in these conversations: the explicit question "would you pay $19.99 per month for this?" surfaces direct signal, and any common pushback (price too high, missing feature, friction in a specific flow) is logged.

**Project Week 29.** Final pre-launch actions: finalize the Product Hunt launch page (tagline, gallery images, 60-to-90-second product video with no talking head, maker comment drafted 48 hours in advance), finalize the Hacker News Show HN post draft, finalize the Indie Hackers launch announcement, finalize the Designer News submission, finalize launch-day email blast to the waitlist, and pre-write the post-launch content for the following two weeks so that the founder is not generating content during the launch week itself.

### Phase 7: Public Launch (Project Week 30)

**Launch Day. Tuesday of Project Week 30, 12:01 AM Pacific Time.** All channels fire in a coordinated all-fire window per founder direction. The exact sequence within the first six hours:

1. **12:01 AM PT.** Product Hunt launch page goes live. Self-hunted under the brand account.
2. **12:05 AM PT.** Maker comment posted on Product Hunt page. The comment tells the philosophy story, not the feature list.
3. **12:10 AM PT.** Waitlist email blast sent via Resend. Subject line in butler tone, body links directly to the trial signup flow.
4. **12:15 AM PT.** X thread published. Twelve to fifteen posts. Philosophy first, screen recordings interspersed.
5. **12:20 AM PT.** Hacker News Show HN post published. Title format: "Show HN: Vesper — a calm scheduler that plans your day around your life." Body: 300 to 400 words, philosophy-first, link to landing page, link to a "how it works" page.
6. **12:30 AM PT.** Indie Hackers launch post published. Open metrics dashboard linked (a public Stripe and PostHog dashboard showing real-time signup and revenue, which is brand-authentic to the indie-hackers audience).
7. **1:00 AM PT.** Designer News submission.
8. **6:00 AM PT.** Reddit launch posts in r/SideProject, r/SaaS, r/productivity, r/apps, r/iosapps, r/iphone. The post in each subreddit is tailored to the subreddit's voice and posting rules. The brand account's prior comment karma in r/productivity, r/getdisciplined, r/zenhabits, r/decidingtobebetter, and r/selfimprovement enables comment-based engagement in those threads in the hours that follow.
9. **8:00 AM PT.** TikTok launch video published. Slow ambient screen recording, no voiceover, captioned with single butler line.
10. **8:00 AM PT to 11:00 PM PT.** Respond to every comment on Product Hunt within 30 minutes of posting. Respond to every comment on Hacker News within 60 minutes. Engage in Reddit threads as comments accumulate.

Launch-day total founder time commitment: approximately 14 to 16 hours of continuous engagement, ideally with a buffer day cleared on either side.

**Launch Day Plus 1 through 7 (Project Week 30 days 2 through 7).** The launch news cycle continues. Most signup volume arrives in the 48-hour window after launch. Continue responding to Product Hunt and Hacker News comments. Schedule a Reddit AMA on r/SideProject or r/SaaS for day 3 or 4 post-launch. Send a follow-up nurture email to non-converting waitlist signups on day 5 reminding them the trial is still available.

### Phase 8: Growth and Iteration (Project Week 31 onward)

**Project Week 31.** Publish the post-launch retrospective. One signature long-form essay on the Vesper domain blog, sharing transparent metrics (signups, conversion rate so far, churn reasons captured) in butler voice. This essay is the SEO compound asset Layer 6 commits to. It is also pitched to Indie Hackers and Hacker News as a "how it went" retrospective approximately one week post-launch, which is a known second-news-cycle moment that drives a smaller secondary traffic spike.

**Project Weeks 31 onward.** Monitor the operative measures weekly: trial-to-paid conversion rate, monthly paid churn rate, and net contribution per paying subscriber. Operative thresholds are conversion clearing approximately 5% and monthly paid churn staying under approximately 10%. Material drift from either threshold prompts diagnostic work on the relevant funnel stage (onboarding and trial value for conversion; first 30 days of paid experience for churn).

**Project Week 31 onward.** Friends-assisted Android development begins post-launch per founder direction. The exact week Android shipping begins is contingent on friend availability and is not pinned in this calendar. Web access remains the path for all non-iOS users until Android ships.

**Project Week 31 onward.** Content cadence continues at the same volumes as pre-launch, with the primary shift being that content now references shipped reality rather than build-in-progress.

This calendar is the operational backbone of Layer 6. The remainder of this document specifies the underlying logic, decisions, and policies that justify the actions in the calendar.

## Waitlist Strategy

### Landing Page

The waitlist landing page is the cinematic Three.js scroll experience specified in Layer 4 (Marketing Visual Language section). It is built in Next.js, hosted on the chosen Vesper TLD, deployed via Vercel, and uses the existing design system from Layer 4 (espresso background, cream text, bronze accent, Fraunces and Inter typography). No third-party waitlist widget is embedded; the page is custom-built to preserve the cinematic experience without third-party visual artifacts.

The five sections of the landing page are exactly as locked in Layer 4: Hero, What Vesper does, Modules, How it works, and Pricing and signup. The fifth section contains the only form on the page: a single email input field and a single iOS/Android segmented control, with a single "Begin" button. No additional capture fields are requested. The "Pricing and signup" copy already reads "One week free. After that, $19.99 per month." with an additional line below indicating "iOS launching shortly. Web works everywhere in the meantime."

### Capture Fields

Two fields only: email address and primary platform preference (iOS or Android). The platform preference drives segmentation for launch-day email blast (iOS users receive a link to the App Store on launch day, Android users receive a link to the web app with a soft note that the mobile app is coming). No other fields are captured at the waitlist stage. Additional friction reduces signup rate, and the data captured at signup is not needed to operate the waitlist.

### Tooling

Waitlist storage is in Supabase, in a dedicated table separate from the main user table. The table schema includes: `id` (uuid), `email` (text, unique), `platform_preference` (enum: 'ios' or 'android'), `created_at` (timestamp), `referral_source` (text, captured via UTM parameters if present in the URL), and `converted_to_user_id` (uuid, foreign key, null until launch-day conversion). Email delivery for both the nurture cadence and the launch-day blast uses Resend on the existing transactional email infrastructure from Layer 3.

No third-party waitlist tooling (LaunchList, Getwaitlist.com, ConvertKit) is used. The custom build keeps the landing page experience cohesive with the cinematic direction and avoids fragmenting the brand surface across vendors.

### Nurture Cadence

Two emails between waitlist signup and launch day, regardless of when the user joined the waitlist:

1. **Midpoint email (Project Week 24, approximately 6 weeks pre-launch for users who joined at Week 22).** Subject: "Building." Body: approximately 150 words in butler voice, with one short screen-recording GIF or clip showing a recently shipped feature. Closes with a soft "Begin will be ready shortly."

2. **Launch-day email (Project Week 30, launch day).** Subject: "It is ready." Body: approximately 80 words. Direct link to the trial signup flow. For iOS waitlist signups, an additional line directs to the App Store listing. For Android waitlist signups, an additional line notes the web app is ready now and the Android app follows soon.

No other emails are sent to the waitlist during the build period. Restraint is consistent with the brand voice and avoids list fatigue.

### Launch-Day Conversion

All waitlist users receive immediate access to the trial on launch day. No batched drip, no priority queue, no artificial scarcity. The launch-day email arrives at 12:10 AM Pacific on launch day, simultaneous with the Product Hunt page going live. Waitlist users have a slight head start over Product Hunt traffic in that the email arrives before most launch-day discovery channels have peaked.

The trial signup flow is the same flow described in Layer 5 (no card required, 7-day trial, full feature access). The waitlist signup is matched to the trial signup by email address, and the `converted_to_user_id` field on the waitlist row is populated on conversion. This enables accurate measurement of waitlist conversion rate as a distinct funnel from launch-day cold traffic.

## Launch Channel Mix

The launch is multi-channel and all-fire on launch day, optimizing for maximum top-of-funnel signups in the 48-hour window when the news cycle is peaking. The channels are prioritized by expected signup volume and operate concurrently rather than staggered. The all-fire decision trades extended news-cycle attention for peak-window engagement on each channel, which is the right tradeoff given that the brand's compounding distribution comes from sustained content rather than from artificially extended launch windows.

### Product Hunt

Tuesday launch at 12:01 AM Pacific. Self-hunted under the Vesper brand account. The PH submission is fully prepared one week in advance: tagline ("A calm scheduler that plans your day around your life"), gallery (5 images showing plan view, modules, Dynamic Island, landing page hero, settings panel), 60-to-90-second product video with no talking head and no voiceover (slow ambient screen recordings, captioned with butler-voice text overlays), and maker comment drafted 48 hours in advance. The maker comment leads with the philosophy ("most productivity apps treat your day as a list. We tried something different.") rather than feature inventory.

Engagement during the launch day is critical: respond to every comment within 30 minutes during the first six hours. Per Layer 4's voice library, all responses use butler voice. The brand account's responses set the tone for the comment thread, which affects the time-on-page signal that drives Product Hunt's algorithm in 2026.

### Hacker News

Show HN post published at 12:20 AM Pacific on launch day, approximately 20 minutes after Product Hunt. Title format: "Show HN: Vesper — a calm scheduler that plans your day around your life." The body is 300 to 400 words, philosophy-first, with explicit acknowledgment of the calm-scheduler positioning and minimal mention of AI mechanics. The post links to the landing page and to a "how it works" page that explains the template-customization architecture in technical terms (HN values transparency about how things actually work; obscuring the mechanism on HN backfires).

Anticipated risk: HN can be hostile to consumer productivity apps and AI-adjacent products. Mitigation: lead with calm, honest, and concrete. No marketing speak. The author engages with every comment, including critical ones, in a thoughtful and non-defensive way. Critical comments are not deleted under any circumstances.

### Indie Hackers

Launch post published at 12:30 AM Pacific. Body: the build journey, the architectural decisions (template-customization over full generation), the pricing logic ($19.99 with no permanent free tier), and a link to a public open-metrics dashboard showing real-time Stripe revenue and PostHog signup counts. The open-metrics dashboard is built in advance using Stripe's public dashboard sharing feature and PostHog's public dashboard feature (both supported on the free tier). The dashboard URL is the trust signal that differentiates the IH post from a generic launch announcement.

### Designer News

Submission at 1:00 AM Pacific. Designer News audience values craft and aesthetic discipline, both of which are well-represented in the Vesper brand. The submission emphasizes the design philosophy (warm dark, Fraunces typography, butler-voice copy, animation system) rather than features. Linked materials include the landing page and an optional "design system" essay published on the Vesper blog one week prior to launch, which can be the deep-link from the DN submission.

### Reddit

Launch-day posts at 6:00 AM Pacific in the following subreddits, in order:

1. **r/SideProject (1.2M+ members).** Indie-friendly, sustained launch-day visibility. Post format: build journey + screenshot.
2. **r/SaaS (220k+ members).** Founder-friendly. Post format: pricing decisions + open metrics dashboard link.
3. **r/productivity (1.7M+ members).** Highest-volume target. Post format: philosophy thread + soft mention of the launch.
4. **r/apps (290k+ members).** App-discovery audience. Post format: short feature overview + screenshots.
5. **r/iosapps (220k+ members).** iOS-specific. Post format: Dynamic Island integration + screen recording.
6. **r/iphone (5M+ members).** Highest-volume but most variable. Post format: short feature overview + Dynamic Island as the hook.

Tier 2 subreddits (r/zenhabits, r/decidingtobebetter, r/selfimprovement) are not posted to on launch day. Posting in these subreddits requires more native participation and would feel intrusive at the launch moment. Comments from the brand account in these subreddits, building on the prior Build Month 4 participation history, are the appropriate footprint.

Tier 4 subreddits (r/biohackers, r/QuantifiedSelf, r/digitalminimalism) are not posted to. r/digitalminimalism is openly hostile to new apps, and r/biohackers/r/QuantifiedSelf are too niche to justify the time cost during the launch window.

### BetaList

Submission occurs in Project Week 23 (approximately 7 weeks before launch). BetaList free tier with no expedited fee. Approval typically takes 1 to 4 weeks; for consumer apps with a clear value proposition and warm-dark aesthetic, approval rates are reasonable. If approval times out the launch-week alignment, BetaList feature publishing can happen post-launch and still contributes incremental signup volume.

### Startup Directories

A one-time carpet-bomb submission to approximately 20 startup discovery directories in Project Week 23, simultaneously with the BetaList submission. Aggregated SEO backlink value from these directories compounds over time. The submission list:

- Launching Next
- StartupBase
- OpenHunts
- BetaPage
- Uneed
- SaaS Hub
- AlternativeTo (positioned as an alternative to Motion, Reclaim, Morgen)
- Foundigy
- Startupranking
- Indie Hackers Products
- Product Hunt Coming Soon
- Tiny Launch
- MicroLaunch
- Kickstart.io
- Launchpedia
- Hacker News' Show HN (separate from launch-day Show HN)
- Reddit r/sideproject Coming Soon
- DEV.to Project Showcase
- Hashnode Builds
- Lobsters (technical audience overlap)

Claude can complete the bulk of these submission forms in approximately 3 to 4 hours of one-time work, with the founder reviewing and approving each submission.

### Newsletter Pitches

Email-only pitches in Project Week 25 (approximately 5 weeks pre-launch). The pitch list:

- **Indie Hackers newsletter.** Curated by Indie Hackers staff; covers indie launches with a strong slant toward bootstrapped founders. Pitch angle: anonymous-brand indie launch story.
- **The Pragmatic Engineer.** Tech-leadership audience; pitch angle: the technical architecture decisions behind a solo-founder consumer app build.
- **Refind.** Curated content discovery; pitch angle: the calm-scheduler philosophy essay published on the Vesper blog.
- **Lenny's Newsletter.** Product leadership audience; pitch angle: the design and product decisions in a calm-scheduling app.
- **Morning Brew Sidekick.** Productivity audience; pitch angle: a new approach to daily planning for professionals.
- **Every.to Superorganizers.** Productivity tools coverage; pitch angle: philosophy of calm scheduling versus optimization.
- **Stratechery.** Long-shot but the pitch is free; angle: consumer software and the post-Notion landscape.

Each pitch is approximately 150 words, brand-only, text-based, no video calls requested, no interviews requested. Pitches are sent from the Vesper domain email account. One or two pickups around launch week would be meaningful; response rates from cold newsletter pitches are highly variable and not targeted.

### Launch-Week AMA

Reddit AMA on r/SideProject or r/SaaS, scheduled for day 3 or 4 post-launch (extending the news cycle into the second week). Text-only AMA, brand voice. Topic framing: "I built a calm scheduling app for the post-AI-hype era. AMA." The AMA preserves anonymity since it is text-only and gives the launch a second discoverability moment after the launch-day spike.

## Reddit Strategy

Reddit is the highest-leverage long-form community channel for Vesper given the audience overlap with productivity-curious subreddits. The strategy has two phases: sustained participation during the build, and concentrated launch-day posting.

### Subreddit Tier List

**Tier 1: Core productivity audience.** Sustained participation throughout Build Month 4 (Project Weeks 18 through 21) and ongoing.

- r/productivity (1.7M+ members). General productivity discussion. Comment on existing threads with butler-voice perspectives on planning, calm work, calendar discipline. Avoid linking to the brand. Build comment karma.
- r/getdisciplined (1.5M+ members). Self-discipline and habit-building audience. Same approach as r/productivity.
- r/zenhabits, r/decidingtobebetter, r/selfimprovement. Lifestyle-adjacent. Lower volume, higher-engagement comments. Same approach.

**Tier 2: Tech-curious audience.** Launch-day posting target. No prior participation required.

- r/SideProject. Indie-friendly launch announcement.
- r/SaaS. Founder-friendly launch announcement.
- r/apps. App-discovery launch announcement.
- r/iosapps. iOS-specific launch announcement.
- r/iphone. High-volume launch announcement.

**Tier 3: Audience overlap, post-launch consideration.**

- r/biohackers. Anti-AI-hype sub; gentle approach if posted post-launch.
- r/QuantifiedSelf. Niche fit; post-launch consideration tied to the optimizer-tier audience.

**Tier 4: Not posted to.**

- r/digitalminimalism. Openly anti-app sub; would generate backlash, not signups.
- r/getmotivated. Wrong tone for the brand.

### Seeding Philosophy

Sustained participation under the brand account from Project Week 18 (Build Month 4 start) through launch. The participation is genuine rather than performative: real comments on existing threads, sharing butler-voice perspectives on planning, scheduling, and calm productivity. No brand links in comments. No self-promotion. The goal is to build comment karma and brand-account recognition so that the launch-day posts in Tier 2 subreddits do not appear to come from a karma-zero new account.

Time budget: approximately 1 to 2 substantive Reddit comments per week from Project Week 18 onward, totaling 12 to 24 comments before launch. Claude can draft initial comment text given a thread URL, and the founder reviews for tone before posting. Founder review time per comment: approximately 5 minutes.

## Content Strategy

The content strategy is structured around five pillars, generated primarily by Claude with founder review, and published at high volume across X, Instagram, TikTok, Reddit, and the Vesper blog. The prior Layer 1 cap of 3 to 5 hours per week of founder content time is lifted per Layer 6 decisions; Claude does the generation and the founder reviews. Total founder content time per week: approximately 30 minutes on Sundays for batch review.

### Pillars

**Pillar 1: Butler aphorisms.** Evergreen Fraunces-text-on-espresso card content, locked in Layer 4 Marketing Visual Language. Examples: "Mornings reward those who prepared the night before.", "A schedule is a kind of grace.", "The day attends to those who attend to it." Volume: 4 to 5 cards per week. Channels: X, Instagram. Generation: Claude produces 20 to 30 candidate aphorisms per Sunday batch session; founder selects and approves; design tokens auto-generate the cards.

**Pillar 2: Subtle product reveals.** Short screen recordings, UI detail GIFs, and product moments captured during the build phase. Volume: 2 to 3 per week. Channels: X, Instagram, TikTok. Generation: founder captures raw screen recordings during build; Claude writes captions in butler voice; founder approves.

**Pillar 3: Philosophy threads.** Longer-form X threads on calm scheduling, the calendar problem, why most productivity apps fail, what a butler knows. Volume: 1 to 2 per month. Channels: X (primary), occasional adaptations for the Vesper blog. Generation: founder provides the seed idea ("the calendar problem"); Claude drafts the thread; founder reviews and approves.

**Pillar 4: Behind-the-glass.** Design and craft posts that share the typography choices, color reasoning, animation philosophy, and design system decisions without revealing the founder. Volume: 1 to 2 per month. Channels: X, Vesper blog. Generation: Claude can write these directly from Layer 4 source material; founder reviews.

**Pillar 5: Reactive standalone posts.** Standalone posts about industry discourse rather than replies to others. When Notion ships a new feature or Motion makes a pricing change, the brand account publishes a standalone post with butler-voice commentary. Volume: 1 to 2 per month, depending on industry news flow. Channels: X. Generation: founder flags newsworthy events; Claude drafts; founder approves.

Pillar 5 is distinct from direct engagement. Per the engagement rule (next section), the brand account does not reply to or quote-tweet other accounts. Pillar 5 posts are independent posts about industry events, not threaded conversations with other accounts.

### Channels and Volume Targets

- **X (Twitter).** 7 to 10 posts per week, batched on Sundays. Drawn from all five pillars.
- **Instagram.** 3 to 4 posts per week. Primarily Pillar 1 (butler aphorism cards) reposted from X.
- **TikTok.** 2 to 3 ambient screen-recording videos per week. Primarily Pillar 2 (product reveals).
- **Reddit.** 1 to 2 organic comments per week in Tier 1 subreddits during Build Month 4 onward.
- **Vesper blog.** 1 essay per month. Compound SEO asset. Drawn from Pillar 3 (philosophy) and Pillar 4 (behind-the-glass).

### Generation Workflow

The Sunday batch-and-queue session is the operational backbone of the content strategy. Total Sunday time: approximately 60 to 90 minutes including founder review. The workflow:

1. Founder opens a Claude session and references the Layer 4 Marketing Visual Language section plus the prior week's published content (to avoid repetition).
2. Claude generates the week's content drafts across all five pillars in butler voice, respecting the voice gate rules in Layer 4 (no em-dashes, no exclamation points, no emojis, no gratitude language, no manufactured urgency).
3. Founder reviews each draft, edits for tone if needed (approximately 30 to 45 minutes for the full week's batch), and approves.
4. Approved content is queued in Typefully (for X), Buffer (for Instagram), and TikTok's native scheduler. Each platform publishes on its scheduled cadence.
5. The Vesper blog essay (1 per month) is drafted in a longer session, typically 90 minutes including review.

A friend with a Claude account can be enlisted to amplify generation volume during high-need periods (pre-launch ramp, launch week), per founder note. The friend works under the same butler voice constraints and provides drafts to the founder for review.

### Build-in-Public Start Date

Content publishing begins in Project Week 14 (Build Month 3 start). Brand accounts created in Project Week 5 remain dormant until Week 14. The Build Month 3 start trigger is justified because by that point the AI plan engine is functional, the daily plan view exists, and there is genuine visual material to share. Starting earlier risks publishing about a product that does not yet exist; starting later loses compounding distribution.

### Evergreen Stockpile

Target: 60 evergreen posts in the queue before launch (approximately two months of buffer). The stockpile builds across Build Months 3 through 5 (Project Weeks 14 through 25). Pre-launch stockpile insulates the founder from content production during the launch week itself, when attention is consumed by launch-day engagement.

### Engagement Rule

The brand account does not reply, quote-tweet, or thread on other accounts' posts. The brand account only responds to direct @-mentions in butler voice. This rule preserves the brand's discrete, dignified posture and prevents the brand from being drawn into conversational dynamics that conflict with butler voice.

Pillar 5 reactive content (standalone posts about industry events) is distinct from this engagement rule. Pillar 5 posts are independent observations published as new posts on the brand timeline, not replies or quote-tweets directed at other accounts' content.

## Activation and Retention Definitions

These definitions are the precise specifications for PostHog funnel construction. They are written verbosely so that Claude Code, when implementing the analytics layer in the build phase, has no ambiguity about which events combine to define each metric.

**Activation.** A user is activated when they complete the onboarding flow specified in Layer 4, generate their first daily plan, and mark at least one block on that plan complete, all within 24 hours of their initial signup. In PostHog event terms, activation is the funnel: `signed_up` → `onboarding_completed` → `first_plan_generated` → `block_completed`, with the `signed_up` event's timestamp and the `block_completed` event's timestamp separated by no more than 86,400 seconds.

**Day-1 retention (D1).** A user is retained at day 1 when they log into the application within 24 hours of their initial signup, and at that login they view a generated plan (whether the first one or a regenerated one). In PostHog event terms, D1 retention is satisfied when a `plan_viewed` event fires within 24 hours of the `signed_up` event.

**Day-7 retention (D7).** A user is retained at day 7 when they log into the application on day 6 or day 7 post-signup (where day 0 is the signup day), have generated at least one plan in the prior 7 days, and have completed at least one block in the prior 7 days. In PostHog event terms, D7 retention is satisfied when a `plan_viewed` event fires on day 6 or 7, a `plan_generated` event has fired in the prior 7 days, and a `block_completed` event has fired in the prior 7 days.

**Day-30 retention (D30).** A user is retained at day 30 when they have an `active` subscription status on day 30 — meaning they converted past the 7-day trial and are still paying. The trial-overlap edge case present in the prior 14-day model is no longer applicable; the 7-day trial concludes well before the day-30 measurement window.

**Cancellation reason capture.** On the cancellation screen (specified in Layer 5), a dropdown surfaces the following options: "Price too high", "Not using it enough", "Found an alternative", "Life change", "Technical issues", "Other". An optional free-text field accepts additional context. The selection is captured in PostHog as a `subscription_canceled` event with a `cancellation_reason` property holding the dropdown value, and a `cancellation_reason_text` property holding the optional free text. Per Layer 5, this capture happens at the cancellation moment, separate from the 48-hour win-back survey email which collects retrospective qualitative signal.

## Analytics Infrastructure

The analytics stack is locked in Layer 3 (PostHog free tier, Vercel Analytics included with Vercel Pro at $20/month — Pro is required from public launch because Hobby plan TOS prohibits commercial use, Sentry free tier for error tracking, Supabase logs for database events). Layer 6 specifies the dashboards and funnels built on top of this stack.

### Funnels and Dashboards

Three primary funnels are built in PostHog on or before launch day:

**Funnel 1: Signup to activation.** Steps: `signed_up` → `onboarding_step_completed` (each step counted individually) → `onboarding_completed` → `first_plan_generated` → `block_completed`. Time window: 24 hours from `signed_up`. The drop-off at each step identifies which part of the onboarding flow is friction-causing.

**Funnel 2: Activation to trial-to-paid conversion.** Steps: `signed_up` → `block_completed` (activation) → `trial_reminder_shown` (any of the three checkpoints) → `subscription_started`. Time window: 7 days from `signed_up`. This funnel measures the trial-to-paid conversion rate by stage of the trial.

**Funnel 3: Trial-to-paid to D30 retention.** Steps: `subscription_started` → `plan_viewed` (on day 7 post-subscription) → `plan_viewed` (on day 30 post-subscription) → `subscription_active` (subscription_status = 'active' on day 30). This funnel measures early-stage churn signals.

### Public Open Metrics Dashboard

Per the Indie Hackers launch strategy, a public open-metrics dashboard is built using Stripe's dashboard sharing feature and PostHog's public dashboard feature. The dashboard displays in real-time: total signups, signups today, signups this week, trial-to-paid conversion rate (rolling 30 days), monthly recurring revenue, total paying subscribers. The dashboard URL is shared in the launch-day Indie Hackers post and is linked from the Vesper blog footer.

The public dashboard is brand-authentic to the indie audience and serves as a trust signal that the founder is operating transparently. Privacy: no individual user data is exposed, only aggregate counts and revenue.

## Operative Measures

Four metrics drive every post-launch decision. They are tracked weekly in the PostHog and Stripe dashboards.

- **Trial-to-paid conversion rate.** Percentage of trial users who convert to `subscription_status = active` within 7 days of signup. Operative threshold: clears approximately 5%. Material drift below 5% prompts diagnostic work on onboarding flow drop-off and trial value delivery.
- **Monthly paid churn rate.** Of paying subscribers active at the start of month M, percentage who canceled or fell into the read-only continuation state by the end of month M. Operative threshold: stays under approximately 10%. Material drift above 10% prompts diagnostic work on the first 30 days of paid experience.
- **AI cost per active paying user.** Total monthly AI spend on Sonnet and Haiku calls divided by count of active paying users. Operative threshold: stays near the $1.20 planning midpoint (range $1.00–$1.50). Material drift above $1.50 prompts review of output token discipline and cache hit rate.
- **Net contribution per paying subscriber.** Gross revenue minus Apple commission (iOS) or Stripe processing plus Stripe Tax (web) minus AI cost. Operative threshold: stays positive across both surfaces. This is the single check that the business is economically sound on each marginal subscriber.

No signup-volume targets, paying-subscriber targets, or growth-curve projections are tracked. Scale follows from positive unit economics; absent those, scale is not the problem to solve.

## Growth Experiments

Per founder direction, all growth and pricing experiments are deferred to V3. No experimentation infrastructure (PostHog feature flags, A/B test allocation, holdout cohorts) is activated at V1 or V2. The product is shipped, monitored, and iterated based on observed signal, but specific controlled experiments are not run.

The rationale is twofold. First, statistical significance on consumer SaaS experiments requires meaningful user volume, and V1 will not have that volume in the first six months. Second, the founder has elected to focus on building a solid base of loyal paying customers before introducing experimentation overhead. Experiments require infrastructure, analysis time, and decision discipline that compete with feature work during the V1-to-V2 period.

The previously documented experiments (trial length, price point, no-card-required versus card-required-upfront, annual billing prominence) remain on file in Layer 5 but are explicitly not run at V1 or V2.

## Referral Program

A quiet referral program ships with V1, structured to be meaningfully different from the gamification mechanics rejected in Layer 2.

### Mechanics

Each paying subscriber receives a unique referral link in their account settings panel. The link points to the Vesper landing page with a referral code attached as a URL parameter. When a new user signs up via that link and converts to a paying subscription (not just a trial start), the referrer receives a fifty percent discount on their next billing cycle. The referee receives no discount; the trial alone is the new-user incentive. Credits stack without cap, so a referrer who brings in three converters earns three consecutive months at half price. Credits are voided if the referrer is no longer in active subscription state at the moment of application. The credit cannot be redeemed for cash, and there is no leaderboard, no public referral count, no badge, no streak, and no in-app surface that promotes referrals beyond the settings panel.

### Copy

The settings panel surface uses the Layer 4 butler voice. The exact copy:

> Pass this along, if you like.
>
> Anyone who joins through your link starts with the free trial. When they begin paying, your next month is half off.
>
> [Your link: vesper.studio/r/abc123def]

There is no countdown, no urgency framing, and no surface that highlights how many referrals the user has made. Referrals operate as a quiet incentive embedded in the settings panel, not as a marketing channel.

### Tracking

Referral attribution is captured via the URL parameter, stored on the new user's row at signup, and reconciled on conversion. PostHog captures a `referral_attribution` event at signup and a `referral_conversion` event at paid conversion, enabling cohort analysis of referred users versus organically acquired users.

### Expected Volume

Quiet referrals are expected to be a low-percentage, slow-compounding channel rather than a spike. If referral-attributed signups become disproportionate to total signups, the policy is reviewed for any unintended virality dynamics.

## Android Communication

Per founder direction, Android development is reframed from a deferred V1.5 item to a fast-follow item post-V1, supported by friend-assisted development. The exact shipping date for Android is not pinned and depends on friend availability and the build progress that occurs once a working V1 product is in the friend's hands as motivation.

### Communication Posture

The communication posture to Android waitlist users is soft, honest, and free of manufactured urgency.

The launch-day email to Android waitlist users includes a single additional line beyond the standard launch-day copy:

> The web app is ready now and works on any device. The Android app is in development; we'll let you know when it's ready.

No specific timeline is promised. No "coming in X weeks" claim is made. The line is butler-voice consistent and avoids the manipulative urgency tactics rejected in Layer 4.

### Web-First Mobile Posture for Android Users

Until the Android app ships, Android waitlist users are routed to the web application, which has feature parity with the iOS app at V1 per Layer 2. The web application is responsive and usable on Android phones; the Layer 4 design system already specifies mobile-responsive breakpoints for web. The user experience on a mobile browser is functional and brand-consistent, even if not as polished as the native iOS application.

When the Android app ships, a separate launch announcement is made to the Android-segmented waitlist subset and to the active Android-using web subscribers. This is a smaller, audience-targeted launch moment rather than a full-scale public launch.

## Cross-Layer Updates Required

This section documents specific text changes that must be applied to other layer documents to align with Layer 6 decisions. Apply these updates manually to the source documents.

### LAYER_1_FOUNDATION.md

**Update 1:** In the "Build-in-Public Strategy" section, the paragraph that reads "A separate brainstorming task in Layer 6 will produce a content calendar with a weekly time budget capped at three to five hours, batched, so social media work does not eat into building time." should be replaced with:

> Layer 6 specifies a high-volume content strategy generated primarily by Claude with founder review. The prior weekly time cap of three to five hours has been lifted in favor of a Claude-driven generation pipeline. Founder content time is approximately 30 minutes per week of Sunday batch review. Content volume targets are specified in Layer 6.

**Update 2:** In the "Open Items From Layer 1" section, the third item ("Content scheduling overhead") can be marked resolved with the note: "Resolved in Layer 6. Founder time on content is approximately 30 minutes per week of review; Claude handles generation. Volume targets are 7-10 X posts per week, 3-4 Instagram posts per week, 2-3 TikTok videos per week, 1-2 Reddit comments per week, and 1 blog essay per month."

### LAYER_2_PRODUCT_SCOPE.md

**Update 1:** In the "Open Items From Layer 2" section, the third paragraph ("The specific marketing approach to communicating the iOS-only V1 launch to Android users on the waitlist is deferred to Layer 6 (Launch and Growth).") can be marked resolved with the note: "Resolved in Layer 6. Android waitlist users receive the launch-day email with web-app-first messaging and a soft 'Android app in development' note without specific timeline commitment. Friend-assisted Android development begins post-launch."

**Update 2:** The V1.5 roadmap reference to "Android Dynamic Island equivalent" should be re-pinned to a fast-follow post-V1 ship rather than V1.5, contingent on friend-assisted development capacity.

### LAYER_3_TECHNICAL_ARCHITECTURE.md

**Update 1:** In the "Product Analytics" section under "Observability and Operations," after the existing paragraph about PostHog events, add the following paragraph:

> The PostHog funnel and dashboard specifications are locked in Layer 6. Three primary funnels are built on or before launch day: signup-to-activation, activation-to-trial-to-paid, and trial-to-paid-to-D30-retention. Layer 6 specifies the exact event sequences and time windows for each funnel. A public open-metrics dashboard exposing aggregate signup counts, MRR, and trial-to-paid conversion rate is built using PostHog's public dashboard feature and Stripe's dashboard sharing feature. The dashboard URL is shared in the launch-day Indie Hackers post.

**Update 2:** A new event should be added to the PostHog event list: `referral_attribution` (fired at signup when a referral URL parameter is present) and `referral_conversion` (fired at paid conversion for users with a referral attribution on their row).

### LAYER_4_EXPERIENCE_IDENTITY.md

**Update 1:** In the "Marketing Visual Language" section, the landing page section 5 ("Pricing and signup") copy can be expanded to include the Android-soft-message line:

> Copy resolves to: "One week free. After that, $19.99 per month. iOS launching shortly. Web works everywhere in the meantime." Single email input field, single iOS/Android segmented control, single "Begin" button.

**Update 2:** In the "Copy Library" section, add the following waitlist email copy entries:

| Scenario | Subject | Body |
|---|---|---|
| Waitlist midpoint nurture | "Building." | Approximately 150 words in butler voice with one screen-recording GIF showing recent build progress. Closes with "Begin will be ready shortly." |
| Waitlist launch day (iOS user) | "It is ready." | Approximately 80 words. Direct link to trial signup. App Store link below. |
| Waitlist launch day (Android user) | "It is ready." | Approximately 80 words. Direct link to web trial signup. Soft note: "The web app is ready now and works on any device. The Android app is in development; we'll let you know when it's ready." |
| Referral settings panel | (no email) | "Pass this along, if you like. Anyone who joins through your link starts with the free trial as usual. When they begin paying, your next month is half off." |

### LAYER_5_BUSINESS_MONETIZATION.md

**Update 1:** In the "Pricing Experiments" section, replace the deferral language ("Pricing experiments are deferred to post-launch and not actively run at V1") with: "Pricing experiments are deferred entirely to V3 per Layer 6 founder direction. No experimentation infrastructure is activated at V1 or V2. The documented experiments remain on file for V3 consideration but are not run before then."

**Update 2:** In the "Reactivation Campaigns" section, the line about reviewing additional touchpoints after six months can be amended: "Per Layer 6, the single 48-hour win-back survey email is the only proactive win-back attempt. Additional reactivation campaigns are not added at V1 or V2 regardless of observed organic resubscription rates. The single-survey posture holds through V2."

### PROJECT_OVERVIEW.md

**Update 1:** In Phase 4 (V1 Build), the line about Android joining at V1.5 should be amended:

> Mobile and web are built in parallel from Month 1 since both ship at V1, with iOS as the only mobile target at V1 launch. Android development begins as a friend-assisted fast-follow project immediately after V1 ships, rather than being deferred to V1.5. The Android shipping date is contingent on friend availability and is not pinned in the master calendar.

**Update 2:** In Phase 8 (Growth and Iteration), the V1.5 roadmap line referencing "Android Dynamic Island equivalent" can be removed; Android shipping is now a fast-follow rather than a V1.5 item.

### OPEN_SOURCE_INVENTORY.md and BRAINSTORM_MASTER.md

No changes required.

## Open Items From Layer 6

The following items are deferred or flagged for resolution outside Layer 6.

1. **Android shipping date.** Not pinned in this layer. Contingent on friend availability. Founder to coordinate with friends post-V1 launch.

2. **Domain TLD final selection.** Carried forward from Layer 4 open items. Decision to be made during Phase 3 (Environment Setup, Project Week 5). Candidates: vesper.studio, vesper.day, vesper.care.

3. **Stripe public dashboard configuration.** Specific configuration of the open metrics dashboard occurs in Phase 4 (Build) as part of the analytics implementation. The dashboard URL is finalized before Project Week 25 so it can be referenced in the launch-day Indie Hackers post.

4. **Newsletter pitch list refinements.** The current list of seven newsletters is the starting set. Additional candidates may emerge during the build period; the founder can add to the pitch list as relevant publications surface.

5. **Reddit AMA exact date and subreddit.** Scheduled for day 3 or 4 post-launch. The specific subreddit (r/SideProject or r/SaaS) and exact day are pinned in the days immediately before launch based on observed launch-day Reddit traction.

## What Was Considered and Rejected

The following alternatives were considered during Layer 6 and rejected, recorded so they are not revisited.

**Six-week or sixteen-week waitlist runway.** Rejected in favor of the 2-month (8-week) runway specified by the founder. Shorter runways risk insufficient compounding; longer runways risk waitlist staleness and email-list fatigue. Eight weeks is the calibrated middle ground.

**Capturing additional waitlist fields beyond email and platform preference.** Rejected. Pain-point dropdown, timezone, age range, and other potentially useful fields add friction at signup with marginal information gain. The two-field waitlist preserves conversion rate at the top of funnel.

**Batched launch-day waitlist invite drip.** Rejected. The artificial scarcity of a drip contradicts the no-manufactured-urgency posture locked in Layer 4. All waitlist users receive immediate access on launch day.

**Card-required-upfront trial as a Layer 6 experiment.** Rejected. Per Layer 5, the no-card-required posture is locked at V1. Per Layer 6, all experimentation is deferred to V3.

**Staggered launch across days or weeks (instead of all-fire launch day).** Rejected per founder direction. Maximum top-of-funnel engagement comes from coordinated peak-window posting on launch day. Extended news cycles via staggered posting trade peak engagement for tail attention, which is the wrong tradeoff given the brand's compounding distribution comes from sustained content rather than launch tail.

**Founder-name pitches to press outlets.** Rejected per founder anonymity preference. All newsletter and press pitches are brand-only, text-based, no video calls, no interviews. The friction of anonymity with some outlets (which expect founder bylines) is accepted.

**Paid influencer or creator partnerships at V1.** Rejected. The cost and the anonymity friction are not justified given the organic strategy is expected to clear the Layer 1 success thresholds. Reconsidered at V1.5 or once paid acquisition is generating revenue meaningfully above spend.

**Tier 4 subreddit posting (r/digitalminimalism, etc.).** Rejected. These subreddits are openly hostile to new apps and would generate backlash rather than signups.

**Posting in r/getmotivated.** Rejected. Wrong tone for the brand voice.

**Heavy ASO investment at launch.** Rejected in favor of light ASO at launch and review at Month 2 once App Store Connect data is available. Premature ASO investment without data is guesswork.

**LaunchList, Getwaitlist.com, or other third-party waitlist tools.** Rejected. The custom-built waitlist landing page preserves the cinematic Three.js experience locked in Layer 4 without third-party visual artifacts. Backend storage in Supabase and email delivery via Resend leverage existing infrastructure.

**Public referral leaderboard, referral badge system, or in-app referral promotion.** Rejected as gamification mechanics inconsistent with Layer 2's anti-gamification posture. The quiet referral program embedded in the settings panel is the alternative.

**Reactivation campaigns at 30, 60, or 90 days post-cancellation.** Rejected per Layer 5 and reconfirmed here. The single 48-hour win-back survey email is the only proactive win-back attempt.

**Multi-touch press release distribution (PR Newswire, Business Wire).** Rejected. Cost is high, signal-to-noise is poor for consumer apps, and the press wire surface conflicts with the dignified brand posture.

**Triggering pricing experiments at the Month 3 checkpoint.** Rejected per founder direction. All experimentation deferred to V3.

**Automated alerting infrastructure for KPI thresholds.** Rejected per founder direction. The four operative measures are reviewed manually in the weekly dashboard sweep. No code-level triggers, automated emails, or alert systems are built around conversion-rate or churn-rate thresholds.

## What's Next

Layer 6 closes the brainstorming phase. The next phase per the Project Overview is Phase 2: Product Requirements Document and Technical Specification (Project Week 4).

In Phase 2, the six layer documents (Layer 1 Foundation, Layer 2 Product Scope, Layer 3 Technical Architecture, Layer 4 Experience and Identity, Layer 5 Business and Monetization, and this Layer 6 Launch and Growth) are consolidated into two artifacts: a single Product Requirements Document that serves as the source-of-truth product specification, and a separate Technical Specification that serves as the source-of-truth technical reference. Both artifacts become the documents that Claude Code loads at the start of every build session during Phase 4.

The PRD captures the user-facing product specification: who the user is, what the product does, how the user interacts with it, what the surfaces look like, what the copy says, and how the business operates. It is the document that someone evaluating the product from a user perspective would read.

The Technical Specification captures the implementation-facing technical reference: the database schema, the API endpoints, the third-party integrations, the AI architecture, the analytics events, the payment flows, the deployment infrastructure, and the operational runbooks. It is the document that someone implementing the product or operating it after launch would read.

Both artifacts pull from the six layer documents and resolve any remaining ambiguities or contradictions through founder decisions during Phase 2. The consolidation work is appropriate for Sonnet rather than Opus, since the underlying decisions are already locked and the work is primarily synthesis and formatting.

Begin the next chat by pasting the Brainstorm Master document and indicating that Phase 2 (PRD plus Technical Specification consolidation) is starting. The next chat should ask the founder to confirm any final decisions needed before consolidation begins, then produce the two consolidated artifacts in sequence.
