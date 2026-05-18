# Open-Source Inventory

## Purpose of This Document

This document catalogs open-source libraries, free APIs, and free-tier tools the project leverages to reduce custom build work. The intent is that any component, integration, or piece of infrastructure that has a proven open-source equivalent gets forked or installed rather than rebuilt. Founder build time is reserved for the product's actual differentiators: the AI plan engine logic, the local intelligence orchestration, the warm-dark visual identity, and the butler-tone copy throughout the app.

This document is the reference Claude Code should consult before implementing any new feature. Before writing a custom calendar surface, drag-and-drop interaction, charting library, or notification system, the inventory below should be checked. If a listed component covers the need, fork or install it rather than rebuild.

## How to Use This Document

During Layer 3 (Technical Architecture), this inventory informs stack decisions. During Phase 3 (Environment Setup), the listed dependencies are installed when relevant. During the V1 build phase, the relevant section is reviewed at the start of each module's implementation. The inventory is not exhaustive forever; if a better open-source option emerges, it should be added here and the older recommendation marked as superseded.

All listed components use permissive licenses (MIT or equivalent) unless noted otherwise. Licenses should be verified before integration in case of upstream changes.

## Frontend Design Strategy

Frontend visual quality is a primary retention driver. The strategy combines AI-assisted design generation with open-source component foundations and custom design system tokenization.

**Primary tool — Claude Design:** Claude Design is an Anthropic Labs product available within the Claude Pro subscription that generates polished design and code output through natural-language conversation. It is the recommended primary tool for web frontend scaffolding for this project. The advantages over alternative AI design tools are specific to this project's context. First, Claude Design has its own weekly usage allowance that sits alongside Chat and Claude Code limits rather than inside them, meaning design work does not compete with build sessions for the same five-hour Pro plan rate-limit window. Second, Claude Design generates real, functional code (HTML, React, SVG) that the project owns and can modify freely, with no lock-in. Third, once Layer 4 defines the warm-dark design system, Claude Design can read the project codebase and design files and automatically apply the design tokens (colors, typography, components) to every subsequent project. Fourth, Claude Design packages completed designs into a handoff bundle that passes to Claude Code with a single instruction, integrating natively with the project's primary build tool. The tool is in research preview with beta-period rate limits subject to change, so behavior may evolve.

**Fallback tool — v0 by Vercel:** v0 generates initial shadcn/ui component scaffolding and remains a viable fallback if Claude Design rate limits are hit or if a specific component scaffolding need is better suited to v0's workflow. v0 has a free tier that covers typical project usage. Output is raw React code that the project owns. Lovable.dev was considered as an alternative but rejected because it generates full applications including backend, which is more than the project needs given the architecture is already decided.

**Ideation tool — Google Stitch:** Stitch by Google Labs is a free browser-based UI design tool that generates multi-screen interactive prototypes from natural language prompts. It has no cost (400 generations/day free, no credit card) and exports HTML/CSS and Figma layers. Stitch is useful for rapid visual exploration before the design system is locked — generating five to ten layout directions quickly without burning Claude Design allowance. Once Layer 4 tokens are finalized, Stitch is superseded by Claude Design for production-quality output. Use Stitch at the start of Layer 4 for divergent exploration, Claude Design for convergent execution.

**Web frontend workflow:** Claude Design generates page and component layouts based on Layer 4 design tokens. The handoff bundle passes to Claude Code, which integrates the output into the project repository. Tailwind config customization applies the warm-dark design tokens consistently across the component library.

**Mobile frontend:** React Native does not have direct Claude Design or v0 mobile equivalents at the same maturity level as web. The mobile equivalent of shadcn is shadcn-react-native, used in combination with NativeWind (Tailwind for React Native). The same design tokens from Layer 4 apply across both web and mobile through shared Tailwind configuration. Component layouts are built manually rather than generated, but the same aesthetic discipline applies.

**Why this approach:** Claude Design and v0 are both hosted tools, but the code they generate is open-source. The project incurs no lock-in and pays nothing for code ownership. The component-level focus of both tools matches the project's workflow where Claude Code is the primary builder.

## Cowork: Not Recommended for the V1 Build Phase

Cowork is Anthropic's desktop agent product available within the Claude Pro subscription. It brings Claude Code's agentic capabilities to a non-developer interface for tasks like file organization, data extraction, content workflows, and report generation. Cowork is included in the Pro plan but consumes the same usage pool as Chat and Claude Code, meaning Cowork sessions directly reduce capacity available for Claude Code build sessions.

For this project's V1 build phase, Cowork is explicitly not recommended. The founder is using Claude Code as the primary build tool, and Cowork's capabilities overlap with what Claude Code already handles within the build directory. Using Cowork during the build would steal tokens from build sessions for marginal benefit.

Cowork may have legitimate use cases later in the project lifecycle. Examples include: template content preparation (batch organizing recipe data from TheMealDB exports or workout descriptions from ExerciseDB into seed files), closed beta feedback synthesis (organizing user research notes into themes), and content operations during launch ramp (processing screenshot folders into social posts). These uses arise post-launch or in dedicated content-ops phases and should not interfere with build sessions.

The default disposition during the V1 build phase is to leave Cowork unused.

## Inventory by Domain

### Core Stack and UI Components

- **shadcn/ui** (web): copy-paste accessible components including buttons, dialogs, dropdowns, sheets, forms, and complete dashboard examples. Built on Radix primitives. Owned code, full restyle freedom. Saves approximately two to three weeks of component implementation
- **React Native Reusables**: the shadcn equivalent for React Native. Same architectural philosophy, same time savings
- **NativeWind**: Tailwind CSS classes in React Native. Enables shared design tokens between web and mobile through a unified Tailwind config
- **Radix UI** (web): unstyled accessible primitives. Use directly if shadcn does not cover a specific need
- **Lucide Icons**: modern open-source icon set, used by shadcn by default. Roughly 1,500 icons
- **Phosphor Icons**: alternative icon set with more variation, fits warm aesthetic if Lucide does not
- **Reanimated**: React Native animation library, industry standard
- **Framer Motion**: web animation library, industry standard

### State Management and Data Layer

- **Zustand**: lightweight state management. Replaces Redux at roughly 10% of the code volume for projects of this size
- **TanStack Query**: server state management with caching and revalidation. Critical for offline-resilient plan sync
- **Drizzle ORM**: type-safe database queries on Supabase. Lighter than Prisma
- **Zod**: schema validation. Pairs with Claude API structured outputs for runtime AI response validation

### Calendar (Built-in Calendar Fork)

- **react-native-calendars**: mobile calendar component library. Strong base for the built-in calendar locked in Layer 2
- **FullCalendar** (standard tier, free): web calendar with month, week, and day views. Premium features are paid but the free version covers V1 needs
- **react-big-calendar**: alternative web calendar library
- **date-fns** or **Day.js**: lightweight date math libraries. Use date-fns for tree-shakability, Day.js for size

### Local Intelligence Layer

The local intelligence layer is the product's primary differentiator and also the largest potential API cost. Open-source and free-tier options dominate here.

- **react-native-maps**: free map rendering on mobile
- **Leaflet** with **react-leaflet**: totally free map rendering for web. No API key required. Uses OpenStreetMap tiles by default
- **OpenStreetMap**: free POI data globally. The backbone of the cost-containment strategy
- **Nominatim**: free geocoding from OpenStreetMap. Rate-limited but workable at low user counts; can self-host for higher volume
- **Overpass API**: free POI queries against OpenStreetMap data
- **OSRM**: free open-source routing engine. Self-hostable for full control or usable via the demo server at low volume
- **Google OR-Tools**: free constraint solver and route optimizer. Useful for the errands batching feature where the system needs to compute the optimal sequence of stops
- **Mapbox GL JS**: web map rendering with a generous free tier (50,000 map loads per month free at time of writing)
- **Mapbox Directions API**: cheaper than Google Maps for routing, used by the project for traffic-aware buffers
- **Yelp Fusion API**: free tier of 5,000 calls per day, sufficient for restaurant and cafe data at low user counts

### Drag and Drop, Reordering

- **react-native-draggable-flatlist**: drag and reorder blocks on mobile
- **@hello-pangea/dnd**: active fork of react-beautiful-dnd for web
- **dnd-kit**: modern web drag-and-drop with more flexibility than react-beautiful-dnd

### Charts and Data Visualization (V1.5 Paid Dashboards)

- **Tremor**: full dashboard component kit for web. Beautiful out of the box. Significant time savings for the paid-tier dashboard
- **Recharts**: composable web chart library, widely used
- **Victory Native**: React Native chart library
- **react-native-svg-charts**: alternative for React Native
- **Visx** (Airbnb): D3 with React, for custom advanced charts when defaults are not enough

### Authentication

- **Supabase Auth UI**: pre-built sign-in and sign-up components, free with Supabase
- **Auth.js** (formerly NextAuth): alternative for web if going custom
- **Clerk** open examples: reference patterns for OAuth flows even though Clerk itself is paid

### Billing and Stripe

- **Stripe Checkout**: hosted checkout page, free to use, eliminates custom checkout UI work
- **Stripe Customer Portal**: hosted subscription management page, free, eliminates custom billing settings UI
- **Stripe Pricing Tables**: embeddable pricing tables for the landing page

These three hosted Stripe features collectively save approximately one to two weeks of billing UI work and significantly reduce the regulatory and security surface that the project owns directly.

### Transactional Email

- **React Email** (Resend's library): write transactional emails in React/JSX components. Open-source library with many pre-built templates
- **MJML**: older but widely-supported email markup language for complex layouts

### Domain-Specific Data Sources

Workout and recipe template seeding leverages existing free databases rather than original content creation at V1.

- **ExerciseDB**: free API with over 1,300 exercises tagged by muscle group, equipment, and difficulty. Includes animated GIFs
- **Free Exercise DB** (GitHub: yuhonas/free-exercise-db): JSON dataset of exercises, no API needed, self-hostable
- **wger**: full open-source workout manager. Can fork data structures and exercise database
- **TheMealDB**: free recipe API with images, ingredients, and instructions
- **USDA FoodData Central API**: free official US nutrition data including calories and macronutrients
- **Open Food Facts**: massive free food product database including barcodes, nutrition, and ingredients
- **Edamam Recipe API**: richer recipe data on free tier (limited calls per month)
- **Spoonacular API**: free tier for recipe and nutrition data

### AI Integration

- **Vercel AI SDK**: handles streaming, structured outputs, and multi-provider support. Significant time save on AI integration plumbing
- **Anthropic SDK** (official): Claude API client for direct integration

### Notifications and Push

- **Expo Notifications**: handles iOS and Android push notifications in one library, free
- **Firebase Cloud Messaging**: generous free tier for push notification backend
- **react-native-push-notification**: alternative direct integration if Expo Notifications proves insufficient

### Dynamic Island and Live Activities (iOS V1)

- **expo-live-activities**: Expo module for iOS Live Activities. Active development. Saves the Swift bridging work that would otherwise be needed
- **swift-activity-kit examples**: reference implementations on GitHub for the Live Activity Push Start lifecycle locked in Layer 2 Pillar 8
- **react-native-live-activities**: community React Native binding for ActivityKit

### Forms and Validation

- **React Hook Form**: performant form library, pairs naturally with Zod for schema validation
- **TanStack Form**: newer alternative with strong TypeScript ergonomics

### Markdown Rendering

For recipe instructions, settings explainers, and any long-form content surface.

- **react-native-markdown-display** (mobile)
- **react-markdown** (web)
- **MDX**: if mixing markdown with React components becomes necessary

### Onboarding Tours and Tutorials

- **reactour** (web): guided tour library
- **react-native-walkthrough-tooltip**: tooltip-based tour for React Native
- **Shepherd.js**: framework-agnostic tour library, works in both web and embedded contexts

### Toasts and Feedback

- **Sonner** (web): clean modern toast library
- **Burnt** (React Native): native iOS and Android styled toasts
- **react-native-toast-message**: older but stable React Native toast library

### Splash Screens and Loading

- **expo-splash-screen**: splash screen handling for React Native
- **react-content-loader**: skeleton loading states for web
- **react-native-skeleton-placeholder**: skeleton loading states for React Native

### Analytics and Error Tracking

- **PostHog**: analytics, feature flags, and session recording. Open-source with a generous free tier. Self-hostable if data sovereignty becomes a concern
- **Sentry**: error tracking with a free tier covering early-stage usage
- **GrowthBook**: open-source feature flags as an alternative to PostHog flags

### Voice Input (V1.5)

- **Whisper API** (OpenAI): speech-to-text, approximately $0.006 per minute. Cheap enough to use as the default
- **react-native-voice**: native iOS and Android speech recognition, free, runs on-device. Good fallback for users without internet
- **Web Speech API**: free browser-based speech recognition for the web surface

### Testing

- **Vitest**: fast unit testing framework
- **Playwright**: end-to-end web testing
- **Detox**: end-to-end testing for React Native

### Build and Deployment

- **Expo Application Services (EAS)**: managed React Native build and submission
- **Vercel CLI**: web deployment
- **GitHub Actions**: CI/CD templates for both web and mobile

## What to Build Custom

The following are explicitly excluded from open-source forking because they are either the product's core IP or are so specific to the product's positioning that no general-purpose component fits. Founder time should concentrate here.

- **AI Daily Plan Engine logic**: the base-plus-diff model, archetype selection, hybrid reshuffle algorithm, and proactive check-in surfacing are the product's core differentiator. No shortcut exists
- **Template selection AI prompt design**: the prompts that drive fitness and nutrition template selection, energy-slider scaling, and contextual adaptation are proprietary product logic
- **Local intelligence orchestration layer**: how grocery routing, restaurant suggestions, and errands batching specifically surface and interleave is product-specific
- **Visual design and brand identity**: the warm-dark dusk-manor aesthetic is the product's positioning and must be original. Layer 4 work
- **Onboarding flow choreography**: the adaptive branching between calendar-connected and no-plan users, the archetype tab interface, and the warm-tone copy are all specific to the product
- **Natural-language input UX**: the surface design that avoids feeling like a chat bot is Layer 4 work
- **Dynamic Island content design**: the per-block content templates, glance copy, and expanded states are product-specific
- **Energy slider to routine intensity mapping**: the logic that translates a 1-to-10 energy reading into workout difficulty, recipe complexity, and task density adjustments is product-specific
- **Butler-tone copy throughout the app**: all user-facing copy must match the voice locked in Layer 1. No template substitutes for original copy in the product's voice

## Approximate Time Saved

Stack assembly with aggressive open-source leverage versus building all infrastructure from scratch saves approximately three to four months of pure infrastructure and component work on the V1 build. That time is reinvested in the differentiated logic listed above, in product polish, and in the rough internal alpha period where real usage surfaces friction.

## Cost Summary

Every component in this inventory is either fully open-source, free at low usage, or has a free tier sufficient for the project's V1 user count targets (5,000 signups at three months post-launch). Approximate paid API costs at low user counts are estimated as part of Layer 3's infrastructure cost analysis. The total recurring cost of the open-source inventory itself, before scaling beyond free tiers, is zero.

## Maintenance Notes

This document should be updated whenever a new open-source component is adopted into the project or whenever a listed component is replaced or deprecated. New layers of the brainstorming phase that surface new technical needs should add the relevant inventory entries here rather than scattering them across other documents.

When Claude Code is asked to implement a feature, the inventory should be referenced first to determine whether an open-source equivalent exists. The default disposition is "fork before build" for any infrastructure or commodity-component need.
