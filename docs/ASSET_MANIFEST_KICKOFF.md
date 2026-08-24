> **⛔ DEPRECATED — SUPERSEDED by the clean-posture design-track overhaul.** This kickoff drives an **AI-image generation pipeline** (operator-generated warm-dark manor stills / atmospheric imagery for the immersive `-V` surfaces). The clean-posture overhaul ships **no AI-generated imagery**, so this asset-manifest pipeline is **retired.** Do not run it or produce an `ASSET_MANIFEST.md` from it. Content preserved for reference only. Current authority: `docs/DESIGN_STRATEGY.md` (clean-posture banner) and `docs/PHASE_4_BUILD_PLAN.md` → Addendum → "Design-Track Overhaul."

Starting an OFF-RECORD asset chat — the Vesper Visual Asset Manifest + Operator Generation Playbook.
This is NOT a numbered Phase-4 build-plan chat, NOT a Claude Code prompt, and produces NO code. Do not
assign or confirm a chat number or a model. The build plan does not schedule this work; it is an
operator-owned pass that fills the imagery gap the -V design chats leave as placeholders. Acknowledge
that honestly and proceed.

WHAT YOU PRODUCE THIS CHAT (two deliverables, both written as documents — full prose / tables, this is
the deliverable-document exception to terse mode):
  1. ASSET_MANIFEST.md — a living, surface-by-surface enumeration of every visual ASSET SLOT across the
     Vesper design surfaces that a model/tool must produce (because Claude Code cannot generate raster
     art, 3D model files, textures, or Lottie). One row per asset.
  2. An OPERATOR GENERATION PLAYBOOK (a section inside the same doc, or a second doc ASSET_PLAYBOOK.md) —
     exactly what I, the operator, do to generate each asset externally and hand it back, end to end.

BEHAVIORAL RULES — apply the project's standing chat rules to your reasoning and chat replies (these are
verification only; reference Template.txt + the 093-V kickoff in project knowledge for the house
conventions, do NOT copy their CC-prompt house format — this chat emits a doc, not a == CAPS == CC
prompt):
  - Source-tag every factual claim: [doc:filename] for project-file facts, [calc], [training] ⚠️,
    [assumed] ⚠️.
  - OBJECTION-FIRST before any substantive conclusion (top 2 reasons it could be wrong, then the
    conclusion).
  - "I don't know is valid" — where a surface's spec does not exist yet (most -V chats are unbuilt), say
    so and mark the slot provisional rather than inventing assets.
  - No-confirmation: if I state a number/fact, rederive independently and compare.
  - Terse mode for chat replies; FULL PROSE inside the two deliverable documents.
  - Never restate project context back at me; lead with the answer.
  - No model field anywhere.

AUTHORITY ORDER (unchanged from the design track — the manifest INVENTS nothing):
  1. LAYER_4_EXPERIENCE_IDENTITY.md + the locked @vesper/ui tokens (palette/type/motion) — absolute. The
     manifest specifies assets that EXPRESS this system; it never proposes a new palette, type, accent,
     or brand.
  2. VISUAL_DIRECTION_BANK_v2.md — the verified motion + staging + register direction (warm-dark,
     AI-atmospheric, anonymity-absolute, 60/30/10 color discipline, reel-8 "one asset → a whole
     atmospheric world" method, reel-7 "static staging + gradient-depth + type can out-wow interactivity").
  3. The -V surface specs / resolution records that already exist (093-V landing is the only fully-locked
     surface today; others exist at build-plan-row granularity until their -V chat lands).
  Where any source implies a brighter palette, a face, a real person, a score/number-as-progress, or a
  composition that diverges from the locked surfaces, the locked docs win — flag in one line, spec to
  the locked version.

THE CODE-vs-ASSET BOUNDARY (the manifest lists ONLY the right column — read it carefully):
  CLAUDE CODE BUILDS (procedural — do NOT put these in the manifest): CSS/SVG gradients, the cream→
  espresso fallback gradient, Three.js / R3F scene GEOMETRY + lighting + standard materials, GSAP/Lenis
  scroll choreography, parallax, blur-up wiring, typography breath, lamplight cursor, fog-wash
  transitions, the Dynamic-Island CSS animation, the bronze thread, vellum data-URI noise. These are the
  "stale-looking" worry's actual answer: they are real craft, authored in code, already in the -V prompts.
  OPERATOR SUPPLIES, CC WIRES (raster / 3D / motion-export — THESE go in the manifest): the AI-generated
  warm-dark manor-study still(s) and any atmospheric environment imagery; product/object "artifact" stills
  if any are raster rather than R3F geometry; photoreal or painterly textures / matcaps / HDRI environment
  maps the R3F scene samples; any 3D model file (.glb/.gltf) if a module artifact is a real model rather
  than primitive geometry; Lottie JSON motion assets (the candle/ember loaders — an After-Effects/tool
  export, not CC-authored); OG/social share images; favicon/app-icon raster masters where not already
  produced. If you are unsure whether a given visual is procedural or asset, state the test you applied and
  put it in the column you judged, flagged.

LOCKED ART DIRECTION (transcribe into the manifest's header so every asset obeys it):
  - Register: warm-dark, editorial, moody, slow, "a place you enter, not a tool you open." Igloo-craft
    staging translated to warm-dark; reel-8 VELOUR / reel-6 LOUNGE are the closest register matches.
  - Palette (Layer 4 exact hex — assets must live inside this range, no foreign hues) [doc:
    VISUAL_DIRECTION_BANK_v2.md §0]: espresso #1E1815, surface #2B221C, elevated #38291E, cream #E8DDC9,
    text-secondary #A89B85, text-tertiary #756B57, bronze #B8884A (single accent, scarce), oxblood
    #5C2A2A (rarer still / destructive only), border-subtle #3D332A, border-strong #5C4F40, success
    #6B7A5A. Hold ~60% espresso/surface neutrals, ~30% cream/warm-secondary, ~10% bronze.
  - Anonymity is absolute: NO founder face, NO real person, NO real-face testimonials, NO production
    photography. Atmosphere only; faceless. AI-generated warm-dark imagery is the intended method.
  - Scorekeeping-as-absence extends into art: NO number rendered as progress/score/streak/level in any
    asset; decorative/abstract marks only.
  - Hero budget: total landing page weight < 4MB; the ONE exception is a single progressive blur-up
    high-res hero still (bank decision 3). Everything else is compressed. Each asset row must carry a
    target byte budget and a format that respects this.
  - CSP: assets are same-origin static files under the app (img-src 'self' data: blob:); no external
    image CDN origin is added [doc:CSP_NOTES.md].

ENUMERATE THE SLOTS — read these and list every operator-supplied asset each surface needs:
  - 093-V landing (LOCKED — enumerate fully now): read LAYER_4 §"Landing Page", VISUAL_DIRECTION_BANK_v2
    Part B, and the 093-V resolution record if present. Expected asset slots: the atmospheric manor-study
    still (the blur-up hero), any environment/background imagery behind sections 2–5, the seven module
    "artifact" visuals IF any ship as raster/3D rather than R3F primitives, the footer gradient is
    procedural (exclude), the OG/social share image for the page. State each with the placeholder it
    replaces.
  - The other -V design surfaces (FORWARD-DECLARE at build-plan-row + Layer 4 + bank granularity; mark
    provisional, to be refined when each -V lands) [doc:PHASE_4_BUILD_PLAN.md master table]: 032-V
    onboarding welcome, 033-V archetype tiles, 034-V calendar-connect/walkthrough/location, 035-V module
    toggles, 036-V first-plan cinematic loading + reveal, 041-V block-type detail layouts, 044-V ambient
    butler line, 046-V vesper-hour/week/morning-brief, 108a notebook card, 089-V subscription lifecycle
    states, 095-V referral landing. For each, note the LIKELY atmospheric/illustrative/Lottie asset need
    from its row + the Layer 4 mentions (e.g. the candle/ember loaders for the first-plan cinematic), and
    mark it provisional with the trigger that finalizes it (its -V chat).
  - Cross-surface shared assets: the app-icon / favicon raster masters (Layer 4 §Logo: bronze #B8884A
    field, cream #E8DDC9 V monogram, 1024×1024 master) if not already produced; any shared HDRI/texture
    the R3F scenes reuse. List once, mark shared.

MANIFEST ROW SCHEMA (one row per asset; put in a table):
  asset_id (stable slug) · surface (093-V / shared / …) · slot description · type (raster-environment /
  raster-object / texture / hdri / model-glb / lottie / og-image / icon) · replaces (the exact placeholder
  the -V build wired) · target dimensions · format (prefer AVIF/WebP for raster, draco-compressed glb for
  models, JSON for lottie) · byte budget · art-direction prompt SEED (a concrete, palette-locked,
  faceless generation prompt the operator can paste into an image/3D tool — written in the locked
  register) · faceless/anonymity check (Y) · scorekeeping-free check (Y) · wiring target (the repo path /
  import the later CC session drops it into, e.g. apps/web/public/marketing/…) · status (ready-to-generate
  / provisional / blocked-on-unbuilt-surface).

OPERATOR GENERATION PLAYBOOK — write this so a non-expert can run it. It must answer, concretely, "what
do I actually do to get these assets," covering:
  - TOOL OPTIONS BY ASSET TYPE (verify current tools via web search before recommending — the tool
    landscape shifts; do not rely on stale memory) [training ⚠️]. Cover at least: raster atmosphere /
    environment + object stills (e.g. Midjourney, Flux, Adobe Firefly, Ideogram for text-in-image,
    Freepik, Higgsfield); 3D models/scenes if needed (Spline, Luma/Genie, Blender); textures/HDRI
    (Poly Haven, ambientCG, or generated); Lottie motion (LottieFiles, or After Effects → Bodymovin
    export). NOTE explicitly: Lovable is an AI app/code builder, NOT an image-asset generator — do not
    send it asset work; flag any tool the operator names that is mismatched to the asset type.
  - THE PER-ASSET RECIPE: for each manifest row, the operator takes the art-direction prompt SEED, runs
    it in the chosen tool, and iterates to the locked register. Give the exact prompt-shaping rules
    (warm-dark, espresso/cream/bronze palette words, "no faces, no people, no text", lighting words —
    "single warm lamplight, deep shadow, fog, low-key," reference the reel-8 mood) and the negative
    prompts (no bright/cool palette, no logos, no readable text unless intended, no faces, no numbers).
  - FORMAT + COMPRESSION TARGETS to hit the <4MB budget and the blur-up: source resolution, export
    format (AVIF/WebP), the tiny LQIP/blur placeholder the blur-up needs, and the exact compression step
    (name a tool the operator runs, e.g. Squoosh / sharp). State target byte sizes per asset class.
  - NAMING + FOLDER CONVENTION and HAND-BACK: how to name files to match the manifest asset_id, where to
    drop them (a folder the operator uploads to project knowledge or commits), so the wiring CC session
    can map asset → slot deterministically.
  - THE THIRD STEP (do not perform it here): name that after assets exist, a later Claude Code session
    (its own kickoff) wires them in — replacing placeholders per the manifest's wiring-target column,
    setting up blur-up + compression + lazy-load — and that CC does the WIRING, not the art.

DETERMINE FROM THE LIVE REPO / SPECS (read, do not assume):
  - The exact placeholder mechanism the 093-V build used (what gradient/scrim component or path stands in
    for the manor still) so the manifest's "replaces" + "wiring target" columns are real, not guessed.
    If 093-V has not landed yet, mark those rows provisional and state the trigger.
  - Whether the favicon/app-icon raster masters already exist in the repo (search apps/* and assets) so
    the manifest does not re-request produced assets.
  - Which module "artifacts" the 093-V scene renders as R3F primitives (procedural → exclude) vs as
    raster/model assets (→ manifest). State the split you found.

OBJECTION-FIRST (do this before delivering the manifest) + SELF-CHECK: state the top 2 ways the manifest
could be wrong (e.g. listing a procedural visual as an asset and sending the operator to generate
something CC should build; or fully enumerating slots for an unbuilt surface and locking assets before
its -V spec exists), verify against the files, and correct. Then confirm: every asset is faceless,
palette-locked, scorekeeping-free, budget-bounded, and has a real wiring target or an explicit provisional
flag.

GIVE ME: (1) ASSET_MANIFEST.md (the table + the locked art-direction header); (2) the OPERATOR GENERATION
PLAYBOOK (tool options, per-asset recipe, prompt seeds, compression targets, naming/hand-back); (3) what
to add to project knowledge after (the manifest doc itself, so every later -V chat and the wiring CC
session read from it). Do NOT generate any asset yourself and do NOT write any code. End with a one-line
honest status: this pass is operator-owned and unscheduled in the build plan, the landing slots are
ready-to-generate, the rest are provisional until their -V chats land.
