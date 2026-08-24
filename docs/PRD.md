# Vesper — Product Requirements Document

**Version:** 1.0
**Phase:** 2 (PRD + Technical Specification consolidation)
**Status:** Complete

---

## Table of Contents

1. [Product Summary](#1-product-summary)
2. [V1 Feature Inventory](#2-v1-feature-inventory)
3. [User Flows](#3-user-flows)
4. [Core Interactions](#4-core-interactions)
5. [Content and Tone](#5-content-and-tone)
6. [Module Specifications](#6-module-specifications)
7. [Subscription and Payment](#7-subscription-and-payment)
8. [Out of Scope for V1](#8-out-of-scope-for-v1)
9. [Open Items](#9-open-items)

---

## 1. Product Summary

Vesper is a daily planning application built on a single promise: wake up with your day already planned. It combines AI-generated scheduling, a set of life-domain modules activated progressively over time, and a location-aware intelligence layer into one unified plan that the user reviews and approves the evening before. The anchor is the Vesper hour, a roughly five-minute close-of-day ritual in which the butler presents what it handled today alongside a draft of tomorrow's plan for approval; the morning then delivers that approved plan with no planning left to do. The product is built for adults aged twenty-two to thirty-two in the United States who carry meaningful professional and personal schedules but lack a system for integrating them. Vesper generates each day's plan automatically, presents it in a composed and calm interface, and allows the user to modify it through natural-language commands rather than manual rearrangement. The underlying metaphor is a butler: an intelligent presence that handles the logistics of daily life without requiring direction, surfaces what matters without overwhelming, and recedes when it is not needed. The application ships as both an iOS mobile application and a web application, with the mobile surface optimized for daily execution and the web surface optimized for configuration, planning, and review. Both surfaces are available from the first day of public availability.

The target user is a young professional in their first decade of career who manages work responsibilities, fitness goals, nutrition, errands, and finances simultaneously but has not consolidated them into a single system. They are likely already using a calendar (Google Calendar is the primary integration target) and may be using one or two point solutions — a task manager, a fitness app — but these tools do not communicate with each other and do not produce a coherent daily plan. Vesper replaces the cognitive overhead of maintaining separate systems with a single intelligent plan that accounts for all seven domains of daily life. The value proposition is not that Vesper makes users more productive in any one domain; it is that Vesper removes the daily decision-making tax of figuring out what to do next.

Vesper is not a chat application and does not maintain conversational state. It is not a journaling or mood-tracking surface. It is not a habit-streaking application. It has no social features, no shared plans, no public profiles, and no community surface. It does not connect to bank accounts or financial institutions in any version, planned or speculative. It does not use gamification mechanics of any kind — no streaks, badges, points, or leaderboards exist in the product. It does not offer a permanent free tier. It is not a general-purpose task manager, a calendar replacement, or a Pomodoro timer. The product does one thing with precision: it generates and maintains an integrated daily plan, surfaces it calmly, and allows the user to adjust it with minimal friction.

---

## 2. V1 Feature Inventory

Seven pillars ship at V1. Each is described below at the level of precision needed to implement it. The location-aware intelligence layer is not a separate pillar; it feeds the AI plan engine and the calendar surfaces rather than standing alone.

### Pillar 1: AI Daily Plan Engine

The plan engine is the core of the product. It maintains a base profile for each user — encoding work schedule patterns, sleep targets, fitness goals, dietary preferences, recurring commitments, and location — and generates each day's plan as a set of modifications against that base. The base updates gradually as the user's habits change over days and weeks; the daily plan updates in near-real time as calendar events shift, the energy slider is submitted, tasks are completed, and natural-language commands are received.

At onboarding, the engine seeds the user's base profile from one of six structure archetypes: Nine-to-Five Professional, Remote Worker, Student, Athlete-Focused, Founder Mode, and Mixed. The archetype provides the starting template shape — a skeleton of when certain block types tend to appear relative to each other — which the engine then personalizes as real behavioral data accumulates. Plan quality is already strong on day one because the prompt-context architecture carries most of the signal that determines output quality; the archetype skeleton plus the day-one base profile is sufficient for a competent first plan, with personalization sharpening output through the trial week and beyond. The user does not see the archetype label after onboarding; it functions as a silent initialization parameter. While the archetype label stays hidden, the engine's ongoing inferences are surfaced through a periodic "butler's notebook" entry that states what it has learned and offers a one-tap confirm or correct, so personalization is visible rather than silent.

Tasks within the plan are treated as movable units. Each task carries a title, an estimated duration, an optional deadline, and a priority level. The engine places task chunks across the available day by respecting the fixity of calendar events (meetings, classes, recurring appointments) and filling available open time with task work in priority and deadline order. When a new calendar event is added mid-day — a meeting that was just scheduled, a blocked slot — any task chunk displaced by that event reflows to the next available opening within its deadline window. This reshuffling happens silently when the engine can resolve the conflict without user input. When the remaining day no longer holds enough time for all committed items, the engine does not silently drop anything; it surfaces a single prompt asking the user to choose what gets cut or moved to tomorrow. That prompt is the only interruption the engine initiates for scheduling conflicts.

The engine generates plans using a template-customization architecture rather than free-form generation. Vesper ships with a library of approximately 150 workout templates (tagged by goal, equipment, time available, and fitness level) and approximately 300 recipe templates (tagged by dietary restrictions, cuisine, prep time, and macronutrient profile). Each morning, the engine selects the most appropriate template from the relevant filtered subset and applies light personalization — adjusting sets, reps, timing, portions, or ingredient swaps — based on the user's current context. This approach produces lower AI inference costs and more consistently validated outputs than fully generative routines; template selection and light modification requires a single short inference call rather than a full generative sequence.

The energy slider submitted each morning (a 1-through-10 self-assessment) scales intensity decisions across all modules for that day. A score of three or below selects shorter workouts, simpler recipes, and a less aggressive task density. A score of eight or above surfaces more demanding routines and a fuller schedule. The scaling relationship is applied by the engine's context-construction step before the AI inference call; the AI receives a pre-filtered template candidate set that already reflects the energy signal.

When an AI inference call fails — due to a timeout, an API error, or a malformed response — the engine executes a graceful degradation sequence. It retries once after 1.5 seconds, then retries with a simplified prompt after 3 seconds, and if both retries fail, it serves the previous week's same-day template with the butler-voice fallback line: "Working from your usual routine today — I'll have something fresh tomorrow." No error code or technical language is ever presented to the user.

### Pillar 2: Seven Modules

The seven modules are independently toggleable subsystems that collectively cover the domains of daily life the product schedules. Modules activate progressively rather than all at once: a new user begins with Work and Tasks and the calendar always on, plus a single lifestyle module chosen at onboarding, and the butler proposes additional modules one at a time over the following weeks as the user's rhythm stabilizes. A user who toggles a module off removes it entirely from the mobile interface; re-enabling requires navigating to settings. On the web interface, disabled modules remain visible at lower prominence to give users who monitor multiple domains a broader view. Each module is described in full below.

**Work and Tasks.** The work module is the task management subsystem. Users create tasks with a title, an estimated duration, an optional deadline, and a priority. The engine places task chunks into focus blocks throughout the available day, continuously reshuffling as the calendar changes. At V1, task placement is single-day focused: the engine plans today and previews tomorrow but does not perform cross-week rebalancing. Cross-week rebalancing arrives at V2. The work module is always on, alongside the calendar, and is the module with the highest expected usage rate across all user archetypes.

**Fitness.** The fitness module schedules workout blocks from a curated template library of approximately 150 workouts. Each template is tagged by goal (strength, cardio, fat loss, maintenance, mobility), equipment required (gym, home, bodyweight, dumbbells, full barbell rack), time available (15, 30, 45, or 60 minutes), and difficulty level. The engine selects the appropriate template each morning based on the user's stated goal, the energy slider value, estimated recovery state from the prior day's workout, and the equipment available at the user's registered location. Users can swap a suggested workout with a single command ("give me something shorter" or "I want a home workout today") and the engine presents the next-best match without requiring the user to browse the library. Fitness is one of the lifestyle modules a user can choose to start with at onboarding or add later when the butler proposes it, rather than being on by default.

**Nutrition.** The nutrition module schedules meal blocks from a recipe template library of approximately 300 recipes. Recipes are tagged by dietary restrictions (vegetarian, vegan, gluten-free, dairy-free, and similar), cuisine style, prep time, and macronutrient profile. The engine selects daily meals based on dietary restrictions captured at onboarding, the user's stated cooking time tolerance, recorded food dislikes, and macronutrient targets if set. Grocery list generation is automatic: the week's meal plan converts to an itemized shopping list as a simple checklist. The list does not route to a specific store. Hydration tracking lives inside the nutrition module as a sub-feature; it does not have its own module toggle. Like the other lifestyle modules, nutrition is activated when the user chooses it at onboarding or accepts it from a later butler proposal rather than being on by default.

**Sleep.** The sleep module manages the full bedtime arc. It schedules a wind-down routine block in the evening (configurable; the default is 30 minutes before the user's stated bedtime), surfaces a bedtime reminder when the wind-down period begins, and offers an optional alarm. The alarm is an opt-in enhancement rather than the default morning entry point; the morning knock carries the wake-entry role at lower stakes, and users who want a true alarm enable it explicitly. When enabled, the alarm is designed for one-tap dismissal without requiring the phone to be unlocked; it presents two edge-to-edge buttons labeled SNOOZE and STOP. After the alarm is dismissed, the energy check-in slider appears as the next screen, not before, so that the alarm dismissal is never gated. The product enforces quiet hours derived from the user's stated sleep target (bedtime to wake time), during which no notifications fire except medication reminders, which fire at their scheduled time by default unless the user has set a per-medication shift out of quiet hours. Like the other lifestyle modules, sleep is activated by user choice at onboarding or a later butler proposal rather than being on by default.

**Errands and Home.** The errands module manages to-dos, recurring chores, and one-off errands. Recurring chores (trash day, laundry, plant watering) are entered once and appear automatically on the appropriate day each week. One-off errands (pharmacy, dry cleaning, returns) are added on demand. Errands present as a flat checklist with optional deadlines and recurring schedules; geographic batching and route optimization are not V1 features. The module also manages non-grocery shopping reminders as reminder-based nudges, not as a checkout surface. Like the other lifestyle modules, errands is activated by user choice at onboarding or a later butler proposal rather than being on by default.

**Medication.** The medication module tracks pill timing, dose schedules, supplement scheduling, and refill reminders. The user manually enters each medication with a name, dose, time of day, and frequency at module setup. Medication reminders are one of three permitted push categories, alongside payment-failure alerts and the opt-in morning knock, because the health stakes of a missed medication dose justify the intrusion. Medication reminders fire at their scheduled time by default, including inside quiet hours; shifting a reminder out of quiet hours is an explicit per-medication opt-in, because silently delaying a time-critical dose is the unsafe behavior. Medication data is never shared with any third party, never reported to health insurance, and not synced to health platforms at any planned version. Like the other lifestyle modules, medication is activated by user choice at onboarding or a later butler proposal rather than being on by default.

**Finance.** The finance module tracks bill due dates, subscription renewals, savings goal nudges, and budget check-ins. The user manually enters what is due and when; the module operates entirely on user-entered data. The product does not connect to bank accounts, credit cards, or financial institutions at V1 or in any currently planned version. The finance module is the only module that starts in the off state by default; users who want financial awareness enable it explicitly. When enabled, bill reminders appear one day in advance with butler-voice copy.

### Pillar 3: Calendar Dual Surface

Two calendar surfaces coexist and feed the same underlying plan engine. The first is Google Calendar sync, serving users who already maintain a schedule in Google Calendar. After OAuth authentication, the product reads existing events, respects them as fixed blocks in the plan, and writes new plan-generated blocks back to the user's calendar as a dedicated Vesper calendar layer. Conflicts between calendar events and plan-generated blocks are surfaced to the user when they cannot be resolved silently. The second surface is a built-in native calendar, serving users who have not been planning their days in any external tool. The built-in calendar allows entry of fixed weekly events — work hours, classes, recurring appointments — and routes them through the same plan engine as Google Calendar events.

Both surfaces share the same Supabase-backed data model and sync in real time across devices. Apple Calendar sync is deferred to V1.5. Outlook sync is deferred to V2. Users can connect Google Calendar and use the built-in calendar simultaneously if they have events in both; the engine merges them into a single unified view.

### Pillar 4: Mobile and Web Platform

Both the iOS mobile application and the web application ship at V1. They are parity surfaces in terms of data access — both connect to the same backend and reflect the same plan state in real time — but they are differentiated by their intended use context.

The mobile surface is the execution surface. A user's primary daily interactions happen on mobile: viewing the morning plan, marking blocks complete or skipped, submitting the energy slider, glancing at the Dynamic Island, and issuing natural-language commands to reschedule or add items. The mobile surface supports full editing including drag-to-reorder blocks, complete block detail views (recipe steps for meal blocks, workout details for fitness blocks, a flat errand checklist ordered by deadline for errand blocks — no routing or sequencing, as geographic batching and route optimization are not V1 features), and module enable and disable toggles.

The web surface is the configuration and planning surface. Profile setup, deep module preference editing, weekly planning sessions, integrations management, billing and account management, and review sessions (completion trends on the paid tier at V1.5) all live primarily on web. The web surface's larger viewport makes the weekly planner and multi-column block editing more comfortable than on mobile.

Both surfaces share live sync through a Supabase real-time channel. An edit made on mobile — marking a block complete, rescheduling a task — appears on the web surface within seconds without a manual refresh. Conflict resolution when both surfaces modify the same block simultaneously follows a last-write-wins rule, with the conflicting state surfaced to the user via a butler-voice acknowledgment line.

Android is deferred to V1.5. The Dynamic Island integration has no Android equivalent; when Android ships, the ambient awareness surface is implemented as a persistent ongoing notification.

### Pillar 5: Natural-Language Input Surface

The product accepts single-turn natural-language commands for plan modifications. This input surface does not take the form of a chat bar. There is no persistent text field at the bottom of the screen, no separate "talk to Vesper" button, and no conversational state maintained across commands. The interaction is single-turn: the user issues one command, the engine acts on it, and the result appears in the plan.

The input surface is the ambient butler line — a contextual italic phrase rendered at the bottom of relevant screens that doubles as the touch target for issuing commands. Tapping the butler line slides up a single-field input sheet where the user types a command. A long-press on the butler line begins voice recording immediately, displaying a waveform visualization in place of the text while the user speaks; releasing the press submits the recording for processing. No microphone button is separate from the butler line; the long-press gesture is the voice input affordance.

Accepted command types include rescheduling a block ("move gym to 7pm"), adding a new item to the plan ("add pick up dry cleaning at 3"), removing a block ("drop the afternoon run"), and adjusting a parameter ("make today's workout shorter"). When a command is ambiguous — for instance, "add lunch" when the nutrition module is disabled — the engine returns a clarifying prompt in butler voice before acting. The engine does not execute a command that would conflict with a fixed calendar event without first surfacing the conflict to the user.

The interaction surface is available on both mobile and web. On web, the same tap-to-type and long-press-to-speak affordances apply, with a hardware keyboard shortcut (configurable in iOS Shortcuts) also available for voice input hands-free.

### Pillar 6: Adaptive Onboarding

The onboarding flow is designed to gather the minimum information required to generate a first plan while avoiding the feeling of a lengthy interrogation. It branches based on the user's existing planning behavior, which is inferred from the archetype the user selects early in the flow.

The flow begins with a brief animated welcome sequence and proceeds through authentication (email, Google, or Apple sign-in) and archetype selection. At the archetype screen, the user chooses from six labeled tabs — Nine-to-Five Professional, Remote Worker, Student, Athlete-Focused, Founder Mode, and Mixed — with no detailed descriptions; the label is sufficient. This selection routes the user into one of two branches. Form of address, goals, and trial confirmation are deliberately deferred until after the first plan is revealed, so the user reaches a concrete plan as quickly as possible.

Users whose archetype implies an existing planning surface (generally any archetype other than one implying no prior scheduling habit) proceed through the calendar-connected branch: Google Calendar authorization, a brief universal setup step capturing wake time, bed time, and location, a single choice of one starting lifestyle module (Work and Tasks and the calendar are always on), and a short preference capture for that one module. The engine then generates a provisional first plan within approximately ninety seconds and reveals it with one prompted adjustment ("Anything I should move?"). Only after the reveal does the product collect form of address and two to three goals, then trial confirmation, followed by a four-to-five-screen feature tour and arrival at the day's plan. Time to first plan is under three minutes; the remaining setup is progressive, and further modules are proposed one at a time over the following weeks.

Users who do not have an existing planning surface proceed through the no-existing-plan branch, which adds a built-in calendar walkthrough before the universal setup step. The walkthrough is three screens explaining how to enter fixed weekly events — work hours, classes, recurring appointments — into the product's native calendar. All subsequent steps match the calendar-connected branch, with first plan reached in under five minutes.

Both branches end with a brief four-to-five-screen feature tour covering how to mark blocks complete, how to use the natural-language input surface, where the Dynamic Island integration lives, and where to find the weekly planning view. The tour is skippable at any screen. After the tour (or after skipping it), the user lands on the day's plan — Vesper is operational from this moment forward.

### Pillar 7: Dynamic Island Integration

The Dynamic Island is the ambient awareness surface on iOS. Its purpose is to let the user know what is current without requiring them to open the application. The current plan block appears in the Dynamic Island at all times during the day; the user does not need to remember what comes next.

Apple's Live Activities API, which powers Dynamic Island content, has an active duration cap of approximately eight hours per individual activity. Rather than attempting to maintain a single long-running activity for the entire waking day (which would hit the cap), the architecture manages one Live Activity per block: when a block begins, the server pushes a Live Activity start to the user's device; when the block ends (either by the user marking it complete or by its scheduled end time passing), the server pushes an end event and immediately starts the next block's activity if the next block is within an appropriate window. This chaining approach sidesteps the eight-hour cap while maintaining continuous coverage through a full day.

The server drives all Live Activity state changes through the iOS 17.2+ Live Activity Push Start mechanism. The user grants notification permission during onboarding, and from that point the backend can start and update Dynamic Island content without requiring the user to have the application open. A Cloudflare Worker fires every minute via scheduled cron, checks for blocks whose start or end time falls within the next 60 seconds, and sends the appropriate APNs payload to each affected device.

The Dynamic Island renders in three states. The compact leading view (left of the Dynamic Island camera pill) shows a two-character block abbreviation and a module icon. The compact trailing view (right of the camera pill) shows either a countdown timer in minutes remaining or a radial progress arc. The expanded view, revealed by a long-press on the compact state, shows the full block title, end time, a brief description if available, mark-complete and reschedule action buttons, and a bottom strip previewing the next block.

---

## 3. User Flows

### 3.1 New User Onboarding Flow

The following documents every screen a new user encounters from first launch through the first operational day's plan. The flow is plan-first: the provisional plan is generated and revealed partway through, before form of address, goals, and trial confirmation are collected. This screen list matches the canonical fourteen-screen sequence in Layer 4.

**Screen 1 — Welcome.** The screen presents a time-of-day-aware greeting as three sequential phrases, each held for approximately one second before crossfading to the next. The phrases are: "Good [morning / afternoon / evening].", followed by "Let's get you set up.", followed by "I'll keep things running from there." The full sequence takes approximately four seconds. A "Begin" button appears after the final phrase. Tapping anywhere on the screen at any point skips the sequence and advances to the button state immediately.

**Screen 2 — Authentication.** Three vertically stacked options of equal visual weight: Continue with Google, Continue with Apple, Continue with email. A small note below the options reads "We never sell your data." The user selects one option and completes the standard authentication flow for that provider. On completion, the account is created with `subscription_status` set to `trial` and `trial_ends_at` set to the current timestamp plus seven days. Sign in with Apple is live at V1 launch rather than deferred; the iOS surface uses the native Sign in with Apple system dialog with biometric confirmation, and the web surface uses the redirect-flow OAuth exchange. App Store Review guideline 4.8 requires Apple Sign In to be offered whenever any other social login is offered on the iOS surface, so it cannot ship in a disabled state.

**Screen 3 — Archetype Selection.** Headline: "What does your day usually look like?" Six tab-style labels on a single screen without descriptive text: Nine-to-Five Professional, Remote Worker, Student, Athlete-Focused, Founder Mode, Mixed. The user's selection determines the onboarding branch (calendar-connected or no-existing-plan) and initializes the plan engine's base profile template.

**Screen 4 — Calendar (branch-dependent).** Calendar-connected users see the headline "Let's start with your calendar." with a primary "Connect Google Calendar" button and a less-prominent "Skip for now" link; tapping the primary button initiates the standard Google OAuth flow, and on successful authorization the application reads the user's upcoming events and stores them as fixed blocks. Users in the no-existing-plan branch instead see a three-screen built-in calendar walkthrough under the headline "Let's set up your schedule," guiding them through entering fixed weekly events — work hours, classes, recurring appointments — into the product's native calendar, one entry type per screen with an inline example.

**Screen 5 — Wake, Bed, and Location.** Headline: "When does your day begin and end?" Two time pickers (Wake time and Bed time) plus a location field for city or zip. A footnote reads "These set your quiet hours and shape your plan's structure." The values initialize the quiet-hours window, drive the sleep module's bedtime reminder logic, and supply weather and commute context. This step applies to all users in both branches regardless of module choice.

**Screen 6 — Starting Module.** Headline: "Which part of your life should I start with?" Work and Tasks and the calendar are always on and not shown here. The user selects one lifestyle module to begin with (Fitness, Nutrition, Sleep, Errands, Medication, or Finance). Subline: "We can add more whenever you're ready." Single-select, one tap required, no skip. The product proposes additional modules over the following weeks, one at a time, as the user's rhythm stabilizes.

**Screen 7 — Chosen Module Preferences.** A brief preference capture for the one module chosen in Screen 6 only, three to four fields maximum. For fitness: goal type (strength, cardio, fat loss, maintenance), equipment available (gym, home, bodyweight), days per week. For nutrition: dietary restrictions, cooking time tolerance, notable dislikes. For sleep: target sleep duration (wake and bed times already set in Screen 5). For errands: recurring chores to pre-populate. For medication: medication entry flow (name, dose, time, frequency). Finance has no preference capture at this stage and the screen skips automatically. Preferences for any later-added modules are collected progressively at the point of enablement, not here.

**Screen 8 — First Plan Generation.** A full-screen cinematic loading state using a butler-appropriate animation (candle flame rather than a spinner) while the plan engine generates the user's first day. The butler line reads "Preparing your first day..." Duration is roughly four to six seconds, resolving to the plan reveal. If generation fails, the fallback line and graceful degradation sequence described in Pillar 1 apply.

**Screen 9 — First Plan Reveal.** The plan blocks fade in sequentially over approximately 1.5 seconds, top to bottom, with the butler line "Your first day is ready." The line then continues "Anything I should move?" and a single prompted-adjustment surface lets the user reorder or shift one block before accepting. The accept control reads "Looks right." The prompt can be dismissed to accept as-is. The honorific is not used on this screen, since form of address is collected next.

**Screen 10 — Form of Address.** Headline: "How should I address you?" Three stacked options: Sir, Madam, No honorific. The user's selection is stored and applied to every butler-voice line throughout the product that contains an honorific placeholder. A footnote reads "You can change this anytime in settings."

**Screen 11 — Goals.** Headline: "What are your two or three priorities right now?" Three open text fields. A "Skip" link is available. Goal entries seed the plan engine's priority context and appear as suggested starting points during the weekly planning flow.

**Screen 12 — Trial Confirmation.** Headline: "One week free. No card required." Body: "After seven days, $19.99 per month. Cancel anytime." A single primary button reads "Begin." No secondary option appears; users who do not want to continue simply exit the application (their account persists in trial state and can be resumed).

**Screen 13 — Feature Tour.** A four-screen skippable tour covering the core interactions a new user must understand: how to see block details (tap any block), how to mark blocks complete (swipe), how to use the natural-language input surface (tap the italic butler line at the bottom of the plan view), and where to find the weekly planning view. Each screen has a "Next" control and a "Skip tour" link.

**Screen 14 — Done / Plan View.** A single screen reads "All set. Welcome to Vesper." with an "Enter" control that reveals the full day's plan. Onboarding is complete. The butler line is active. The Dynamic Island Live Activity starts for the first block. The product is operational.

### 3.2 Returning User Daily Flow

This flow describes the full arc of a user's typical day, from alarm through end-of-day summary.

**Morning entry.** At the user's configured wake time, the default entry is the morning knock: a single optional push reading "Your day is ready." For users who enable the alarm as an opt-in enhancement, the alarm fires instead, presenting two edge-to-edge buttons (SNOOZE and STOP) dismissible without unlock. Either path advances to the energy check-in.

**Energy check-in.** A single screen displays a 1-through-10 slider with the label "How's your energy today?" The screen has a ten-second soft target — a visual indicator suggests the user need only take a moment — and a "Skip" link. The slider value is submitted to the plan engine, which immediately adjusts the day's plan intensity accordingly. If the user skips, the engine uses the prior day's value or a neutral midpoint (5) as the fallback.

**Morning brief.** he day's plan displays with the next three blocks visible above the fold and today's weather summary. The user can scroll to see the full day. The butler line renders a morning greeting line from the contextual pool. The Dynamic Island activates for the current or upcoming first block.

**Block execution through the day.** The user works through the day's blocks. Tapping a block expands it to show full details: recipe steps for meal blocks, workout sequence for fitness blocks, task checklist for work focus blocks, routed errand sequence for errand blocks. The user marks each block complete, skips it, or reschedules it via the block detail view or the natural-language input surface. Marking complete triggers a haptic response with no on-screen copy. Skipping triggers the butler-voice line "Noted. Moving on." Rescheduling triggers "Done. I've moved it to [time]."

**Proactive check-ins.** When a block's scheduled end time passes and the user has not marked it complete, the engine surfaces a question — visible in-app on the plan view and via the Dynamic Island expanded state — asking whether the block was completed. This check-in never arrives as a push notification. If the user answers no, the engine offers to reshuffle the block into the remaining day. If time remains for a silent reshuffle, it executes without further prompt. If time is insufficient, the engine surfaces a single choice: cut the block or move it to tomorrow.

**Mid-day natural-language edits.** The user can issue commands through the butler line at any point. Common mid-day commands: "move gym to 7pm," "add pick up package at 3," "drop today's run," "what's after this block." The engine acts on each command and confirms the result in butler voice.

**Evening summary.** In the evening the product surfaces the Vesper hour, a roughly five-minute close-of-day ritual. It leads with what the product handled today (blocks arranged, conflicts resolved, items reshuffled), shows energy and completion as secondary detail rather than a headline grade, then presents a draft of tomorrow's plan for the user to review and approve. Approving tomorrow's plan the night before is the anchor of the loop; the morning then simply delivers it. The sleep module, if enabled, surfaces the wind-down reminder block at the configured offset before bedtime.

**Quiet hours.** At the user's configured bedtime, the product goes silent. No push notifications (except medication reminders if the user has configured them with quiet-hours override) fire until the morning alarm. The Dynamic Island Live Activity ends for the day.

### 3.3 Weekly Planning Flow

The weekly planning flow is a structured session designed to be completed on Sunday, ideally on the web surface where the larger viewport makes multi-day editing more comfortable.

The product surfaces a soft prompt on Sunday morning — a butler-line cue and a gentle in-app banner — asking whether the user wants to plan the week. The prompt is fully dismissible. If dismissed or ignored, the product falls back to generating next week's plan from the prior week's template combined with any calendar events already present. The planning session remains accessible from the weekly planner navigation item throughout Sunday.

When the user engages the session, it proceeds through five sequential steps.

**Step 1 — Prior Week Review.** A summary led by what the product handled last week (blocks arranged, conflicts resolved, plans regenerated, meals planned), with completion rate shown as secondary context rather than the headline. If the reason for skipped or missed blocks is determinable from available data (a rescheduled block that was never completed, for instance), brief annotations appear alongside the blocks in question. On the Standard tier at V1, this review is completion-focused only; mood and energy trend analysis arrives with the paid Optimizer tier at V1.5.

**Step 2 — Priority Entry.** Three to five text fields for this week's top priorities. The AI pre-populates suggested priorities based on tasks that carried over from last week and any goals entered during onboarding, but the user can overwrite any suggestion or add priorities from scratch.

**Step 3 — Fixed Event Confirmation.** The user reviews the week's calendar events and confirms or adjusts them. Events imported from Google Calendar appear automatically. Built-in calendar events appear as entered. The user can add, edit, or remove events at this step before the weekly plan is generated.

**Step 4 — Module Adjustments.** The user applies any one-off modifications for the coming week: pausing a module for travel days, noting a scheduled dinner out on Thursday, flagging a recovery day where no workout should be scheduled. These adjustments are applied as constraints on the week's plan generation without modifying the user's persistent module preferences.

**Step 5 — Plan Generation and Review.** The engine generates the full week's template. The user reviews it as a seven-day block grid and either accepts it as presented or makes individual block-level adjustments. Accepting the plan advances the user back to the day view with the week's plan fully loaded.

The session targets fifteen to twenty minutes of engaged time.

### 3.4 Subscription Lifecycle Flow

The subscription lifecycle follows a deterministic state machine. The states are: trial, active, past-due, read-only, archived, and deleted. Each is documented below.

**Trial onset.** The trial begins the moment the user completes onboarding and taps "Start my free trial." The `subscription_status` field is set to `trial`. No payment method is collected. The trial window is seven days from that timestamp. The full feature set is accessible without restriction throughout the trial.

**Trial reminders.** A scheduled job checks each morning for users whose trial ends in two days, one day, or zero days. At each checkpoint, a transactional email is sent in butler voice, and an in-app ambient butler line cue and a soft plan-view banner appear. The two-day-out in-app copy: "Two days left in your trial. Anything you'd like to ask before then?" The one-day-out copy: "Your trial ends tomorrow. Shall I keep things running?" The end-date screen first shows a concrete week ledger of literal events handled (blocks placed, conflicts resolved, meals planned, reshuffles executed) as plain counts, with no derived time-savings figures, then the copy "Your week is up." with two unstyled buttons — Continue and End. No countdown timer, no persuasion copy, no discount offer appears at any trial reminder touchpoint.

**Day-five optional payment-method capture.** On trial day five, Vesper surfaces an opt-in prompt offering to save a payment method for a frictionless conversion tomorrow. On iOS, Apple Pay saves the card via StoreKit without charging it. On web, a Stripe Setup Intent captures the card without charging. Users who decline proceed through the standard flows unchanged. The prompt is consent-based and informational.

**Day-six one-tap conversion prompt.** Twenty-four hours before the trial ends, users who saved a payment method on day five see a one-tap conversion prompt. A single biometric confirmation converts them to paid. Users who did not save a method on day five see an informational reminder with a CTA to the standard Checkout or StoreKit flow. Neither path pre-authorizes charges or defaults to yes; conversion is a deliberate user action or the trial proceeds to its end-date prompt the following day.

**Privacy settings touchpoint (mobile only).** The optional biometric lock for the iOS application is configurable under Privacy in account settings. The setting is off by default. When enabled, the application requires Face ID or Touch ID confirmation on cold start and on foreground return from background after sixty seconds.

**Trial conversion — Continue.** The user taps Continue. On iOS, the StoreKit purchase flow initiates. On web, Stripe Checkout loads. On successful payment, `subscription_status` transitions to `active` and the first billing cycle begins. The butler-voice confirmation is "Welcome aboard."

**Trial conversion — End.** The user taps End. `subscription_status` transitions to `read_only`. No payment is collected. The read-only state and subsequent archive proceed identically to the post-cancellation path described below.

**Active subscription.** The steady state. Monthly charges are made on the billing anniversary. Full feature access continues. When a charge succeeds, no in-app confirmation is displayed; a receipt email is sent via Stripe's standard billing receipt.

**Past-due (dunning).** When a monthly charge fails, `subscription_status` transitions to `past_due`. On the web path, Stripe initiates its native dunning retry sequence over the following days. On the iOS path, Apple manages dunning autonomously. During the dunning window, the user retains full feature access. An in-app butler-voice line notes the payment issue: "Your payment didn't go through. I'll keep things running while you sort it out." No additional push notification is sent beyond the initial payment failure alert.

**Read-only entry.** When dunning fails completely (Stripe or Apple), or when a user explicitly cancels, `subscription_status` transitions to `read_only`. In read-only mode, the user can view their plan and historical data but cannot generate new plans or issue edits. The butler-voice acknowledgment on read-only entry: "Your data stays here for seven days, then archives for another thirty." Read-only persists for seven days from the transition date.

**Archive.** After the seven-day read-only window, the account transitions to `archived`. The user can no longer access their plan or data through the application, but the underlying data is retained for an additional thirty days. If the user resubscribes during the archive window, full access is restored and all prior data is present exactly as they left it. The resubscribe confirmation: "Welcome back. Everything is as you left it."

**Hard delete.** Thirty days after the archive transition (thirty-seven days total from the read-only entry), the user's data is permanently deleted. This deletion is irreversible. No recovery is possible after this point.

**Cancellation.** Cancellation is one tap on iOS (through Apple's subscription management interface in the iOS Settings application or the App Store) and one tap on web (through the Stripe Customer Portal accessible from account settings). No retention modal appears at the cancellation moment. No discount is offered. No survey is required to complete the cancellation. The butler-voice acknowledgment immediately after cancellation: "Of course. Your data will be here for thirty days if you'd like to come back." The subscription transitions to `read_only` immediately. Forty-eight hours after cancellation, a single transactional email arrives asking "Was there anything we could have done differently?" with a free-text response field. No follow-up is sent regardless of whether the user responds. No further win-back communication is attempted at any interval thereafter.

**Resubscription.** A user in `read_only` or `archived` state can resubscribe at any time by navigating to account settings and initiating the payment flow. On successful payment, `subscription_status` transitions to `active` and all prior data is restored immediately.

### 3.5 Application Navigation and the Modules Tab

The mobile application uses a four-item tab bar: **Plan, Modules, Tasks, Calendar**, with **Modules second-from-left**. Plan is the primary daily surface; Tasks and Calendar are the secondary work and scheduling surfaces; the **Modules** tab is the home for every lifestyle module and for application settings.

The Modules tab is a **vertically scrollable list of rounded-rectangle cards, one card per module**, and **every card routes to its own full page**. Cards divide into two kinds, both of which route somewhere:

- **Reminder-list modules** (Medications, Bills, Errands) open a **full management page** — a list plus add/edit. Their entries continue to surface through their existing notification/schedule mechanism and as plan blocks; this is unchanged.
- **Generative modules** (Fitness, Nutrition, Sleep) open a **richer module page**. At V1 these ship as **functional-breadth scaffolds (method B)** — real, navigable, demoable surfaces — with the deep engines explicitly deferred (see §6.2, §6.3).

**Settings are not a separate tab.** Application settings — integrations / Google Calendar, billing / subscription, privacy / biometric lock, referral, and account — live in a **"Settings" rounded-rectangle card pinned at the bottom of the Modules list**, which opens the existing settings surfaces as their own page / sub-stack. No settings surface is removed by this arrangement; the settings *entry point* is a card at the bottom of the Modules list rather than a top-level tab.

---

## 4. Core Interactions

### 4.1 Daily Plan Generation

Plan generation happens on a schedule and in response to triggers. The morning plan is the primary generation event. A Cloudflare Worker pre-warms the AI context cache for users keyed to their set wake time, firing thirty minutes before that wake time. Users without a set wake time (some web users) receive cold-cache plan generation; the plan still appears within a few seconds, and cost is slightly higher for that cohort. The energy slider submission is the final trigger that unlocks the morning plan: the engine receives the energy value, applies its intensity scaling to the pre-warmed context, and completes the final plan assembly.

Plan generation is also triggered by calendar changes. When a new event is added to the user's Google Calendar (via the OAuth sync webhook), the engine receives the change event and re-evaluates the affected day's plan. If the change causes a conflict — the new event overlaps a plan block — the engine attempts a silent reshuffle. Silent reshuffles succeed when the displaced block's duration fits into another open slot within the same day without violating any deadline. When a silent reshuffle is not possible, the engine surfaces a single choice prompt in butler voice: the user selects which item to cut or defer, and the engine resolves the day accordingly.

The engine never silently drops a committed item. If a user's day becomes over-committed due to a new calendar event and the engine cannot resolve the conflict without user input, it holds all items in their current state and surfaces the conflict. Items remain on the plan in an unresolved state — visually distinguished — until the user makes the choice.

What the engine outputs is a structured block array for the day: each block has a type (work, fitness, nutrition, sleep, errand, medication, finance, or free), a title, a start time, an end time, a detail payload (workout template reference, recipe reference, task list, errand list, or similar), and a status (pending, complete, skipped, or rescheduled). This structure is stored in the database and read by both the mobile and web rendering layers.

### 4.2 Plan Adjustment via Natural Language

The natural-language adjustment path begins with the user tapping or long-pressing the ambient butler line. Tapping opens the input sheet (described in Section 4.3). Long-pressing begins voice recording immediately.

Once the user submits a command (via text send or voice release), the engine classifies the intent and extracts the relevant parameters. A rescheduling command ("move gym to 7pm") identifies the block by module type or explicit title, extracts the target time, checks for conflicts at the target time, and either moves the block or surfaces a conflict if the target slot is occupied. An addition command ("add pick up dry cleaning at 3") creates a new errand block with the extracted title and time and inserts it into the day's block array. A deletion command ("drop the afternoon run") removes the identified block from the day without asking for confirmation. A parameterization command ("make today's workout shorter") reselects from the fitness template library with a shorter time tag and substitutes the new template.

When a command is ambiguous — for instance, the user says "move lunch" but there are two meal blocks — the engine returns a clarifying question in butler voice before acting: "Which meal — the noon one or the one at 3?" The user's follow-up resolves the ambiguity and the engine acts on it.

When a command conflicts with a fixed calendar event — for instance, moving a block to a time slot that already contains a meeting — the engine does not execute the command silently. It surfaces the conflict: "That slot has [meeting name]. Shall I find the next open window?" If the user confirms, the engine places the block in the nearest available open slot and confirms the actual time.

Commands that reference disabled modules are declined gracefully. If the user says "add a workout" but the fitness module is disabled, the engine responds: "The fitness module is off. Enable it in settings if you'd like to add workouts."

All natural-language input is processed as a single-turn command. The engine does not maintain conversational state between commands. Each command is independent. The user cannot issue a multi-step dialogue to configure something complex; complex configuration happens in settings. The input surface is for quick, decisive plan modifications only.

### 4.3 The Ambient Butler Line

The ambient butler line is the persistent contextual phrase rendered at the bottom of every relevant screen. It serves two simultaneous functions: it is a contextual status indicator that tells the user where they are and what the butler is aware of, and it is the touch target that opens the natural-language input surface.

Visually, the line is rendered in italic Fraunces at 14 points, weight 400, optical size 9, in the `text-tertiary` color (`#756B57`). It sits at the bottom center of the plan view and the bottom left of the settings and weekly planner views. It has no surrounding container, no icon, no chevron, and no visible button affordance. The absence of a button is intentional: the butler is not a feature with an interface element; the butler is simply present and addressable.

The line rotates based on context. The rotation logic considers the current screen, the time of day, the completion state of the day's blocks, recent user activity, and the user's chosen honorific preference. The same line does not repeat within a four-hour window for a given user. The full line pool covers approximately eighty context permutations across morning, afternoon, evening, and late-night states; plan states (fresh, underway, mostly complete, all complete, nothing scheduled); and screen states (plan view, settings, weekly planner, profile). Representative lines by context are documented in Section 5.

Tapping the butler line opens the input sheet. The sheet slides up from the bottom over 300 milliseconds. Inside the sheet is a single multiline text field with the placeholder text "Tell Vesper." The cursor is focused immediately and the soft keyboard appears on mobile. The sheet is dismissed via swipe down or the escape key on web. The user submits the command via the return key or a send button. On submission, the sheet dismisses over 200 milliseconds and the engine processes the command.

Long-pressing the butler line begins voice recording immediately, without an intervening confirmation step. The butler line transforms into a waveform visualization that pulses with the user's voice input while the press is held. Releasing the press submits the recording; a brief 200-millisecond processing indicator appears, then the engine acts on the input and the view returns to the normal state.

### 4.4 Notifications Strategy

Vesper's default posture is aggressive restraint. The product does not treat push notifications as a general-purpose communication channel. Three categories of push notifications are permitted at V1 and no others: medication reminders, payment-failure alerts, and a single optional daily morning knock delivered at the user's chosen wake time signaling that the day's plan is ready. The morning knock is opt-in and user-scheduled; declining it leaves the product entirely in-app for engagement cues.

The first permitted category is medication reminders. Because the health consequences of a missed dose can be meaningful, push notification is warranted despite the general anti-interruption posture. Medication push notifications fire at user-specified times. Medication reminders fire at their specified time by default, including within quiet hours, because silently delaying a time-critical dose is the unsafe default. Shifting a reminder to the next non-quiet window is an explicit per-medication opt-in. Quiet-hours override for medication on iOS may depend on the critical-alert entitlement; where unavailable, the in-foreground red-priority banner described in Layer 4 is the fallback. Open item: confirm Apple critical-alert entitlement availability and approval criteria for quiet-hours medication delivery.

The second permitted category is payment failure alerts. One push notification is sent per payment failure event. No follow-up push is sent from the same event; the in-app butler-voice line handles the ongoing state.

All other proactive communication from the product arrives through in-app surfaces (the ambient butler line, the plan view, and direct screen overlays) or through the Dynamic Island Live Activity. This includes block completion check-ins, daily plan reminders, trial reminders, weekly planning prompts, module suggestions, and every other category of proactive cue. None of these arrive as push notifications.

Quiet hours default to the user's configured sleep target window (bedtime to wake time). If the user has not set a sleep target, quiet hours default to 10:00 PM to 7:00 AM in the user's local timezone. Quiet hours apply to all push notifications; medication reminders are excepted and fire at their specified time by default regardless of quiet hours, because silently delaying a time-critical dose is the unsafe behavior — shifting to the next non-quiet window is an explicit per-medication opt-in. Users can override quiet hours behavior per notification category in a settings subsection.

All notification copy follows the butler voice specification documented in Section 5.

### 4.5 Dynamic Island Live Activity Behavior

The Dynamic Island operates as an always-on ambient awareness surface for the current plan block throughout the user's day. Its content is driven entirely server-side; the user does not need to have the application open or perform any action to keep it updated.

The compact state — the view visible when the Dynamic Island is in its resting pill shape — shows two pieces of information: the left side displays a two-character block abbreviation (GY for gym, FC for focus, ER for errand, ML for meal, SL for sleep, MD for medication, FN for finance) alongside the module's icon; the right side displays either a countdown timer in minutes remaining until the block ends, or a radial arc indicating completion progress. The arc fills in bronze and shifts to a slightly warmer hue at 80% completion.

The expanded state — revealed when the user long-presses the Dynamic Island — displays the full block title, the end time, a brief description if the block type has one, two action buttons (mark complete and reschedule), and a bottom strip previewing the next block's title and start time. Tapping "Mark complete" from the expanded state triggers the same completion logic as marking complete from inside the application: the block transitions to completed status, the Live Activity ends, and the next block's Live Activity starts.

Each block has its own Live Activity. When a block ends — either because its end time has passed or because the user has marked it complete — the server sends an end event to the device's APNs Live Activity token. If the next block begins within a short window (less than 30 minutes), the server immediately sends a push start for the next block's activity, creating seamless continuity in the Dynamic Island without any gap. If the gap between blocks is long (more than 30 minutes), the Dynamic Island goes quiet until the next block's start approaches, at which point the server initiates the next activity.

The Dynamic Island is an iOS-only feature at V1. Devices that do not have a Dynamic Island (iPhone 14 and earlier) receive an equivalent persistent banner notification in the notification center instead.

---

## 5. Content and Tone

### 5.1 Butler Voice Specification

Vesper communicates in a single, consistent voice across every surface: the butler voice. The reference model is a high-end concierge or personal butler — calm, competent, formal without being archaic, and utterly devoid of the signaling behaviors common to AI-generated copy. The butler handles things; the butler does not seek validation for having handled things.

The voice is formal but human. Sentences are short and direct. Questions are soft and open-ended, giving the user agency rather than pressuring them toward a particular answer. Acknowledgments are brief and confident. The butler does not explain what it is about to do before doing it; it does what it does and confirms simply. The butler does not celebrate the user's choices or achievements; it notes them and moves on.

The voice does not modulate across surfaces. The plan view, onboarding, error states, and subscription moments all use the same register. The onboarding screens are slightly warmer than the steady-state product voice — a few degrees more welcoming, appropriate to the first encounter — but they do not break into informality or excitement.

Every line of butler-voice copy, whether hardcoded or AI-generated, passes through a two-layer voice gate before being displayed to the user. The first layer is a regex check that removes em-dashes, exclamation points, emoji characters, and any string referencing AI, artificial intelligence, or machine learning. The second layer is a brief AI review against the full voice specification for any generated string longer than thirty words, with automatic regeneration if the string fails. This gate is enforced at the infrastructure level; it is not a guideline for individual developers to apply manually.

### 5.2 Rules: What the Butler Does Not Say

The following categories of language are prohibited in all user-facing copy, including AI-generated copy. These are not preferences; they are enforced rules.

**No em-dashes.** The em-dash is a widely recognized signature of AI-generated text. It is never used. Periods, commas, parentheses, or colons serve the same structural purpose where needed.

**No exclamation points.** Excitement is not the butler's mode. No sentence in the product ends with an exclamation point under any circumstances.

**No emojis.** No emoji character appears anywhere in the product's user-facing copy, notifications, or marketing materials.

**No AI self-reference.** The product never refers to itself as an AI, never uses the phrases "as an AI," "I'm an AI," or "AI-powered," and never references the underlying model, API, or inference mechanism. The butler is simply the butler.

**No gratitude language.** The butler does not thank the user for subscribing, for returning, for using the product, or for any other action. Gratitude language inverts the master-butler dynamic and reads as performed rather than genuine. "Thank you for subscribing," "We appreciate you," and "Thanks for using Vesper" are prohibited in every form.

**No manufactured urgency.** "Limited time," "only X spots left," countdown timers for artificial scarcity, and similar phrases are prohibited. This applies to marketing copy as well as in-product copy.

**No gamification language.** "Streaks," "badges," "level up," "you crushed it," "you're on a roll," and any other language that frames the user's life management as a game are prohibited.

**No informal address.** "Boss," "champ," "rockstar," "buddy," and similar terms are prohibited. So are motivational phrases such as "let's crush this," "you got this," and "keep going."

**No archaic phrasing.** "Henceforth," "thereafter," "shall not," "concludes," and similar language sound theatrical rather than formal. The butler speaks modern formal English.

**No filler affirmations.** "Great question," "Absolutely," "Certainly," "Of course, I'd be happy to," "Sure thing," and similar responses are prohibited. The butler acts; it does not praise the user for having asked.

### 5.3 Sample Copy: Key Surfaces

The following table documents the canonical butler-voice copy for the most frequently encountered in-product moments. All lines are final and are drawn from the locked copy library. New copy for states not represented here is added to the library during the build phase; it is not invented inline.

| Scenario | Copy |
|---|---|
| First plan generated | "Your first day is ready." |
| Morning greeting (honorific, plan ready) | "Good morning[HONORIFIC]. [Day] is ready." |
| All blocks complete | "That's everything for today." |
| Block marked complete | *(haptic only, no copy)* |
| Block skipped | "Noted. Moving on." |
| Block rescheduled | "Done. I've moved it to [time]." |
| Plan accepted | "Very good." |
| Energy slider skipped | "Right, then. Let's get going." |
| Conflict requires user choice | "Two things need the same time slot. Which takes priority?" |
| AI fallback (generation failed) | "Working from your usual routine today. I'll have something fresh tomorrow." |
| Connection lost | "We've gone offline. Your plan is still here." |
| Google Calendar disconnected | "Your calendar has disconnected. Reconnect when you're ready." |
| Calendar reconnected | "Calendar is back. Catching up now." |
| Payment failed | "Your payment didn't go through. I'll keep things running while you sort it out." |
| Payment cleared post-failure | "Payment went through. We're all set." |
| First paid subscription | "Welcome aboard." |
| Trial: 2 days remaining | "Two days left in your trial. Anything you'd like to ask before then?" |
| Trial: 1 day remaining | "Your trial ends tomorrow. Shall I keep things running?" |
| Trial ended, decision needed | "Your week is up." *(then buttons: Continue / End)* |
| Cancellation confirmed | "Of course. Your data will be here for thirty days if you'd like to come back." |
| Read-only mode entry | "Your data stays here for seven days, then archives for another thirty." |
| Resubscribe from archive | "Welcome back. Everything is as you left it." |
| Account deletion confirmed | "Your account will close in thirty days. You can change your mind anytime before then." |
| Welcome back (3+ days absent) | "Welcome back. Anything I should know about?" |
| Welcome back (14+ days absent) | "It's been a while. Shall we pick up where we left off?" |
| Module disabled | "Removed. You can switch it back on in settings anytime." |
| Module added mid-trial | "Got it. I'll work this into tomorrow's plan." |
| Workout suggested | "I've picked a [duration] [type] for you today." |
| Workout swapped | "Of course. Here's another." |
| Meal swapped | "Changed. The new one fits your time today." |
| Grocery list generated | "Your list is ready. Nearest stocked store is [name]." |
| Errand batch suggested | "Three stops, best done in this order." |
| Traffic buffer added | "Added ten minutes for traffic." |
| Bedtime approaching | "Wind-down begins in fifteen minutes." |
| Medication reminder | "Time for your [medication name]." |
| Bill due tomorrow | "[Bill name] is due tomorrow." |
| Weekly review prompt (Sunday) | "Sunday. Shall we look at the week?" |
| Weekly review skipped | "Right. We'll keep things as they are." |
| Settings | "At your service[HONORIFIC]." |
| Settings saved | "Saved." |
| Notification permission denied | "Understood. I'll keep things in-app." |
| Location permission denied | "Understood. Local features will wait." |
| Three plan regenerations rejected | "I haven't got it right yet. Tell me what's missing." |
| Onboarding step completed | "Right. Next." |
| First plan reveal, prompted adjustment | "Your first day is ready. Anything I should move?" |
| Morning knock push | "Your day is ready." |
| Morning knock permission ask | "I can knock once each morning when your day is ready. Nothing else. May I?" |
| Vesper hour open | "Here's what I handled today." |
| Butler's notebook entry | "I've noticed you move workouts to the evening. I'll plan them there, unless you'd rather I didn't." |
| Trial-end ledger lead-in | "This week I arranged [N] blocks, resolved [N] conflicts, planned [N] meals, and reshuffled your day [N] times." |

### 5.4 The Never Says List

The following is a consolidated list of specific phrases, words, and patterns that are prohibited in all user-facing copy regardless of context. This list is the enforcement reference; the categories in Section 5.2 provide the reasoning.

Prohibited words and phrases: "Thank you," "thanks," "appreciate," "grateful," "excited," "amazing," "awesome," "great," "fantastic," "incredible," "love it," "crush it," "smash it," "you got this," "let's go," "keep it up," "well done" *(as an expression of praise)*, "boss," "champ," "rockstar," "buddy," "pal," "streak," "badge," "level," "points," "achievement," "milestone" *(as a gamification concept)*, "limited time," "act now," "don't miss out," "only [N] left," "AI," "artificial intelligence," "machine learning," "algorithm," "model," "generated," "powered by," "Absolutely," "Certainly," "Of course" *(as a filler affirmation)*, "Sure thing," "Great question," "Happy to help," "I'd be happy to," "No problem," "No worries," and any word or phrase followed by an exclamation point.

Prohibited punctuation and characters: em-dash (—), exclamation point (!), any emoji character.

### 5.5 Persuasion Principles

The butler voice incorporates influence principles from negotiation and behavioral psychology without crossing into manipulation. The ethical test applied to every line: would a fully informed user feel satisfied with their decision twenty-four hours later? Lines that pass this test are influence. Lines that fail it are manipulation and are not used.

The principles applied in practice are: tactical empathy (acknowledging the user's situation before any request or prompt), calibrated questions (using "how" and "what" questions rather than yes/no questions where the user has genuine agency), labeling (using "It seems..." or "It sounds..." sparingly to acknowledge emotional or practical state), loss framing reserved for genuine decision moments (trial end, cancellation, account deletion — not sprinkled throughout routine copy), and commitment and consistency acknowledgment (surfacing what the user has already built or configured rather than asking for new commitment from a standing start). Scorekeeping is framed around the service rendered rather than the user's performance: summaries and the trial-end decision lead with what the product handled (counts of literal events), never with derived value estimates, which keeps salience honest and removes the performance-grading that drives avoidance.

These principles apply with particular care at the trial end and cancellation moments, which are the two highest-stakes persuasion touchpoints. At both moments, the copy is honest, minimal, and completion-framed rather than loss-framed. The user's decision is respected on its face; no last-ditch offer, additional pop-up, or persuasive copy appears after the user has made their choice.

---

## 6. Module Specifications

### 6.1 Work and Tasks

The work module is the task management engine of the plan. Users create tasks by entering a title, an estimated duration, an optional deadline, and a priority level (low, medium, or high). Tasks do not expire or auto-archive at V1; the user manages their task backlog through completion, editing, or manual deletion. The module does not have its own dedicated view on mobile. Tasks surface inside the daily plan as focus blocks, and the task creation entry point lives in the butler input surface and in a secondary task list accessible from the plan view.

The plan engine pulls the full set of pending tasks at morning generation time and places chunks of each task into available focus windows throughout the day, ordering by priority and deadline proximity and respecting the fixed boundaries of calendar events. If a task is too long to complete in one continuous block, the engine splits it across multiple focus windows without prompting the user. When a new calendar event is added mid-day and displaces a scheduled task chunk, the engine reflows the displaced chunk to the next available opening within the task's deadline window silently, provided a resolution exists. When the day no longer holds sufficient open time for all committed task work within deadline constraints, the engine does not silently deprioritize any task; it surfaces a single prompt asking the user to choose which items move to tomorrow.

The module tracks task completion through block completion events. When a user marks a focus block complete, any tasks associated with that block advance their status accordingly. Partial completion is recorded if the user marks a block complete with a note that only part of the task was finished; in this case the engine carries the remainder forward to the next available window. The module does not integrate with any external task management systems at V1. Todoist, Things, Linear, Asana, and similar task managers are not connected. The work module is the task layer; external tools do not feed into it at V1.

The primary V1 limitation is scope horizon. The engine plans today and previews tomorrow but does not perform cross-week rebalancing. A task with a deadline seven days away is not proactively surfaced until it falls within the single-day planning horizon plus next-day preview. Users who want longer-horizon placement must review their task list manually. Cross-week rebalancing arrives at V2.

### 6.2 Fitness

The fitness module selects and schedules a workout block each day from a curated library of approximately 150 workout templates. Each template is tagged along four dimensions: goal (strength, cardio, fat loss, maintenance, or mobility), equipment required (bodyweight only, dumbbells, full home gym setup, or commercial gym), time required (15, 30, 45, or 60 minutes), and difficulty level (beginner, intermediate, or advanced). At morning plan generation, the engine filters the template library to the candidate set that matches the user's stated goal, registered equipment availability, and energy slider value, then selects the best match from that filtered set with light AI personalization applied — adjusting set counts, rep ranges, or rest intervals based on the user's prior day's training and current energy reading.

The module captures the following fitness context at onboarding and uses it continuously: the user's primary goal (editable in settings after onboarding), and their equipment availability (set by location type — home, commercial gym, or both — captured directly during onboarding), and their energy state for the day from the morning slider. Recovery state is estimated as a function of the prior day's workout intensity and type; no wearable data informs this estimate at V1 because wearable integrations are deferred to V2. The recovery estimate is a heuristic: consecutive high-intensity days reduce the engine's candidate set to lighter templates.

What the user sees is a single workout block in their daily plan with the exercise name, estimated duration, and a brief description of the session. Expanding the block reveals the full workout: exercise names, sets, reps or time, and rest intervals. The user can swap the suggested workout at any time by typing or speaking a swap command in the butler input surface ("give me something shorter," "I want a home workout today," "skip the gym today"). The engine presents the next best match from the filtered candidate set without requiring the user to browse the library. After three consecutive swap rejections, the engine asks what specifically is not working rather than continuing to cycle through templates.

The module does not connect to any fitness tracking service at V1. Apple Health, Google Fit, Fitbit, Oura, and Whoop are all deferred to V2. Workout completion is recorded manually by the user marking the block complete. There is no automatic heart rate, calorie burn, or step data ingestion at V1.

**V1 module surface (method B — Modules tab).** The fitness module opens from its Modules-tab card (§3.5) as a full page shipped at **functional-breadth scaffold** depth: a **workout-schedule list**, **tailored generation** (reusing the existing template selection/adaptation described above), and a **lift-logging surface** (sets / reps / weight per exercise, stored in a thin scaffold table). **Explicitly deferred to a post-launch phase (named, page structured to accept it later):** the **bronze→platinum strength-rank engine** and the **world-standard percentile mapping**. V1 builds the real, navigable, demoable fitness surface without those engines.

### 6.3 Nutrition

The nutrition module selects and schedules meal blocks from a recipe library of approximately 300 recipes. Recipes are sourced from a combination of curated content and recipe API ingestion — TheMealDB provides the free baseline corpus; Edamam or Spoonacular provides nutritional metadata including macronutrient profiles and allergen tags. Each recipe is tagged by dietary restrictions (vegetarian, vegan, gluten-free, dairy-free, nut-free, and similar), cuisine style, total preparation time, and macronutrient profile (high protein, balanced, low carb, and similar). At morning plan generation, the engine selects the day's meals by filtering to recipes that satisfy the user's dietary restrictions, fall within their stated cooking time tolerance, and avoid registered food dislikes, then applies light AI selection to match macronutrient targets if the user has set them.

The module schedules three meal blocks by default: breakfast, lunch, and dinner. Each block shows the recipe name and estimated preparation time. Expanding the block reveals the full recipe: ingredient list with quantities, step-by-step preparation instructions, and a macronutrient summary. The user can swap any meal with a command in the butler input surface; the engine substitutes the next best match from the filtered candidate set. Grocery list generation is automatic: the engine aggregates the ingredient lists from the current week's scheduled meal plan and produces an itemized shopping list. The grocery list is a static generated checklist at V1. It does not route to a specific store and does not integrate with any grocery delivery service..

Hydration tracking lives inside the nutrition module as a sub-feature. The engine sets a daily water intake target based on the user's body weight if provided at onboarding, or a conservative sixty-four ounce default otherwise. The user logs hydration by tapping a simple counter within the nutrition block. No integration with smart water bottles or wearables feeds this counter at V1. The hydration tracker does not have an independent module toggle; it is always present when the nutrition module is enabled and absent when it is disabled.

The module does not count calories automatically. Calorie tracking is not a V1 feature and is not on the planned roadmap. The nutrition module is organized around meal planning and shopping logistics, not dietary restriction enforcement or weight management measurement. Users who want to track calories manually are not prevented from doing so in the free-text notes field on any nutrition block, but the module provides no automated calorie summation or nutritional audit.

**V1 module surface (method B — Modules tab).** The nutrition module opens from its Modules-tab card (§3.5) as a full page shipped at **functional-breadth scaffold** depth: a **daily food-log surface**, a **food-search surface** (over the recipe/food corpus; no external food-nutrient database), and an **AI recipe-modify surface** that reuses the existing AI command infrastructure. **Explicitly deferred to a post-launch phase (named, page structured to accept it later):** micronutrient / vitamin breakdown, RDA progress bars, calorie-counter internals, and external food-nutrient database wiring. This is consistent with the "no automatic calorie counting at V1" boundary above; V1 builds the real, navigable, demoable nutrition surface without those engines.

### 6.4 Sleep

The sleep module manages the full bedtime arc from wind-down through wake. At setup, the user configures two time values: their target wake time and their target bed time. These values initialize the quiet hours window — no notifications fire during the period between bed time and wake time except medication reminders, which fire at their scheduled time by default — and drive all downstream sleep module behavior. The module schedules a wind-down routine block in the plan each evening at a configurable offset before bed time; the default offset is thirty minutes. The wind-down block contains a brief routine drawn from a library of light evening activities (stretching sequences, breathing exercises, screen-wind-down guidance) selected based on the user's context for the day, otherwise defaulting to a baseline routine.

The module delivers a push notification when the wind-down block begins. This is the only sleep-module push notification in the system, and it fires at the wind-down start time rather than at bed time, so the user receives advance notice rather than a reminder at the moment they should already be in the process of sleeping. The notification copy is brief: "Wind-down begins in fifteen minutes." A secondary in-app nudge fires via Dynamic Island when the wind-down block is actively underway if the user has not opened the application.

The optional alarm, when the user has enabled it, fires at the user's registered wake time. On iOS, the alarm presents as a full-screen lockscreen interruption with two edge-to-edge buttons labeled SNOOZE and STOP. The alarm does not require the phone to be unlocked to dismiss. Pressing STOP dismisses the alarm and immediately advances to the energy check-in slider screen as the first interaction of the day. The energy check-in is the first screen after alarm dismissal rather than before it, so that the alarm dismissal is never gated behind a form. Pressing SNOOZE delays the alarm by nine minutes, a fixed interval that is not configurable at V1, and returns the screen to its locked state.

The sleep module does not connect to any sleep tracking hardware or software at V1. Apple Health sleep data, Oura ring integration, and similar sources are deferred to V2. Sleep quality is not measured or stored. The module tracks whether the alarm fired and whether it was dismissed to infer approximate wake time, but it does not record total sleep duration or characterize sleep quality. Users who want to provide sleep context can do so implicitly through the energy check-in slider, which captures perceived rest state through the day's energy score.

**V1 module surface (Modules tab).** The sleep module opens from its Modules-tab card (§3.5) as a generative-module full page, following the same mount pattern as fitness and nutrition; its scope is unchanged from the description above (wind-down, bedtime, quiet hours). It is not re-scoped by method B beyond adopting the Modules-tab mount.

### 6.5 Medication

The medication module tracks pill timing, dose schedules, supplement timing, and refill reminders. Unlike all other modules, setup requires manual data entry: each medication is entered with a name, a dose amount and unit, a time or times of day, and a frequency (daily, twice daily, every other day, weekly, and similar). The module stores this information in the user's encrypted profile. Medication data is never shared with third parties, never reported to health insurance systems, and not synchronized to Apple Health or any other health platform at V1 or in any planned version. The medication module is activated by user choice at onboarding or a later butler proposal rather than being on by default; once active, its medication list is empty until the user populates it, and an empty list produces no plan blocks and no reminders.

For each configured medication, the module schedules a reminder block in the daily plan at the specified time and fires a push notification at that time. Medication reminders are one of three categories for which push notifications are permitted at V1, alongside payment-failure alerts and the opt-in morning knock, because the health stakes of a missed dose justify the intrusion into the product's otherwise notification-restrained posture. The push notification copy is minimal: "Time for your [medication name]." The user marks the reminder complete by tapping the notification or the plan block.

If the user declined push notification permission at the system prompt, the medications module does not hard-gate on permission. The module activates regardless, and three behaviors compensate for the missing push channel. First, at the moment the user adds a medication entry, a contextual in-app re-prompt asks whether to enable notifications now, framed as offering the medications surface its intended channel rather than as a generic permission ask. Second, at each scheduled dose time, if the application is in the foreground, a prominent red-priority in-app banner displays the dose reminder; this is the only red-priority banner in the product and is reserved for this case. Third, settings exposes a direct deeplink to iOS Settings → Vesper → Notifications so the user can re-grant permission without hunting through system settings. The posture is permission-soft rather than permission-gated, with the in-foreground banner carrying the burden when push is unavailable.

Refill reminders are set manually by the user entering a refill date on any medication entry, which surfaces a reminder block in the plan on that date. The module does not track pill counts and cannot automatically calculate when a refill will be needed based on dose frequency and current supply; refill date entry is the user's responsibility at V1. Automatic refill calculation based on entered supply quantity and dose schedule is a V1.5 candidate.

The module does not surface any medical advice, drug interaction warnings, or dosage guidance. It is a scheduling and reminder tool exclusively, not a pharmacological reference. Users who enter a medication name receive no information about that medication from the product; the name is stored and displayed but not cross-referenced against any drug database. No copy anywhere in the module makes clinical claims.

### 6.6 Errands

The errands module manages to-dos, recurring chores, and one-off errands as a flat checklist. Recurring chores (trash day, laundry, plant watering) are entered once and appear automatically on the appropriate day each week. One-off errands (pharmacy, dry cleaning, returns) are added on demand and persist until completed or dismissed. Each errand can carry an optional deadline; errands with deadlines surface in the daily plan on or before their deadline date, and errands without deadlines are surfaced opportunistically in lighter sections of the day. Geographic batching, route optimization, and traffic-aware buffers are not V1 features.

The module also manages non-grocery shopping reminders. Shopping items are added with optional purchase deadlines and surface as plan reminders rather than as a transactional checkout surface.

**V1 module surface (Modules tab).** The errands module opens from its Modules-tab card (§3.5) as a reminder-list-module full management page (list + add/edit), following the same mount pattern as medications and bills; its scope is unchanged from the description above. It is not re-scoped by method B beyond adopting the Modules-tab mount.

### 6.7 Finance

The finance module tracks bill due dates, subscription renewal dates, savings goal nudges, and periodic budget check-in prompts. It is the only module that defaults to off at onboarding; users who want financial tracking enable it voluntarily through the module toggle. When enabled, all data entry is manual: the user enters each bill with a name, an amount, a due date, and a frequency (one-time, monthly, quarterly, or annually). Subscription renewals are entered the same way. The module has no connection to banks, credit cards, investment accounts, or any financial institution at V1 or in any planned version. This is a permanent boundary rather than a deferral; financial data connectivity introduces privacy surface and data custody obligations that are incompatible with the product's privacy posture and solo-founder operational scope.

What the user sees in the plan is a reminder block on the day before each bill is due, with the bill name, amount, and the butler-voice line: "[Bill name] is due tomorrow." On the due date itself, the block transitions to a completion prompt. The user marks the bill as paid by completing the block; the module records the completion date for reference but does not confirm payment with any financial system. Overdue bills appear in the plan as unresolved reminder blocks; the engine does not escalate overdue items beyond surfacing them in the plan and in the module's list view.

Savings goal nudges surface as periodic in-plan reminder blocks on a schedule the user configures. The module captures a goal name, a target amount, and a target date, and calculates the required monthly contribution. A monthly reminder block displays that contribution amount. It does not route the user to any savings account or financial product. Budget check-ins are simple weekly prompts — a note block in the Sunday plan — reminding the user to review their week's spending without providing any data or analysis. The finance module is a calendar reminder layer for financial events, not a financial management tool.

### 6.8 Calendar

The calendar layer operates as the scheduling backbone of the product rather than as a standalone module with its own toggle. All plan blocks — fitness, nutrition, sleep, errands, medication, finance, work, and user-created events — live in a unified daily timeline that constitutes the plan. This timeline is the primary mobile view. On mobile, the plan is displayed as a vertically scrolling day view. On web, the plan is available as both a day view and a week view with a seven-day horizontal layout.

Two calendar surfaces are available at V1 depending on the user's onboarding path. Users who connect a Google Calendar account at onboarding receive a synchronized calendar surface: their existing Google Calendar events (meetings, classes, recurring appointments) populate the plan as fixed, non-movable blocks, and Vesper's AI-generated blocks fill the remaining open time. The sync is driven by webhook: events created or modified in Google Calendar propagate to the Vesper plan in near-real time, and completion state for Vesper-originated blocks does not write back to Google Calendar. Google Calendar is the source of truth for fixed calendar events. The sync is read-heavy by design.

Users who do not connect an external calendar at onboarding use the built-in calendar, a native event management surface built on a forked open-source calendar foundation. Users can create, edit, and delete events directly in the Vesper interface; those events function as fixed blocks in the plan exactly as synced Google Calendar events do. The built-in calendar stores events in the Vesper database. Users can migrate from the built-in calendar to Google Calendar sync at any point after onboarding by connecting their Google account in settings; existing built-in events are not automatically exported to Google Calendar at V1 and must be migrated manually if the user wants their history in Google's system.

Apple Calendar sync is not available at V1 and is deferred to V1.5. Outlook Calendar sync is deferred to V2. Users who maintain their schedule in Apple Calendar or Outlook are directed to the built-in calendar as their Vesper scheduling layer, or to manually enter their fixed events. The limitation is documented in the calendar settings panel for users who attempt to connect either service.

---

## 7. Subscription and Payment

### Trial

Every new account begins in a seven-day free trial. No payment information is collected at signup; the trial starts immediately upon account creation at the conclusion of the onboarding flow without any payment commitment from the user. The trial provides complete access to every V1 feature without restriction. Every module is available to activate, Google Calendar sync is available, and the only usage cap is a soft limit of two plan generations per local day to protect margin on non-converting trial users. There is no reduced-functionality trial tier; the trial is the full product.

The trial period is tracked in the user's subscription status as "trial" and its expiration is driven by a trial expiration timestamp set at account creation. Three reminder touchpoints fire during the final days of the trial. At two days before expiration, the plan includes a butler-voice note: "Two days left in your trial. Anything you'd like to ask before then?" At one day before expiration, a second note appears: "Your trial ends tomorrow. Shall I keep things running?" Both reminders are in-plan and in-app only; no push notification is sent for trial reminders. Twenty-four hours before expiration (day six), the application surfaces a one-tap Apple Pay or Stripe Link conversion prompt that converts the user with a single biometric confirmation; users who do not act on the prompt continue through the standard reminder sequence without being charged. On the expiration date itself, the user's first plan view of the day presents a clean full-screen prompt. The screen displays "Your week is up." and two buttons: Continue and End. Pressing Continue advances to the payment flow. Pressing End transitions the account to read-only state immediately.

If the user does not open the application on the expiration date, the account transitions to read-only state at midnight local time based on the registered time zone. When the user next opens the application in read-only state, they see the Continue or End prompt before accessing any content. The trial-end screen does not time out and cannot be dismissed without making a selection; it is the only mandatory interruption in the product flow beyond onboarding. The account persists indefinitely in trial state if the user never opens the application after signup; no automated deletion is triggered by trial expiration alone.

### Post-Trial Conversion

Users who press Continue on the trial-end screen are routed to the appropriate payment flow based on the surface they are using. iOS users are presented with Apple's native payment sheet via StoreKit 2, which handles the subscription creation entirely within Apple's infrastructure using the payment method on the user's Apple ID. Web users are redirected to a Stripe Checkout page hosted by Stripe, where they enter payment details and confirm. Both flows complete the subscription creation and return the user to their plan within a single interaction session.

Subscription state is managed centrally in the Vesper database regardless of which payment surface processed the conversion. A Cloudflare Worker endpoint receives webhook events from both Stripe and Apple's App Store Server Notifications V2 and updates the user row's subscription status accordingly. Both webhook handlers verify the authenticity of incoming payloads — Stripe's webhook signature verification and Apple's signed JWS format — before processing any state change. The reconciliation between iOS-side and web-side subscriptions is handled by the centrality of the user row: every authenticated API request reads subscription status from the database rather than from the payment provider directly, so the payment source is transparent to the application layer.

The product enrolls in Apple's Small Business Program during the App Store submission process. The program reduces Apple's commission on in-app purchase subscription revenue from thirty percent to fifteen percent for developers earning under one million dollars in annual App Store proceeds. Enrollment requires acknowledgment in App Store Connect and is confirmed by the founder during App Store review preparation. Under the Small Business Program, net revenue per iOS subscriber at the nineteen-ninety-nine price point is approximately seventeen dollars per month after Apple's commission. Stripe's processing fee of two-point-nine percent plus thirty cents per transaction yields approximately nineteen dollars net per web subscriber.

### Payment Methods

On iOS, the user pays through whatever payment method Apple supports on their Apple ID — credit and debit cards, Apple Cash, Apple Pay-linked bank accounts, App Store credit from gift cards or prior refunds, and carrier billing in supported markets. These options are presented and managed entirely by Apple; the product does not interact with them directly.

On web via Stripe, the following payment methods are enabled at V1: credit and debit cards across all major networks (Visa, Mastercard, American Express, Discover, JCB, and Diners Club), Apple Pay, Google Pay, Link (Stripe's one-click checkout for returning users), ACH Direct Debit, PayPal, and Cash App Pay. Buy-now-pay-later methods including Klarna and Afterpay are not enabled; they are designed for one-time purchases with installment plans rather than recurring monthly subscriptions and do not integrate cleanly with monthly billing. Cryptocurrency is not enabled at V1.

### Cancellation

Cancellation is handled by the payment platform on which the user subscribed. iOS subscribers cancel through Apple's subscription management interface, accessible from the iOS Settings app or the App Store subscriptions page; Vesper does not present a cancellation flow for iOS subscribers within the product, as Apple manages this relationship. Web subscribers cancel through the Stripe Customer Portal, accessible from a "Manage subscription" link in the user's account settings; the portal is hosted by Stripe and styled to match Vesper's warm-dark design system to the extent Stripe's customization options allow.

No retention modal, discount offer, or additional confirmation screen appears at any point in the cancellation flow. The user's decision to cancel is acknowledged by the product with a single butler-voice confirmation: "Of course. Your data will be here for thirty days if you'd like to come back." The subscription transitions to read-only state immediately upon cancellation confirmation. The seven-day read-only continuation window, followed by a thirty-day archive period, followed by account deletion applies identically to the post-cancellation path as to the post-trial-end path. Forty-eight hours after cancellation, a single transactional email asks one no-oriented question: "Was there anything we could have done differently?" The email has no required response, no multi-page survey, and no offered incentive. No further win-back communication is sent at any subsequent interval.

### Refunds

The stated refund policy is: no refunds. The seven-day free trial is the evaluation period; after conversion to paid, monthly charges are not refunded. This policy is documented in the terms of service and on the pricing page in plain language: "After your one-week free trial, monthly subscriptions are non-refundable. Cancel anytime to stop future charges."

Two practical exceptions apply without being advertised. iOS subscribers can request a refund through Apple's standard refund flow, which Apple manages independently of the product's stated policy. Apple grants or denies the refund based on its own criteria; the product receives a notification when a refund is processed and adjusts the user's subscription state accordingly. Web subscribers may receive a refund at the founder's sole discretion in documented hardship cases — verified technical failures that prevented use, accidental double charges, and similar situations — issued manually through the Stripe dashboard. This discretion is exercised as individual acts of customer service and is not surfaced or advertised anywhere in the product.

### Production Hosting/Brand Domain

The production domain is registered at approximately Project Week 22 (start of Phase 5 internal alpha). Before that point, the application runs against localhost during development and Vercel preview URLs (*.vercel.app) for any external surface. The waitlist landing page locked in Layer 4's Marketing Visual Language section is built during Phase 4 and deployed to a preview URL until the domain is registered, then re-deployed to the production domain at Week 22. The eight-week-pre-launch waitlist live date in the Layer 6 master calendar (Project Week 22) coincides with this domain go-live, so the landing page is live on the real domain from the moment it accepts public signups.

---

## 8. Out of Scope for V1

The following features are not present in V1. Each entry documents the feature's planned destination and the primary reason for its exclusion from the initial release. Features marked "killed" are permanently excluded from all planned versions of the product.

**Cross-week task rebalancing.** V2. The planning engine at V1 is scoped to the current day and next-day preview; multi-day deadline-aware reshuffling requires a more complex planning model that is deferred to V2.

**Apple Calendar sync.** V1.5. Google Calendar covers the primary user base at V1. Apple Calendar sync requires a separate OAuth implementation and slots cleanly into V1.5 without blocking the V1 build.

**Outlook Calendar sync.** V2. Lower priority than Apple Calendar for the target demographic at launch; deferred to V2.

**Android application.** Post-V1 fast-follow, not assigned to a versioned roadmap milestone. Development begins as a friend-assisted project immediately after V1 ships; no delivery date is committed because timing is contingent on friend availability.

**Voice input.** V1.5. Natural-language text commands ship at V1; voice input is the next interaction mode and is a clean V1.5 addition once the core text-command surface is proven.

**Email AI-read for scheduling.** V1.5. Reading calendar invites from email to auto-populate the plan requires two explicit user consent gates and meaningful privacy infrastructure. Deferred to V1.5 after the core scheduling experience is established.

**Wearable integrations** (Apple Health, Google Fit, Oura, Fitbit, Whoop). V2. Wearable data meaningfully improves recovery estimation and sleep quality tracking but requires platform-specific API work that is out of scope for the V1 build period.

**Apple Watch companion app.** V2. Dependent on wearable integration infrastructure from V2.

**Quantified-self dashboards and correlation insights.** V1.5, Optimizer tier. Dashboard features require a minimum of approximately thirty days of accumulated user data to be meaningful. Introduced as the differentiating feature of the Optimizer tier at V1.5.

**Annual billing option.** V2. Monthly billing is sufficient at V1. Annual billing introduces pro-rated cancellation complexity and renewal timing edge cases not worth carrying in the first version.

**Optimizer pricing tier.** V1.5. A second paid tier above Standard is planned but does not ship until its differentiating features — dashboards, deeper AI customization, weekly AI-generated insights — are ready at V1.5.

**Learning module** (language practice, course progress tracking, reading time, podcast queues). V2. A legitimate Life OS addition but outside the core scheduling mission at V1.

**Travel module** (trip mode, packing checklists, jet lag scheduling, transit timing). V2. Episodic use case that can wait until the core daily-use product is proven in normal conditions.

**Career and work admin module** (follow-ups, applications, networking touches, expense logging). V2. Adjacent to the work module but distinct enough to warrant its own build cycle and scope decision.

**Hobbies module** (creative practice block scheduling). V2.

**Mood module** (light mood log tied to the energy check-in). V1.5. Close to V1 in scope but cut for launch discipline; folds naturally into the energy check-in surface at V1.5.

**Social feeds, sharing, and public profiles.** Killed. Direct conflict with the calm butler ethos and the solo-user positioning. Social mechanics introduce moderation overhead and fundamentally alter the product's identity.

**Team and family shared plans.** Killed. A different workflow, a different pricing psychology, and an entirely different product surface. Not on any roadmap.

**Habit tracking with streaks.** Killed. Gamification in any form conflicts with the product's dignified, anti-overwhelm identity. Streak mechanics produce shame on failure, which is the opposite of the intended emotional effect.

**Browser extensions.** Killed. Niche utility relative to build cost, with no clear integration path into the core daily plan workflow.

**AI chat as primary interface.** Killed. The natural-language input surface accepts single-turn commands; the butler delivers, it does not converse for the sake of conversation. Persistent conversational state across turns is not part of this product.

**Home screen widgets.** Killed. A user who must scan their home screen to find the widget has already recalled the thing the widget was supposed to surface. The Dynamic Island serves the ambient awareness use case more effectively without requiring a home screen slot.

**Bank account or financial institution connectivity.** Killed. The privacy surface, data custody obligations, and operational complexity are permanently incompatible with the product's posture. The finance module operates entirely on user-entered data in all versions.

**Grocery delivery native integration.** Not in V1 or near-term roadmap. The grocery list routes to the nearest stocked store and can surface an Instacart link where available, but native delivery integration is not built and is not scheduled.

**Buy-now-pay-later payment methods** (Klarna, Afterpay). Not enabled for subscriptions. Designed for one-time purchases with installment plans; does not apply to monthly recurring billing.

**Cryptocurrency payment.** V3 review only. Reconsider if Stripe expands native subscription support for crypto; no demand signal at V1.

**Family or team pricing plans.** Killed through V1.5. Reviewed at V3 only if explicit user demand surfaces with sufficient scale.

**Pricing experiments.** Deferred to V3 per founder direction. No A/B testing infrastructure, PostHog feature flags, or holdout cohorts are activated at V1 or V2. All pricing decisions during V1 and V2 are based on observed signal, not controlled experiments.

---

## 9. Open Items

The following items remain unresolved after six planning layers. Each entry documents what is pending and the trigger event that resolves it.

**Domain TLD.** The primary domain for the product has not been finalized. Candidates are vesper.studio, vesper.day, and vesper.care. Resolution trigger: Phase 3 environment setup (project week five), when domain registration is required to begin hosting configuration and third-party API account setup.

**Founder reveal threshold.** The anonymity posture established in Layer 1 includes a commitment to specify a concrete revenue figure or event trigger for a potential founder reveal. That threshold was not pinned across the six planning layers. Resolution trigger: founder decision before V1.5 launch, at which point the anonymity posture is re-evaluated against observed product traction.

**Ambient sound design.** The design system specifies optional ambient sound assets (fireplace crackle, clock tick, page turn) with a toggle in settings. The actual audio assets have not been sourced or produced. Resolution trigger: Phase 3 or Phase 4 build; the build calendar will confirm whether these assets are in scope for V1 or become a V1.5 addition.

**Custom icon production.** Eight custom hero icons are specified in the design system but have not been designed. Resolution trigger: Phase 3 design sessions, before the mobile application shell is constructed in build month one.

**Design validation sessions.** Two to three prototype validation sessions are recommended before build begins to confirm motion choices, atmospheric direction, and landing page concept against rendered output. These sessions have not been scheduled. Resolution trigger: pre-build Phase 3.

**Stripe and PostHog public dashboard URL.** The open-metrics dashboard that will be shared in the launch-day Indie Hackers post requires configuration during the build phase. The exact URL is not known until configuration is complete. Resolution trigger: Phase 4 build, finalized before project week twenty-five.

**Android shipping date.** Android development begins as a friend-assisted fast-follow after V1 ships. The delivery date is contingent on friend availability and has not been committed. Resolution trigger: post-V1 launch coordination with the involved friends.

**Newsletter pitch list completeness.** A starting set of seven newsletters for post-launch outreach is documented in the growth plan. Additional candidates may surface during the build period. Resolution trigger: continuous refinement by the founder before launch week.

**Reddit AMA specifics.** The AMA is scheduled for day three or four post-launch. The specific subreddit and exact date are determined in the days immediately before launch based on observed launch-day Reddit traction. Resolution trigger: launch week.

**Optimizer tier pricing.** The second paid tier above Standard is tentatively priced at $29.99 per month. Final pricing locks during V1.5 development based on closed beta feedback from V1 users. Resolution trigger: V1.5 development kickoff.

**Privacy policy and terms of service tooling.** Termly is the working assumption for generating compliant legal documents. An alternative generator may be substitutable if it covers the same regulatory ground at lower cost. Resolution trigger: Phase 3 environment setup.

**Medication module refill automation.** Automatic refill calculation based on entered supply quantity and dose frequency is a V1.5 candidate identified during module specification but not formally scheduled. Resolution trigger: V1.5 scoping session immediately after V1 launch.
