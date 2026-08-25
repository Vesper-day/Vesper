# VISUAL_DIRECTION_BANK.md

> **✅ ACTIVE (MOTION / IMMERSIVE-STAGING ONLY) — re-activated by the rich re-overhaul; AI-GENERATED-IMAGERY parts STAY RETIRED.** This bank captures the **immersive** motion/staging direction. Under the rich re-overhaul the **motion + immersive-staging direction is active again** — smooth-scroll (Lenis), timeline/scroll motion (GSAP ScrollTrigger), WebGL backgrounds (Vanta + Three.js), react-bits animated components, layered depth, and scroll-driven staging are **live direction**, executed on the single build model with **reduced-motion → instant** mandatory. **What STAYS retired (do NOT restore):** the **AI-atmospheric imagery / AI-generated stills / manor-3D generated scenes** and the reel-still asset pipeline — the AI-image/video GENERATION pipeline is **not** resurrected; richness comes from code libraries, not generated art. So: consume the **technique / motion / staging** content as active direction; **ignore** any instruction here to generate or place AI-generated imagery (translate those slots to code-driven WebGL/CSS staging instead). Current authority: `docs/DESIGN_STRATEGY.md` (rich-posture banner) and `docs/PHASE_4_BUILD_PLAN.md` → Addendum → "Design-Track Re-Overhaul." The committed 107/107a token values are unchanged.

**Purpose.** A distilled, durable record of the design-reference recon for the Vesper landing page. Any "-V" design chat consumes *this* file instead of re-watching the 9 reels or re-browsing the four reference sites. It captures **motion + staging direction only** — palette, type, copy, and brand are locked Layer-4 decisions and are not re-opened here.

**Status.** Direction-only. Not a build spec, not a component API. A design/build chat reads this alongside `LAYER_4_EXPERIENCE_IDENTITY.md` and the design system; where this bank and an authority doc disagree, the authority doc wins.

**Scope guardrails.**
- Framer/reference sites are *visual-spec input only* — nothing is exported; everything is rebuilt native against `@vesper/ui`.
- This bank invents **no** new palette, type, brand, or copy. Any reference that implies one is translated down to the locked system or rejected.
- Bright/cool reference registers (igloo cool-grey, lusion lavender, cosmic-magenta, racing-lime) are **translate-down** sources for *technique*, never palette.
- Real-person / real-photo references (landonorris; reel social-proof) inform layout vocabulary only — Vesper's anonymity posture (no founder face, no real-face testimonials, AI-atmospheric imagery) is absolute.

---

## 0. The locks this bank obeys (pulled fresh from project files)

**Palette (Layer 4 › Color System, exact hex).**
`bg-primary` espresso `#1E1815` · `bg-surface` `#2B221C` · `bg-elevated` `#38291E` · `text-primary` cream `#E8DDC9` · `text-secondary` `#A89B85` · `text-tertiary` `#756B57` · `accent-bronze` `#B8884A` · `accent-oxblood` `#5C2A2A` · `border-subtle` `#3D332A` · `border-strong` `#5C4F40` · `state-success` `#6B7A5A`. Bronze is the **single** accent; oxblood is secondary/destructive only.

**Type (Layer 4 › Typography).** Display **Fraunces** (Display 1 48–64pt / 500 / opsz 24 / -0.02em → Display 3 24–28pt; italic butler line 14–16pt). Body **Inter**. Labels/times **JetBrains Mono** (~5–8% of all text). Display line-height 1.2; body 1.5; butler line 1.4.

**Motion bands (Layer 4 / DESIGN_SYSTEM `VesperMotion`).** `quick` 150–250ms · `considered` 300–500ms · `slow` 600–900ms · `cinematic` 1000–2000ms · `instant` (reduced-motion). Easing tokens: `standardOut`, `standardIn`, `cinematic`, `spring` (damping 18 / stiffness 150).

**Scorekeeping-as-absence.** No score, streak, badge, points, level, leaderboard, or progress bar — enforced as *component absence*. Numbers on the landing must stay abstract/decorative; never attach a live counter to anything that reads as user progress.

**Landing composition (Layer 4 › Marketing Visual Language).** One scroll-driven cinematic page, ~5–6 viewport heights, generous breathing. Five sections, in order:
1. **Hero — interactive sample-day demo** (wake time + archetype → a day composes with butler narration; no signup). 3D manor-study scene retained *below* the demo as atmospheric support ("Good evening. Let's see to your day.").
2. **What Vesper does** — camera to desk; plan animates on the on-desk screen; Fraunces Display 3 butler copy alongside.
3. **Modules** — camera through the room; each module is a staged artifact (kettlebell, plate, clock, key, bottle, envelope).
4. **How it works** — phone by the lamp lights with a Dynamic Island animation.
5. **Pricing + signup** — pull back to full room; "One week free. After that, $19.99 per month. iOS launching shortly. Web works everywhere in the meantime."; single email + iOS/Android segmented control + "Begin".

**Existing Layer-4 interaction mechanisms (already specced — the references *stage* these, they don't add new tech).** Lamplight cursor (warm radial follow, +8% local / −3% surround, 60fps-capped). Block-depth-on-hover (plan blocks lift 2–4px translateY toward cursor, deeper shadow; click = "pick up a card"). Typography breath (hero copy 100%↔100.5% over 4s; body never breathes). Page-turn transitions (~400ms, reduced-motion → fade). Click-ripple (bronze, 400ms). Loading-as-art (candle-flame / ember-pulse Lottie; first plan ~3s candle grows). Time-of-day lighting in the scene. Material texture (vellum noise ~3%, leather press, carved-wood corner darkening ~5%). Easter eggs (readable book spines, desk watch = visitor time, handwritten aphorism). Idle dimming (−15% after 2 min).

**Technical constraints.** Page weight **< 4MB** (relaxed for exactly one blur-up hero asset per decision 3). Low-poly **Three.js / React Three Fiber**; GLSL shaders **precompiled at build** (`vite-plugin-glsl`) — CSP has **no `unsafe-eval`** (Decision 13), so no runtime shader/eval techniques. (`CSP_NOTES.md` notes "no Three.js ships at V1" for the *app*; the landing's precompiled-shader R3F is the scheduled exception, not a violation.) Web motion = CSS transitions on `@vesper/ui` token classes (`duration-quick`, `duration-considered`) + `useReducedMotion`; tokens never hardcoded. **GSAP ScrollTrigger + Lenis** allowed on the **landing only** (decision 1) — **must be CSP-verified at build** (grep bundle for `eval` / `new Function`). Reduced-motion fallback for the hero = static cream→espresso gradient + wordmark.

---

## 0b. Operator decisions (locked)

| # | Decision | Resolution |
|---|---|---|
| 1 | Scroll/motion engine | **A** — GSAP ScrollTrigger + Lenis, landing only (app stays CSS-token motion). Barba.js rejected (single route). CSP-verify at build. |
| 2 | Hero interactivity level | **B** — staged-cinematic hero + **one** restrained cursor-reactive beat (no heavy WebGL particles/physics). Operator may upgrade to C (true WebGL showpiece) after seeing built screens. |
| 3 | Hero asset fidelity | **C** — one progressive **blur-up** high-res hero asset; everything else compressed. Relaxes the <4MB cap for the hero only. |
| 4 | Social proof | **C** — quote testimonials (first name + role, **no photos**), warm-dark cards. Satisfies the social-proof instinct without breaking anonymity. |
| NEW-1 | Hero identity | **A** — keep Layer-4's locked interactive sample-day hero; apply igloo/reel-8 object-staging craft to the **manor backdrop + modules section only**. Do **not** demote the demo for a single staged object. |
| NEW-2 | Landing preloader | **A** — progressive/lazy load, **no** branded preloader (it wouldn't make the page faster, only ceremonial; with no heavy WebGL there's nothing to mask). Optional ~600ms bronze-V "breath" flash is available purely for ceremony — **deferred / off** unless operator asks. |
| NEW-3 | Bronze-thread motif | **Adopt (subtle, removable)** — a thin bronze "thread" (read: a ribbon bookmark trailing through a manor study's books) quietly weaves section to section for cohesion. Lusion-derived; translated to the warm-dark register. Trivially removable if it reads as too much. |

---

# PART A — Reference Log

Each entry: **what it is → keeper beat(s) → extractable technique → verdict (adopt / translate-down / reject) → re-capture pointer** (so any -V chat can re-grab the still deterministically).

## A1. Design sites (browsed live, desktop 1440×900 + mobile 390×844)

### igloo.inc — *primary Layer-4 craft reference (cool-tech register)*
- **Hero.** Hyper-real single 3D igloo on snowy terrain, glowing block seams, atmospheric fog/depth, all-monospace UI overlay, long ASCII/swift-mark preloader. → *Single hero object staged in an atmospheric environment with depth + fog.* **Adopt** the staging discipline (it's already Layer-4's named reference); register translates cool-grey → warm-dark.
- **Cursor-disassembly hover.** Cursor over the igloo lifts/scatters the blocks into an exploded cloud with **technical measurement-lines + live decrementing numbers** between vertices; reassembles when idle. → *Object reacts to cursor + precise instrument overlay.* **Translate-down**: keep the "object responds to cursor" idea (maps to Layer-4 block-depth-on-hover, dialed up for the hero); keep a *thin mono measurement-line texture* as decorative overlay **but** the numbers must stay abstract (scorekeeping-absence — no live counters that read as progress).
- **Rings section.** Two concentric segmented ice-glyph rings **slowly counter-rotate**, glowing seams sweeping, glyph breathing in haze. Calm, contemplative pace. → *Slow counter-rotating brand-glyph "orrery."* **Adopt** — the calm pace is butler-quiet-compatible; becomes a slow bronze-edged Vesper-V/glyph in espresso fog (optional ornament, e.g. a section divider or the "How it works" lamp halo).
- **Penguin section.** Dense **point-cloud** penguin on a pedestal; cursor-drag scatters the particles into a turbulent cloud; **springs back to shape** when idle; crop-mark social labels cycle beneath (LinkedIn / X / Medium); nav arrows flank. → *Point-cloud object that holds a shape, scatters on cursor, reforms when idle.* **Translate-down (idea only)**: cleanest example of decision-2=B's reform-to-shape hook, but **heavy as real particles** — adopt the *gesture*, not the particle budget (a light CSS/canvas reform or a staged object that simply lifts/settles is the Vesper-weight version).
- **Section transition.** Scroll dollies the camera *into* the igloo, then a **datamosh / RGB chromatic-split pixel-dissolve** → fog wash → next scene. → **Reject the glitch** (energetic/digital, breaks butler-quiet). **Adopt** the camera dolly-in + **fog-wash dissolve** between scenes.
- *Re-capture:* `https://www.igloo.inc` — hero (load ~16s, fresh tab; WebGL context exhausts after several 3D pages); hover the igloo center for disassembly; **scroll is hijacked — operator must scroll manually** to reach rings then penguin; drag-cursor across the penguin to scatter.

### lusion.co — *bright-lavender register; physics/scroll showcase*
- **Hero.** Glossy physics "jacks" cluster (cobalt/black/white/grey) in a rounded-rect viewport; **cursor-repel** scatter on drag; crop-mark "+" framing; clean grotesk headline. → *Cursor-repel physics + crop-mark framing.* **Translate-down**: repel is heavy physics (skip); crop-mark "+" framing is a **translate-down candidate** but Vesper already has mono/line texture — use sparingly if at all.
- **Viewport-grow.** The bordered hero viewport **grows toward full-bleed on scroll**, resolving into an oversized grotesk reveal ("Bold Ideas, Brought to Life"). → *Scroll grows a framed scene to full-bleed + big-type reveal.* **Adopt (translated)**: the camera-into-room dolly already does this in spirit; the big-type reveal maps to Fraunces Display 1 hero copy resolving on scroll.
- **Fluid ribbon.** A single **fluid blue/cyan ribbon weaves through every section** as a connective spine. → *One recurring thread tying sections together.* **Adopt → NEW-3 bronze thread** (warm-dark translation; subtle, removable).
- **Work grid.** Autoplaying video tiles + category tags + **per-letter scramble-in** titles. → *Editorial media grid; staggered text reveal.* **Translate-down**: the modules section is the Vesper analogue (staged artifacts, not video tiles); the staggered text reveal is fine in `quick`/`considered` bands.
- **Scroll-scrubbed 3D device** that rotates/scales to **full-bleed immersive scene**; **footer** = neon sticker-confetti "Let's Work together / IS YOUR BIG IDEA READY TO GO WILD?" + address/socials/newsletter/©2026 + "KEEP SCROLLING → ABOUT US". → device-breakout **reject** (too much); neon-confetti footer **reject** (register clash).
- *Re-capture:* `https://lusion.co` — synthetic scroll works; long page (~12+ viewport heights); drag cursor through hero jacks to scatter; footer is the neon CTA.

### landonorris.com — *closest register to Vesper (warm-dark olive); editorial*
- **Hero.** Centered portrait on near-white; faint **topographic contour-line** ambient texture; **serif-over-condensed-sans wordmark stack**; lime "STORE" pill; **"NEXT RACE" status-widget card** (track outline + laurel crest) bottom-left. Cursor over the head **"paints in" the racing-helmet livery through a torn-edge reveal mask**. → *Topo-line ambient texture; serif/sans type-stack; status-widget; cursor reveal-on-hover with torn-edge mask.* **Adopt (translated)**: topo-lines → faint warm contour texture; type-stack validates Fraunces+Inter mixing; reveal-on-hover is another decision-2=B hook candidate (lamplight cursor already does the warm-reveal version).
- **Scroll register flip.** Background flips near-white → **deep warm-olive** on scroll. → *Scroll-driven background temperature shift.* **Adopt** — already Layer-4 (time-of-day + section deepening toward espresso); confirms the technique reads as premium.
- **Animated signature scrawl.** A lime **hand-drawn signature draws across** editorial portrait tiles. → *Animated hand-drawn ink stroke.* **Adopt (translated)**: a bronze ink-stroke / the Vesper-V drawn on, matching Layer-4's "ink-drop forms the V" pull-to-refresh language.
- **Type-mixing.** Oversized headlines mix **serif + condensed sans + color accent** in one line ("REDEFINING LIMITS, FIGHTING FOR WINS", "ALWAYS BRINGING THE FIGHT"). → *Dramatic serif/sans/accent type-mixing.* **Adopt (restrained)**: Fraunces display + Inter + a single bronze-accented word; never more than one accent word per headline.
- **Editorial montage.** Scattered, **date-stamped** B&W+color photo cards (Monaco '23, Barcelona '24…) with topo-line connectors + parallax + serif pull-quotes + animated signature. → *Asymmetric date-stamped editorial montage with parallax.* **Translate-down**: strong layout idea, **but anonymity forbids real photos** — Vesper uses AI-atmospheric imagery + butler aphorisms in this slot, not faces.
- **Staged collection grid.** **3D-rendered helmet collection** (Porcelain, Japan, Dark Mode, Chrome…) in **notched-corner cards with name + year labels**. → *Grid of staged 3D objects in labeled cards.* **Adopt (translated)**: this is the modules section's craft target — each module as a staged 3D artifact in a notched/vellum card with a mono label.
- **Footer.** Big serif/sans "ALWAYS BRINGING THE FIGHT" + animated signature + **sponsor-logo marquee** + footer nav + ©2026; lime-accent border framing. → marquee/lime **reject**; the calm footer structure is fine.
- *Re-capture:* `https://landonorris.com` — synthetic scroll works; hover the hero head for the helmet paint-in; full page to the sponsor-marquee footer.

> **Note on site-derived specifics.** The values above (load times, viewport counts, headline strings, collection names, social labels) were captured live and are **not independently re-verifiable from the workspace** — the website stills are not stored here. Re-grab via the pointers above before relying on any exact figure.

## A2. Reels (9) — creator @ayzz.thedesigner; "redesign a brand" format unless noted

Mood/staging reference sheets for the visual reels (2, 6, 7, 8, 9) are archived in `REEL_REFERENCE_SHEETS.zip`; reels 1/3/4/5 are transcript-covered and re-makeable from the mp4s.

| # | What it is | Keeper / extractable | Verdict |
|---|---|---|---|
| 1 | Agency process explainer | Stack reality: ~90% Webflow + **GSAP** (scroll) + **Lenis** (smooth) + Barba (transitions); ~90% of "3D look" is **faked 2D/WebP/video + parallax**, real 3D only when earned. | **Adopt as method** — validates decision 1 (GSAP+Lenis) and "fake depth cheaply; reserve real Three.js for the hero." |
| 2 | Editorial fashion e-comm ("THE WEBSITE") | Smooth product-image **crossfade**, big photography, minimal chrome, serif headlines. | **Translate-down** (bright). Crossfade in `considered` band is fine; minimal-chrome editorial confirmed. |
| 3 | Closet-app "mom-test" onboarding | Understanding → positioning → quick-start → insights summary. Business/UX, not motion. | **Mostly out of scope.** If any onboarding "insights" surface uses counts, keep them **literal, not scored** (scorekeeping-absence). |
| 4 | Luxury chauffeur redesign | **Subtle gradient headline** (not screaming), direct booking in hero, trust signals, **tease next section** with subtle gradient + motion. | **Adopt (translated)** — restrained gradient headline + section-tease both fit; red → bronze. |
| 5 | Wellness redesign | **Environmental staging** (product in a world), **z-axis composition** (massive type behind product for depth), dark high-contrast CTA + directional arrow; (also real-faces social proof → **resolved to decision 4, no faces**). | **Adopt** environmental staging + z-axis type-behind-object depth; **reject** real-face proof. |
| 6 | Café / coffee brand ("LOUNGE") | Brief: "Fresh Beans, **Warm & Rich**, Immersive & Playful, should feel Alive, storytelling." Single warm-lit cup staged with glow, amber/red/espresso, big serif, "Our Fresh Menu" grid. | **Register match → adopt staging/mood.** Single product environmentally staged + warm glow + serif; saturated red → **oxblood + bronze**. |
| 7 | Skincare "+ Galaxy" | Single product staged on rich **magenta-galaxy gradient + glow**, massive editorial type ("RADICAL TRANSPARENCY / HIDE NOTHING"); **largely static** — wow is staging + gradient-depth + type, not interactivity. (Reference also carries a real-face "real results" social-proof strip → same reject as reel 5.) | **Translate-down** (cosmic→warm). Key evidence for decision-2=B: stunning *static* staging can beat interactivity. |
| 8 | Candle brand "VELOUR" | Brief literally: **"warm, atmospheric, editorial, moody lighting, rich textures, slow."** Single candle staged in **AI-generated warm-dark environments** (dark rooms, dusk-amber mountains, ember tones), massive serif wordmark; one product photo → a whole atmospheric world. | **Closest register match — near adopt-as-is** on staging/mood/AI-atmospheric-imagery. Brief ≈ Vesper's mood words. Saturated red → oxblood + bronze. |
| 9 | Color-theory lesson | **60-30-10 rule**: 60% neutrals, 30% secondary, 10% accent; same app green vs premium burgundy. | **Adopt as principle** — quantifies Vesper's restraint: espresso/surface neutrals ~60%, cream/warm-secondary ~30%, **single bronze accent ~10%**. Burgundy-as-premium reinforces oxblood. |

## A3. PDF — *getting-clients-playbook* (marketing guide)
Out of scope (client-acquisition). Only relevant idea: real-people social proof → **resolved to decision 4 (quote testimonials, no photos)**.

## A4. Notion — *UI/UX Motion Roadmap* (self-training guide, by the same creator)
Content is a learn-animation curriculum, not a wow-reference. Useful extracts only:
- **Philosophy (corroborates the locks).** "Motion with purpose, not animating everything"; clarity/storytelling over gratuitous effects; **limit concurrency** (only a few elements move at once); "use it with restraint." Near-paraphrase of Vesper's butler-quiet motion discipline.
- **Concrete reveal recipe (Step 5 — adopt as starting values).** Headline: **y +16–24px, opacity 0→100%**. Subhead: **+8–12px, 0→100%, slight delay**. CTA: **outline→filled, scale 0.98→1**. Image: **scale 0.96→1, blur 8px→0** (= decision-3 blur-up). All sit in the `quick`/`considered` bands.
- **Section rhythm (Step 6).** Pick **one** reveal pattern (Lead → Support → Action) and **one** default easing; reuse across all sections; keep movement modest.
- **Tools mentioned.** Rive (state-machine micro-interactions), AE→Lottie (JSON, embeddable — already Vesper's loader format), Spline (light 3D), Unicorn Studio (scroll/WebGL). Each needs the **CSP eval-free check** before use. Build-time note, not a decision.

> **Note.** Notion-derived specifics are **not independently re-verifiable from the workspace** (the roadmap is not stored here).

---

# PART B — Synthesized Direction

The single distilled instruction set for the Vesper landing. Organized by section, then cross-cutting systems. Everything below already obeys §0 locks.

## B1. Per-section direction

**Section 1 — Hero (interactive sample-day demo) + manor backdrop.**
- The **interactive sample-day demo stays the primary, first surface** (NEW-1=A). Do not lead with a single staged object; the demo is the conversion mechanic.
- Behind/below it, the **3D manor study** carries the igloo/reel-8 craft: *single environment, atmospheric depth, warm fog, low-poly, time-of-day lighting.* Camera enters the room on scroll ("Good evening. Let's see to your day.").
- **Hero asset:** one **blur-up** high-res still of the manor at rest (decision 3) — `blur 8px→0, scale 0.96→1` on load (Notion recipe), `considered` band.
- **Decision-2=B cursor beat:** exactly **one** restrained reactive moment, built on the **existing lamplight cursor + block-depth-on-hover** — e.g. the **desk-lamp / ember glow follows the cursor** (warm radial, +8%/−3%, 60fps-capped), or a single staged plan-block lifts 2–4px toward the cursor. **Not** a particle field, **not** physics. (The igloo-disassembly / penguin-reform / lusion-repel / landonorris-paint-in are the *inspiration*; the Vesper-weight implementation is the lamplight + block-lift already specced.)
- **Typography breath** on the hero Fraunces copy (100%↔100.5%, 4s) — already locked; confirm it's on here and nowhere body-level.
- **Reduced-motion fallback:** static cream→espresso gradient + wordmark.

**Section 2 — What Vesper does.**
- Camera pans to the desk; the plan view animates on the on-desk screen. Butler copy in **Fraunces Display 3** scrolls alongside.
- Apply reel-5 **z-axis composition**: large Fraunces copy sits *behind/around* the plan screen for depth (type-behind-object), translated to warm-dark.

**Section 3 — Modules (the craft showcase).**
- This is where igloo object-staging + landonorris's **staged-collection-grid** land hardest (NEW-1=A explicitly routes the craft here). Each of the seven modules (six staged as named artifacts — kettlebell, plate, clock, key, bottle, envelope; the work module is unstaged in Layer-4) is a **staged 3D artifact** in the room — or, on translate-down to a grid, a **notched-corner / vellum card with a JetBrains-Mono label + name**.
- Reveal pattern (Notion Step 6): **Media → Headline → Details**, one pattern reused; **limit concurrency** — only one or two artifacts animate in at a time as the camera lingers.

**Section 4 — How it works (Dynamic Island).**
- Phone by the lamp lights with the Dynamic Island animation (Live Activity glow, ember pulse, 2s cycle — already Layer 4).
- Optional ornament: the igloo **slow counter-rotating glyph** as the lamp's halo or a quiet divider — *slow* band, bronze seams, low intensity. Drop if it adds noise.

**Section 5 — Pricing + signup.**
- Pull back to full room. Copy resolves: "One week free. After that, $19.99 per month. iOS launching shortly. Web works everywhere in the meantime."
- **Testimonials (decision 4=C):** quote cards — **first name + role, no photos** — warm-dark `bg-surface` cards, Fraunces quote in cream, mono role label. Satisfies reel-5's social-proof instinct without faces.
- One form only: email + iOS/Android segmented control + "Begin" (bronze button, click-ripple).

## B2. Cross-cutting systems

**Scroll choreography (decision 1).** GSAP ScrollTrigger + Lenis, **landing only**; pin + scrub the camera through the five sections (~5–6 vh). **CSP-verify at build** (grep bundle for `eval`/`new Function`; if GSAP/Lenis trip it, fall back to IntersectionObserver + CSS token-class transitions). Per reel 1, **fake depth cheaply** (parallax/WebP/video) and reserve real R3F for the hero scene only — protects the <4MB budget.

**Section transitions.** Camera **dolly-in + fog-wash dissolve** between scenes (igloo, de-glitched). **Reject** datamosh/RGB-split. Page-turn (~400ms) remains for in-app nav, not landing scroll.

**The bronze thread (NEW-3).** A thin bronze line — a ribbon-bookmark trailing through the study — weaves section to section as a connective spine (lusion ribbon, warm-dark). `slow`/`cinematic` band, low opacity, follows the scroll path. **Subtle and removable.**

**Type treatment.** Fraunces display + Inter + one bronze-accent word max per headline (landonorris type-mixing, restrained). Mono for labels/times/version strings only (~5–8%). Reel-5 z-axis type-behind-object for depth in sections 2–3.

**Texture / overlay layer.** Faint warm **contour/topo lines** (landonorris) + thin **mono measurement-line** marks (igloo) as ambient decorative texture, at the limit of perceptibility (sits beside Layer-4's vellum noise / carved-wood). **Hard rule:** any number in this layer is **abstract/decorative** — never a live counter tied to progress (scorekeeping-absence).

**Reveal motion values (Notion recipe, in-band).** Headline y+16–24 / 0→100% · subhead +8–12 / delayed · CTA outline→filled scale 0.98→1 · image scale 0.96→1 blur 8→0. Durations from `quick` (small reveals) and `considered` (section reveals); default easing `standardOut`; **one** easing reused page-wide. Limit concurrency.

**Loading / arrival (NEW-2=A).** **No branded preloader.** Progressive/lazy load — paint hero ASAP, defer below-fold and the R3F scene. In-experience loaders stay Layer-4 candle/ember Lottie. (Optional ~600ms bronze-V breath flash exists for ceremony — **off by default**, enable only on operator request.)

**Anonymity & imagery.** All non-product atmosphere = **AI-generated warm-dark imagery** (reel 8 method: one asset → a whole atmospheric world). **No** founder face, **no** real-face testimonials, **no** production photoshoots. The landonorris editorial-montage *layout* is allowed; its *faces* are not.

**Color application (reel 9).** Hold ~**60% neutrals** (espresso/surface), ~**30% secondary** (cream/warm-secondary text + muted tones), ~**10% bronze accent**. Bronze earns its scarcity; oxblood is rarer still.

---

# PART C — Reference Re-capture Pointers

The website stills are ephemeral (saved to a browser Downloads folder, not the workspace). Any design chat that needs them re-grabs deterministically with Claude-in-Chrome (desktop 1440×900 unless noted). Open each in a **fresh tab** (heavy WebGL exhausts the context after several 3D pages). **igloo hijacks scroll — scroll it manually** while frames are captured.

1. **igloo hero** — `igloo.inc`, load ~16s, at rest.
2. **igloo disassembly** — hover the igloo center; capture mid-scatter (measurement-lines + numbers visible).
3. **igloo rings** — scroll to the rings; burst 4 frames over ~4s for the counter-rotation.
4. **igloo penguin** — scroll to the penguin; drag cursor across to scatter, then idle to reform; capture both.
5. **igloo transition** — the dolly-in → fog-wash (skip/avoid the glitch frame).
6. **lusion hero + repel** — `lusion.co`; drag through the jacks.
7. **lusion ribbon + big-type** — "Bold Ideas" reveal with the ribbon threading.
8. **lusion work grid** — autoplay tiles + scramble-in titles.
9. **landonorris hero paint-in** — `landonorris.com`; hover the head for the helmet livery reveal.
10. **landonorris type-mix + montage** — "REDEFINING LIMITS…"; the date-stamped editorial scatter (layout only).
11. **landonorris helmet grid** — notched-corner labeled collection cards.
12. **reel 8 (VELOUR) + reel 6 (LOUNGE)** — warm-dark product-staging frames (register matches); reel sheets in `REEL_REFERENCE_SHEETS.zip`, or re-extract from the mp4s via ffmpeg contact sheet.

---

*End of bank. Direction is captured; the build chat owns implementation. Where this bank and an authority doc conflict, the authority doc wins.*
