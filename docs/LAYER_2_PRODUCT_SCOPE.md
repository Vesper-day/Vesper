# Layer 2: Product Scope

## Layer Purpose

Layer 2 translates the foundational positioning locked in Layer 1 into a concrete, buildable product specification. Where Layer 1 answered who the product is for and what it stands for, Layer 2 answers what actually ships at launch. This is the largest decision layer of the brainstorming phase. The purpose is to make every painful tradeoff about scope before code is written, so that the build phase becomes pure execution against a written specification rather than a series of fresh decisions.

This layer produces five sets of decisions: the core architectural choice between routine generation and template customization, the final V1 pillar list with all included features, the V1.5 / V2 / V3 roadmap of what is parked but planned, the explicitly killed features that the project will never build, and the four primary user flows (onboarding, daily, weekly, edge cases).

## Working Direction From Layer 1

The product is a Life OS with local intelligence for young professionals ages 22 to 32, secondarily serving ambitious students, with a paid power-user tier for quantified-self optimizers. The voice is butler-modeled (Jarvis as reference), warm but calm and quietly competent, never referring to itself as AI and never using emojis or exclamation points. The brand aesthetic is warm darkness rather than cold darkness, evoking dimly-lit libraries at dusk and old manor studies with modern function. The product launches in the United States only at V1. Web and mobile both ship at launch. Success criteria at three months are 5,000 total signups and 100 paying subscribers.

Layer 2 builds entirely within those constraints.

## Core Architectural Decision: Templates Over Generation

The single most consequential architectural decision in Layer 2 is how the product generates routines. Three approaches were considered.

**Full AI generation** would have Claude generate every workout, meal plan, and routine from scratch for each user each day. This approach is the most flexible and gives the highest perception of personalization, but it carries substantial cost (roughly $0.05 to $0.15 per user per day in API spend, or $50 to $150 per month per 1,000 users on routine generation alone), and the per-call latency degrades responsiveness.

**Pure scheduling** would have the product schedule and remind users about routines they bring in themselves, with no creation or recommendation logic. This is cheapest by far but loses the major differentiation that the product is supposed to deliver.

**Templates with AI customization** is the chosen path for V1. The product ships with a curated library of approximately 150 workout templates tagged by goal, equipment, time available, and fitness level, and approximately 300 recipe templates tagged by dietary restrictions, cuisine, prep time, and macronutrient profile. The AI's job at runtime is to select and lightly modify the right template for the moment, rather than generate from nothing. This requires a single short AI call (selecting and adapting) instead of a full generative call, which is roughly ten to twenty times cheaper in API spend. Quality is also higher because the templates are pre-validated and AI is layering personalization on top of proven structures.

The same template-customization approach applies across fitness, nutrition, sleep routines, and mindfulness breaks. The paid optimizer tier eventually unlocks deeper AI customization, and V2 introduces fuller generative routine creation as a paid feature. V1 is exclusively templates plus light AI selection.

The energy check-in feeds this system. Energy is captured as a slider value (1 through 10) at the morning check-in, and that value scales intensity decisions: a low-energy day selects shorter workouts, easier recipes, and less aggressive task density; a high-energy day surfaces more demanding routines and a fuller schedule.

## V1 Final Pillar List

Eight pillars ship at V1.

### Pillar 1: AI Daily Plan Engine

The core intelligence of the product. The engine builds a base profile model for each user (work schedule pattern, sleep targets, fitness goals, dietary preferences, location, recurring commitments) and generates daily plan variations as diffs against that base. The base updates slowly over time as the user's habits change; the daily diff updates moment-to-moment as calendar events shift, energy levels register, and tasks complete.

The engine seeds itself from one of six structure archetypes selected at onboarding: Nine-to-Five Professional, Remote Worker, Student, Athlete-Focused, Founder Mode, and Mixed. The archetype provides a starting template that personalizes over the user's first one to two weeks.

Tasks are treated as Motion-style movable units. Each task carries a title, an estimated duration, an optional deadline, and a priority. The engine places task chunks across days, respecting calendar fixity, and continuously reshuffles when new constraints emerge. When a meeting gets added to Wednesday afternoon, in-progress task chunks displaced from that slot reflow to the next available opening within the deadline window.

Reshuffle behavior is hybrid rather than fully automatic. When the engine can resolve a conflict silently (a one-hour task simply moves from the now-blocked slot to an open later slot), it does so without prompting. When the engine cannot resolve a conflict (the day no longer holds enough hours for all committed items), it surfaces a single prompt asking the user to choose what gets cut or moved to tomorrow. The product never silently drops user commitments.

Proactive check-ins happen exclusively in-app and via Dynamic Island. Push notifications for non-medication check-ins are intentionally excluded to preserve the anti-overwhelm posture. When a block ends and the user has not marked it complete, the engine surfaces a question ("Did you complete the gym block?") and offers to reshuffle if the answer is no. This surface only appears when the user opens the app or glances at the Dynamic Island.

### Pillar 2: Seven Modules

The seven modules collectively cover the dimensions of daily life that the product schedules. Each module is independently toggleable, with the toggled-off state removing the module entirely from the mobile interface (re-enable available in settings only). The web interface is slightly more permissive, allowing disabled modules to remain visible at lower prominence for users who want broader awareness.

The seven modules are:

**Work and Tasks.** Motion-style task management. Task database with durations, deadlines, and priorities. Auto-placement of task chunks into focus blocks across the calendar. Continuous reshuffling as meetings shift. Single-day focused at V1, with multi-day cross-week rebalancing arriving in V2.

**Fitness.** Template library of approximately 150 workouts tagged by goal (strength, cardio, fat loss, maintenance, mobility), equipment (gym, home, bodyweight, dumbbells, full barbell rack), time available (15, 30, 45, 60 minutes), and level. AI selects the right template for the moment based on user goal, energy slider, recovery state, and prior day's training. Free tier delivers selected templates with light personalization. Paid tier delivers fuller AI customization including physique-specific programming and cross-references to nutrition for fuel timing.

**Nutrition.** Recipe template library of approximately 300 recipes, sourced via a combination of curated content and recipe API ingestion (Edamam or Spoonacular for food data and macros, TheMealDB for free baseline recipes). AI selects daily meals based on dietary restrictions captured at onboarding, time tolerance for cooking, food dislikes, and macronutrient targets if set. Grocery list auto-generates from the week's meal plan and routes to the user's nearest grocery via the local intelligence layer. Hydration tracking lives inside this module as a sub-feature rather than its own module.

**Sleep.** Bedtime routine prompts, wind-down rituals, target sleep duration tracking, and the integrated alarm. The alarm presents single-tap dismiss with two edge-to-edge buttons (SNOOZE and STOP) and does not require phone unlock. The energy check-in slider appears after dismiss, not before, to avoid gating the dismiss action.

**Errands and Home.** Catch-all module for to-dos, recurring chores (trash day, laundry day, plant watering), and one-off errands (pharmacy, dry cleaning, returns, mail). Errands geo-batch via the local intelligence layer, surfacing as a routed sequence rather than a flat list. Shopping (non-grocery) lives here as a reminder-based feature rather than its own module.

**Medication.** Pill timing, dose tracking, supplement scheduling, and refill reminders. Push notifications are permitted for this module specifically because the health stakes warrant intrusion. User manually enters medication name, dose, time, and frequency at module enable.

**Finance.** Bill due dates, subscription tracking, savings goal nudges, and budget check-ins. The module starts in the off state by default. When enabled, the user manually enters what is due and when. The product does not connect to bank accounts, credit cards, or financial institutions at V1 or any planned version, both because the data acquisition cost is high and because the privacy surface is significant.

### Pillar 3: Local Intelligence Layer

The differentiating capability. The layer cross-cuts every module and surfaces location-aware suggestions throughout the user's day.

V1 surfaces include grocery routing (meal plan converts to shopping list, which routes to the user's nearest stocked grocery with optional Instacart or UberEats integration for delivery), restaurant and cafe suggestions (Yelp API for data, with separate cafe surface filtered by wifi availability and quiet rating for focus blocks away from home), errands batching (groups geographically clustered errands and suggests the optimal sequence), and traffic-aware buffers (auto-adds transit time between location-bound events using mapping API distance and traffic data).

Cost containment is a primary architectural concern for the local intelligence layer. The strategy combines aggressive caching (places change slowly, so cached results refresh weekly rather than per-query), pre-fetching during onboarding (the user's nearest five groceries, three gyms, five cafes, and three pharmacies are computed once at signup and stored), rule-based logic for objective queries (distance math requires no AI), AI involvement only for subjective queries (best vibe match for tonight's dinner), free-tier API usage (Yelp Fusion's 5,000-call-per-day free tier covers low user counts; Google Places monthly free credits supplement; OpenStreetMap and Nominatim provide free POI and geocoding data as fallback), and Mapbox routing over Google Maps routing (similar quality, materially cheaper).

### Pillar 4: Calendar Layer

Two surfaces. Google Calendar sync at V1 for users who already maintain an external schedule, and a built-in calendar at V1 for users who have not been planning their days at all. Both share the same underlying data model and feed the same plan engine.

The built-in calendar is built on top of a forked open-source foundation rather than implemented from scratch. Strong candidate libraries include react-native-calendars for mobile (MIT license, well-maintained, widely used) and react-big-calendar or FullCalendar for web (FullCalendar's standard scheduler is free; premium features cost). The fork-and-customize approach saves several weeks of pure interface work and yields a calendar surface that already handles edge cases (timezone math, recurring events, day-grid rendering).

Apple Calendar sync is deferred to V1.5. Outlook is V2.

### Pillar 5: Mobile and Web Platform

Both surfaces ship at V1, with iOS as the only mobile target. Android is deferred to V1.5 post-launch, both because Dynamic Island has no Android equivalent (requiring a different implementation strategy that is best built once the iOS version has proven product-market fit) and because focusing on a single mobile platform reduces V1 build cost meaningfully.

Mobile is no longer display-only. This is a refinement of the Layer 1 platform strategy. The mobile surface supports real editing including drag-and-reorder of blocks, full block detail views, mark-complete and skip and reschedule actions, the natural-language input surface, and module enable and disable toggles. The mobile surface remains optimized for execution rather than configuration, but the constraint of mobile being purely a display surface has been lifted.

Web remains the primary configuration surface. Profile setup, deep module preference editing, weekly planning sessions, integrations management, billing and account settings, and the paid-tier dashboards all live primarily on web. Both surfaces share the same Supabase-backed data layer with live sync between devices.

### Pillar 6: Natural-Language Input Surface

The product accepts single-turn natural-language commands for plan edits ("move gym to 7pm," "add pick up package at 3," "remind me to call Mom tomorrow"). The user-facing implementation does not take the form of a traditional chat bar with a typing area at the bottom and a response line above. The experience should feel like part of life rather than a piece of technology.

Specific implementation choices (voice input as primary, a subtle slide-up surface, a long-press gesture on the plan view, or some combination) are delegated to Layer 4 (Experience and Identity), where the broader interaction language for the product is designed. For Layer 2's purposes, the pillar is locked: natural-language single-turn commands are supported on both mobile and web, and the interaction surface is designed for grace rather than for chat-bot affordance.

### Pillar 7: Adaptive Onboarding

The onboarding flow balances tutorial and freedom. The product does not subject every user to ten minutes of guided setup, and it does not throw every user into an empty interface with no direction. Instead, the flow branches based on the user's existing planning behavior, captured by a single archetype selection.

The opening screen is welcoming in voice, slightly warmer than the rest of the product's tone, but still formal. The reference direction is "Good evening — let's get you set up. I'll handle the heavy lifting" rather than something more clipped or impersonal.

After authentication (email, Google, or Apple), the user selects one of six structure archetypes from a single screen displaying simple tab labels without detailed descriptions. The archetype selection determines the branch.

For calendar-connected users (those whose archetype implies an existing planning surface), the flow proceeds leanly: Google Calendar connect, location capture, sleep target, two to three primary goals, module enable selection with all seven modules defaulting on, module-specific quick preferences, trial confirmation, and first plan generation. Total time five to eight minutes.

For users without existing planning behavior, the flow includes a tutorial branch covering the built-in calendar: walkthrough of how to enter fixed weekly events, location capture, sleep target, two to three primary goals, module enable selection, module-specific quick preferences, trial confirmation, and first plan generation. Total time ten to fifteen minutes.

Both branches conclude with a brief four-to-five-screen tour explaining how to mark blocks complete, how to use the natural-language input surface, where the Dynamic Island integration lives, and where to find the weekly planning view. The tour is skippable.

The two-week free trial includes everything; no V1 feature is gated behind paid plans during the trial period.

### Pillar 8: Dynamic Island Integration

The Dynamic Island serves as the always-present awareness surface that lets the butler stay quietly visible without intruding. The user does not need to open the app to know what is current; the next block appears in the Dynamic Island, and tapping expands to a richer summary.

Apple's Live Activities (which power Dynamic Island content) have an active duration cap of approximately eight hours, with another four hours in a dismissed-but-recoverable state. A single Live Activity cannot reasonably persist across a full waking day. The product handles this by managing one Live Activity per block lifecycle: when a block begins, the server pushes a start to the user's device; when the block completes (manually or by time), the server pushes an end and starts the next block's Activity if the next block is within an appropriate window.

This lifecycle is server-driven through the iOS 17.2+ Live Activity Push Start mechanism, which allows the product's backend to start a Live Activity on the user's device without requiring the user to have the app actively open at the moment. The user grants notification permissions during onboarding, and from then forward the product's backend can drive Dynamic Island state autonomously. The Apple system requirement that the user has launched the app at least recently is met trivially by any active user.

The mindfulness module (originally proposed as a separate V1.5 module) folds into Dynamic Island integration. Brief breathing or reset cues surface as Live Activities during designated quiet moments rather than as full module content.

Android receives the Dynamic Island equivalent via persistent ongoing notification in V1.5, after the iOS surface is proven.

## V1.5 Roadmap

V1.5 begins immediately after public launch and runs through the first four months of public availability. The intent is to layer in features that were genuinely close to V1 but cut for scope discipline.

V1.5 includes voice input as a primary interaction mode (replacing or augmenting the natural-language surface specified in Layer 4), email AI-read for scheduling (with two confirmation gates: explicit opt-in to enable the feature at all, and per-action confirmation before any individual scheduling action), the default quantified-self dashboard on the paid tier, Apple Calendar sync, Android Dynamic Island equivalent via persistent ongoing notification, and the mood module (a light mood log tied to the existing energy check-in rather than a full journaling surface).

## V2 Roadmap

V2 covers months four through ten post-launch. Features in this phase are substantive but each represents weeks-to-months of dedicated build time.

V2 includes wearable integrations (Fitbit, Oura, Whoop, Apple Health, Google Fit), an Apple Watch companion app, the learning module (language practice blocks, course progress tracking, reading time, podcast queues), the travel module (trip mode with packing checklists, jet lag scheduling, transit timing), the career and work admin module (follow-ups, applications, networking touches, expense logging beyond pure calendar work), the hobbies module (creative practice block scheduling without routine creation), Outlook Calendar sync, multi-day planning views on web, and the introduction of fuller AI routine generation as a paid tier feature alongside the existing template-customization baseline.

## V3 Roadmap

V3 covers year two and beyond. The strategic question of whether to expand internationally, build a third-party module API, or invest in deeper personalization is resolved here based on traction signal.

V3 candidates include custom dashboards on the paid tier (drag-and-drop dashboard tiles, user-selected correlations), correlation insights ("you focus thirty percent longer on days after strength training"), English-speaking international expansion (Canada, United Kingdom, Australia), the pets module, a review of whether to revive the social and relationships module that was killed for V1 and V1.5, and speculative work toward a third-party module developer API if traction warrants.

## Killed Features

The following features are explicitly excluded from the product's roadmap and will not be built. Each is documented with the reasoning so the decision is not revisited.

**Social feeds, sharing, and public profiles.** Direct conflict with the calm butler ethos. Building any kind of social surface would dilute the product's positioning and introduce moderation overhead.

**Team, family, and shared plans.** Different workflow, different pricing psychology, distracts from single-user focus.

**Habit tracking with streaks.** Gamification clashes with the refined and dignified tone. Streak shame on miss is the opposite of anti-overwhelm.

**Browser extensions.** Niche utility, significant build cost, no clear value to the core daily workflow.

**Full email inbox features.** Out of scope; the AI-read for scheduling feature (V1.5) is permitted because it serves the scheduling mission, but the product will not become an inbox client.

**AI chat as primary interface.** The butler delivers; the butler does not converse for the sake of conversing. The natural-language input surface accepts single-turn commands and does not maintain conversational state across turns.

**Home screen widgets.** Defeats the purpose of a glance surface. If the user has to scroll the home screen to find the widget, they have already remembered the thing the widget was supposed to remind them about. Dynamic Island is the right answer.

**Forums and community surfaces.** Hosting is a chore and the ethos mismatch is severe.

**Gamification (badges, points, leaderboards).** Same reasoning as streaks.

**In-app therapy or counseling features.** Regulatory risk, scope creep. Real therapist appointments fall under the existing calendar and are handled like any other appointment.

**E-commerce or direct purchase of products within the app.** The product suggests and links out; it does not own checkout.

**Journaling features as a full surface.** Day One territory, not scope. The light mood log in V1.5 is not journaling.

**Pomodoro or timer-based focus features.** Too granular; breaks the butler hands-off feel. Focus blocks are blocks of time; how the user occupies them inside is the user's business.

**Social and relationships module.** Killed for V1 and V1.5 because the data acquisition cost is high (birthdays, contacts, relationship metadata are all hard to obtain cleanly) and the value is uncertain. Reviewed for revival at V3 based on user demand signal.

**Bank account integrations within the finance module.** Never. Privacy surface is significant and the product's positioning does not require it.

## Open-Source Components to Fork

The build leverages open-source foundations wherever they meaningfully save time. Candidates identified in Layer 2 include the following.

For calendar interface, react-native-calendars for mobile (MIT) and react-big-calendar or FullCalendar standard scheduler for web. For mapping, react-native-maps (free) or Mapbox SDK. For drag-and-reorder block editing, react-native-draggable-flatlist (MIT). For recipe seed data, TheMealDB free API as a baseline, supplemented by Edamam or Spoonacular for nutritional metadata. For workout template seed data, ExerciseDB (free API with over 1,000 exercises tagged by muscle group). For date and time pickers, react-native-date-picker. For charts and visualizations on the paid tier dashboards, Victory Native or react-native-svg-charts. For authentication interface patterns, Supabase auth UI components and Clerk's open examples as reference. For markdown rendering (recipes, settings explanations), react-native-markdown-display. For animations, Reanimated (the standard in modern React Native). For state management, Zustand (significantly lighter than Redux for a project of this size).

The intent is not to assemble a product from libraries but to skip the work of reimplementing solved problems. Visual identity, interaction patterns, and core engine logic are all built from scratch; commodity infrastructure is forked and restyled.

## User Flows

### Onboarding Flow

The onboarding flow follows the adaptive structure specified in Pillar 7.

The user lands on a welcome screen in slightly-warmer-than-baseline butler tone. Authentication completes via email, Google, or Apple sign-in. The user selects from one of six archetype tabs (Nine-to-Five Professional, Remote Worker, Student, Athlete-Focused, Founder Mode, Mixed) on a single screen with simple labels and no detailed descriptions.

The archetype selection routes the user into one of two branches. The calendar-connected branch (for users whose archetype implies they already maintain a planning surface) proceeds through Google Calendar connect with permission grant, location capture, sleep target entry (bed time and wake time), two to three primary goal entries, module enable selection with all seven modules defaulting on, brief per-module preference capture (fitness goal type, gym versus home, days per week; nutrition dietary restrictions, cooking time tolerance, dislikes; sleep target hours, wake and bed times; errands recurring items; medication entries if module enabled), trial confirmation, first plan generation with butler-voice loading copy, the four-to-five-screen feature tour with skip available, and landing on the day's plan.

The no-existing-plan branch adds a built-in calendar walkthrough between authentication and the location step, in which the user enters their fixed weekly events (work hours, classes, recurring appointments) into the product's native calendar. The remainder of the flow matches the calendar-connected branch.

### Daily Journey

The daily journey is the returning user's central interaction with the product.

The morning begins with the integrated alarm. The alarm presents two edge-to-edge buttons (SNOOZE and STOP) and dismisses on a single tap without requiring phone unlock. After dismiss, the energy check-in slider (1 through 10) appears as a single screen with a ten-second target time and a skip option (the slider is prompted but not gated).

The morning brief follows. Today's plan displays with the next three blocks visible above the fold, weather for the day, and commute time to the first location-bound event. The brief is the primary surface the user sees first thing in the morning.

Through the day, individual blocks expand on tap to show details (recipe steps for meal blocks, workout details for fitness blocks, task lists for focus blocks, errand routing for errands blocks). The user marks blocks complete, skipped, or rescheduled per block. The Dynamic Island surfaces the current block and the next block at all times during the day, managed server-side via Live Activity Push Starts and updates. The natural-language input surface is persistently available, accepting commands like "move gym to 7pm" or "add pick up package at 3pm."

When a block ends without being marked complete, the engine proactively asks the user (in-app and via Dynamic Island only, never push notification) whether the block was completed. If the answer is no, the engine offers to reshuffle the missed block later in the day. When the engine can resolve the reshuffle silently within remaining time, it does. When time is insufficient, it surfaces a single prompt asking what to cut or move to tomorrow.

The evening produces an end-of-day summary: blocks completed, blocks missed, the day's energy trend, and a preview of tomorrow's plan. The sleep module surfaces the wind-down routine if enabled. Bedtime hits and the product goes silent; no notifications fire until the next morning's alarm.

### Weekly Journey

The weekly journey is the planning session, ideally completed on Sunday and ideally completed on the web surface.

The product surfaces a soft Sunday morning prompt asking whether the user wants to plan the week. The prompt is dismissible and the planning session can be skipped, in which case the product falls back to the previous week's template combined with the current calendar.

When engaged, the session proceeds through five steps. First, a review of the previous week (completion percentage, top reasons for missed blocks if surface-able, mood and energy trends on the paid tier). Second, entry of this week's three to five priorities, with AI suggesting based on outstanding tasks. Third, confirmation or editing of fixed events for the week. Fourth, module adjustments (e.g., "traveling Wednesday through Friday, pause gym," "dinner out Thursday"). Fifth, AI generation of the week's template, which the user reviews and either accepts as-is or tweaks.

The session targets fifteen to twenty minutes of engaged time. The product makes no demand on the user to complete the session; missing the session simply falls through to the default.

### Edge Cases

Multiple edge cases require deliberate handling.

When a user opens the app after three or more days of absence, the product greets them with "Welcome back" and surfaces today's plan immediately. No streak loss notification, no shame copy, no guilt-trip about lapsed engagement. An optional one-line "anything change?" prompt allows the user to inform the product of context shifts.

When an integration breaks (most commonly Google Calendar disconnecting due to token expiry), the product surfaces a persistent banner indicating the broken integration and prompting reconnection. The plan continues to generate from cached calendar data and built-in calendar data; no hard failure occurs.

When AI plan generation fails (model timeout, API error, malformed response), the product falls back to the previous week's template applied to the current day, with a butler-tone apology line ("Working from your usual routine today — I'll have something fresh tomorrow"). Error codes are never exposed.

When a user rejects the generated plan entirely and triggers regeneration, the product offers an alternative archetype suggestion. After three regeneration attempts without acceptance, the product surfaces a different kind of prompt: "Let's talk — what's not working?" rather than continuing to regenerate.

When the device is offline, the cached plan remains visible and any edits the user makes queue locally. On reconnect, edits sync with last-write-wins conflict resolution.

When a user enables a new module mid-trial, a brief one-to-two-screen mini-onboarding for that module fires, and the module integrates into the plan starting the next day.

When the trial period ends, the product surfaces butler-voice reminders at three days before, one day before, and on the end date. The reminders mirror the user's state ("Three days left in your trial. You're finding a rhythm.") rather than push urgency. The end-date screen offers two options without persuasion friction: continue or end. On end, the product enters a read-only continuation mode for seven days during which the user can still view their plan but cannot edit or generate new plans, framed in continuation language ("Your data stays here for seven days, then archives for thirty more.") rather than punitive lockout copy. After seven days the account archives (not deletes) for thirty days, with a resubscribe option available throughout. The specific copy library for all trial-end, cancellation, and re-engagement states lives in the Layer 4 deliverable and is the single source of truth. The trial-to-paid price is $19.99 USD per month, monthly billing only at V1, with annual billing deferred to V2 or V3.

When a subscription payment fails, Stripe handles dunning. The product surfaces a soft butler-voice banner ("Your payment didn't go through. I'll keep things running while you sort it out."). After seven days of failed dunning, the product enters the same read-only continuation mode as trial-end, with matching continuation framing.

The cancellation flow is deliberately easy and not adversarial. No retention modals offering last-minute discounts, no "are you sure?" friction screens, no surveys at the cancellation moment. The flow exits cleanly with butler acknowledgment ("Of course. Your data will be here for thirty days if you'd like to come back."). A win-back survey arrives 48 hours later via email asking what could have improved, framed as a no-oriented question ("Was there anything we could have done differently?") that respects the user's exit decision while gathering retrospective data.

When multiple devices edit the same data simultaneously, the server timestamp wins and the other device surfaces a toast indicating the conflict ("Your other device edited this — refreshed").

## What Was Considered and Rejected

The following alternatives were actively considered during Layer 2 and rejected, recorded so they are not revisited.

Full AI routine generation as the V1 architecture was rejected for cost reasons, with templates plus customization chosen instead. The full-generation approach is preserved for V2 paid-tier introduction.

Push notifications as a general engagement surface were rejected. Push is permitted only for the medication module where health stakes warrant intrusion. All other proactive cues happen in-app or via Dynamic Island.

A traditional chat-bar interface for the natural-language input surface was rejected on tone grounds. The product does not want to feel like a chat-bot wrapper. Specific surface design is delegated to Layer 4.

Home screen widgets were rejected hard. Dynamic Island is the correct glance surface; widgets require the user to scroll the home screen, which defeats the purpose of an ambient reminder.

A V1 social and relationships module was rejected on data acquisition cost grounds (birthdays, contacts, relationship metadata are difficult to obtain cleanly) and is held for V3 review.

Bank account integrations within the finance module were rejected on privacy and complexity grounds.

In-app therapy or counseling features were rejected on regulatory grounds.

A fully-automatic reshuffle behavior (engine drops user commitments silently when conflicts arise) was rejected. The hybrid approach (silent when easy, prompted when cutting required) is the locked behavior.

A free permanent tier was rejected in favor of the two-week trial converting to paid. The trial includes everything, not a stripped-down version.

Cross-platform Dynamic Island delivery at V1 was rejected. iOS only at V1; Android persistent notification arrives V1.5.

## Updates Required to Other Documents

Three inconsistencies between Layer 2 and existing documents require either an update to those documents or an explicit acknowledgment that the documents are now out of date.

The Layer 1 platform strategy describes mobile as "display-first and intentionally minimal in its editing capabilities." Layer 2 expands mobile to include real editing (drag-and-reorder, full edits, natural-language input). Layer 1 should be updated, or the inconsistency acknowledged in a revision note.

The Project Overview document states the founder's time investment as fifteen to twenty hours per week. The founder has since indicated approximately eight hours per day (roughly fifty-six hours per week), which materially compresses the timeline. Project Overview should be updated to reflect actual capacity, and the build phase sequencing rethought accordingly.

The Project Overview document lists Build Month 5 as the introduction of the mobile app shell, implying mobile is a later phase of the build. Layer 2 commits to mobile shipping at V1 alongside web. The build sequence in Project Overview should be restructured so that mobile work is interleaved with web work from Build Month 1 or 2 rather than introduced in Build Month 5.

The Project Overview also describes the founder's AI subscription as Claude Max 5x ($100 per month). The founder has indicated the actual plan is Claude Pro ($20 per month). Project Overview should be updated to reflect the actual subscription level, with awareness that rate-limit windows are more constrained on the Pro plan than the Max 5x plan, which may affect the cadence of high-intensity Claude Code sessions.

## Open Items From Layer 2

A small number of items are intentionally deferred and need resolution at later layers.

The specific user-facing implementation of the natural-language input surface (voice input, slide-up panel, long-press gesture, or combination) is deferred to Layer 4 (Experience and Identity), where the broader interaction language is designed.

The specific dollar amount of the post-trial subscription, the discount structure if any for annual versus monthly billing, and the exact feature split between the free trial and the post-trial paid tier are deferred to Layer 5 (Business and Monetization). Layer 2 locks only that there is a two-week trial including all features and that the post-trial state is paid-only with no permanent free tier.

Resolved in Layer 6. Android waitlist users receive the launch-day email with web-app-first messaging and a soft "Android app in development" note without specific timeline commitment. Friend-assisted Android development begins immediately post-V1 launch rather than being deferred to V1.5.

## What's Next

**Layer 3: Technical Architecture.** Tech stack selection with reasoning across Next.js for web, React Native for mobile, Supabase for database and authentication, Stripe for payments, and the specific AI model strategy (Claude Sonnet versus Haiku for different roles within the engine). Full database schema design covering user profiles, base models, daily plans, task units, module state, template libraries, completion data, and subscription state. Authentication strategy across web and mobile with social login support. AI architecture specification including how user context is constructed and passed in, prompt template structure with versioning, fallback handling for AI errors, caching strategy for repeated requests, and cost-per-user estimates against the template-customization model locked in Layer 2. Integration list with priorities and effort estimates (Google Calendar at V1, Apple Calendar at V1.5, Apple Health and Google Fit at V2, mapping APIs, grocery delivery APIs, Yelp API). Live Activity Push Start infrastructure design for the Dynamic Island integration locked in Pillar 8. Hosting and infrastructure choices including Vercel tiers, Supabase tiers, and the thresholds at which paid plans get triggered. Data privacy and storage approach including encryption at rest, deletion on account closure, logging for debugging, and GDPR and CCPA compliance basics.

Layer 3 is an Opus-tier session because decisions made here are the hardest to change later. Begin the next chat by pasting the Brainstorm Master document, the Layer 1 document, and this Layer 2 document for full context.
