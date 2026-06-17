# Chat 077 — Live Activity Widget Extension: Resolution Record

**Scope:** SwiftUI / WidgetKit / ActivityKit target setup + shared data model + codegen for the iOS Live Activity. Views and design tokens are chat 078 (out of scope). Mobile `import` of the generated TS types is chat 079 (out of scope).

**Environment:** authored on Windows (no macOS / Xcode). All native target add/build/test deferred to a Mac session.

---

## Windows-committed vs Mac-deferred

| Windows-committed (this chat) | Mac-deferred (later session) |
|---|---|
| `schema.json` SSOT + `genLiveActivityTypes.ts` codegen | `expo prebuild` to regenerate `ios/` |
| Generated `ActivityModels.swift` + `types.ts` | Add `VesperLiveActivity` Widget Extension target in Xcode |
| `VesperLiveActivityBundle.swift` (placeholder widget) | Set bundle id / deploy target / app-group / keychain on the target |
| `Info.plist` + `VesperLiveActivity.entitlements` | Build to device |
| `app.config.js` Info.plist keys | On-device Live Activity test (physical iPhone 14 Pro+) |
| `IOS_WIDGET_REBUILD.md` runbook | — |

---

## Final schema field list (TECHNICAL_SPEC §7 — authoritative)

**`VesperBlockAttributes`** (static attribute, wire name MUST be `VesperBlockAttributes`):
- `blockId: String`

**`ContentState`** (maps to the APNs `content-state` object) — all 8 fields, in this canonical order:

| Field | Swift | TS | Notes |
|---|---|---|---|
| `blockId` | `String` | `string` | |
| `blockType` | `String` | `string` | module slug e.g. `"fitness"`; plain string, NOT coupled to `BlockTypeSchema` |
| `title` | `String` | `string` | |
| `abbreviation` | `String` | `string` | 2-char, e.g. `"GY"` |
| `endTime` | `String` | `string` | ISO8601; parsed on-device for the countdown |
| `minutesRemaining` | `Int` | `number` | device recomputes from `endTime` |
| `nextBlockTitle` | `String?` | `string \| null` | nullable |
| `nextBlockStart` | `String?` | `string \| null` | nullable, ISO8601 |

---

## Generated shapes

**Swift** (`apps/mobile/ios/VesperLiveActivity/ActivityModels.swift`):
```swift
struct VesperBlockAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable { /* 8 fields above */ }
    var blockId: String
}
```

**TS** (`packages/shared/src/liveActivity/types.ts`):
```ts
export interface VesperBlockAttributes { blockId: string; }
export interface VesperLiveActivityContentState { /* 8 fields above */ }
```

Both carry a `GENERATED — DO NOT EDIT` header. Field/key order = JSON property insertion order in `schema.json`. Re-running the codegen produces NO diff (verified locally).

---

## Codegen command + output paths

```bash
pnpm gen:live-activity-types
```
- SSOT in:  `packages/shared/src/liveActivity/schema.json`
- emits:    `apps/mobile/ios/VesperLiveActivity/ActivityModels.swift`
- emits:    `packages/shared/src/liveActivity/types.ts`

Drift check: `pnpm gen:live-activity-types && git diff --exit-code`.

---

## app.config.js edits

Added to `ios.infoPlist` (verbatim, per §7):
- `NSSupportsLiveActivities: true`
- `NSSupportsLiveActivitiesFrequentUpdates: true`

`ios.deploymentTarget` was **already `'17.2'`** — left untouched (correction 2). Main-app app-group + keychain + time-sensitive entitlements were already present in `app.config.js`; only the EXTENSION's `.entitlements` was authored this chat.

---

## Runbook

`docs/RUNBOOKS/IOS_WIDGET_REBUILD.md` — committed-source inventory + Mac-deferred procedure to re-attach the `VesperLiveActivity` target after `expo prebuild`, mirroring `IOS_ALARM_REBUILD.md`.

---

## §7-vs-build-plan discrepancy

Per task instruction, where the build-plan one-line summary disagreed with TECHNICAL_SPEC §7, **§7 wins**. The field list and wire format above are transcribed directly from §7 (the APNs `content-state` payloads and the `VesperBlockAttributes` attributes-type), not from the build-plan summary.

---

## Open question for chat 079 (mobile types resolution)

`types.ts` is intentionally NOT re-exported from `packages/shared/src/index.ts` and is not imported by `apps/mobile` yet. When 079 wires it in, it must resolve the known gap: `apps/mobile` uses `moduleResolution: 'node'` while `@vesper/shared` exposes only an `exports` map (no `main`/typesVersions deep paths), so a type-only re-export of `@vesper/shared/liveActivity` will not resolve under mobile `tsc`. Likely fix: a local type slice in mobile, or a shared deep-export entry — to be decided in 079. (Same class of issue recorded for prior mobile↔shared resolution work.)

---

## tsx resolution outcome (correction 1)

Dry-run `pnpm tsx --version` from the repo root **FAILED** (`Command "tsx" not found`) — `tsx` was a devDependency of `@vesper/db` and `@vesper/ai` only, not the root. Per correction 1, added `"tsx": "^4.19.0"` to **root** `devDependencies` and the `gen:live-activity-types` script. **`pnpm install` is therefore required** before the script runs from root. (The generated files in this PR were produced by running the codegen through a package that already had `tsx`, so they are correct and in sync regardless.)

---

## Device-build deferral (Cutover gates)

On-device build + Live Activity test are gated on **C-04 (Apple Developer enrollment active)** → **C-05 (App ID + App Group)**, **C-06 (provisioning profile)**, **C-07 (APNs key)**. Batch the native integration with the deferred 059b alarm-extension work in a single Mac session. See `IOS_WIDGET_REBUILD.md` → "Required-before-device-build".
