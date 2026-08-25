// DesignTokens.swift — Vesper Layer 4 design tokens for the native Swift surfaces.
//
// Authored by the design track (Chat 107) as committed SOURCE TEXT ONLY. No view
// code lives here — only token VALUES. It is the Swift mirror of
// packages/ui/src/tokens.ts (the single source of truth); the values are
// transcribed verbatim from docs/LAYER_4_EXPERIENCE_IDENTITY.md and MUST be kept
// in sync by hand with tokens.ts (Swift cannot import the TS package).
//
// Consumed by the build track (Opus-native) for:
//   • the iOS alarm screen (059b) — VesperAlarmExtension
//   • the three Live Activity widget variants (077 / 078) — VesperLiveActivity
//
// Wiring: add this file to BOTH the VesperAlarmExtension and VesperLiveActivity
// target memberships in the Xcode project (done in a Mac session — see
// docs/RUNBOOKS/IOS_ALARM_REBUILD.md and IOS_WIDGET_REBUILD.md). It has no
// dependencies beyond SwiftUI.
//
// NOTE: the existing AlarmContentView.swift currently inlines an off-spec cream
// (#F5EFE6). When the build track adopts these tokens, VesperColor.cream (#E8DDC9,
// the Layer 4 text-primary value) is authoritative.

import SwiftUI

// MARK: - Palette (Layer 4 semantic colors)

/// Layer 4 palette. Keys match the @vesper/ui material vocabulary; the doc comment
/// names the semantic role each fills.
public enum VesperColor {
    /// Hex helper (0xRRGGBB), mirroring the existing Color(red:green:blue:) usage.
    private static func hex(_ value: UInt32) -> Color {
        Color(
            red: Double((value >> 16) & 0xFF) / 255.0,
            green: Double((value >> 8) & 0xFF) / 255.0,
            blue: Double(value & 0xFF) / 255.0
        )
    }

    // Backgrounds
    public static let espresso = hex(0x1E1815) // bg-primary — page/screen background
    public static let surface = hex(0x2B221C) // bg-surface — cards, blocks
    public static let elevated = hex(0x38291E) // bg-elevated — hover/active, sheets
    // Text
    public static let cream = hex(0xE8DDC9) // text-primary — body text
    public static let creamMuted = hex(0xA89B85) // text-secondary — labels, descriptions
    public static let creamFaint = hex(0x756B57) // text-tertiary — footnote, ambient butler line
    // Accents
    public static let bronze = hex(0xB8884A) // accent-bronze — primary accent / completion
    public static let oxblood = hex(0x5C2A2A) // accent-oxblood — destructive / error
    // Borders
    public static let lineSubtle = hex(0x3D332A) // border-subtle — outlines, dividers
    public static let lineStrong = hex(0x5C4F40) // border-strong — focus, prominent containers
    // State
    public static let success = hex(0x6B7A5A) // state-success — muted forest green
    public static let warning = hex(0xB8884A) // state-warning — bronze
    public static let error = hex(0x5C2A2A) // state-error — oxblood
}

// MARK: - Typography (Layer 4 type roles)

/// Type families and the Layer 4 roles. Sizes are point values; ranges are the
/// fluid [min, max] band — pick within the band per surface. `optical` is the
/// Fraunces opsz axis (display roles only).
public enum VesperFont {
    public static let displayFamily = "Fraunces" // headlines, hero, butler line, wordmark
    public static let bodyFamily = "Inter" // body, UI labels, form fields
    public static let monoFamily = "JetBrains Mono" // times, timestamps, version strings

    public struct Role {
        public let family: String
        public let sizeMin: CGFloat
        public let sizeMax: CGFloat
        public let weight: Font.Weight
        public let optical: CGFloat? // Fraunces opsz; nil for body/mono
        public let tracking: CGFloat // letter-spacing in points at the role's size
        public let lineHeight: CGFloat // multiple of the font size
        public let italic: Bool
    }

    public static let display1 = Role(family: displayFamily, sizeMin: 48, sizeMax: 64, weight: .medium, optical: 24, tracking: -0.02, lineHeight: 1.2, italic: false)
    public static let display2 = Role(family: displayFamily, sizeMin: 32, sizeMax: 40, weight: .medium, optical: 18, tracking: -0.015, lineHeight: 1.2, italic: false)
    public static let display3 = Role(family: displayFamily, sizeMin: 24, sizeMax: 28, weight: .medium, optical: 14, tracking: -0.01, lineHeight: 1.2, italic: false)
    public static let butlerLine = Role(family: displayFamily, sizeMin: 14, sizeMax: 16, weight: .regular, optical: 9, tracking: 0, lineHeight: 1.4, italic: true)
    public static let bodyLarge = Role(family: bodyFamily, sizeMin: 16, sizeMax: 18, weight: .regular, optical: nil, tracking: 0, lineHeight: 1.5, italic: false)
    public static let body = Role(family: bodyFamily, sizeMin: 14, sizeMax: 15, weight: .regular, optical: nil, tracking: 0, lineHeight: 1.5, italic: false)
    public static let bodySmall = Role(family: bodyFamily, sizeMin: 12, sizeMax: 13, weight: .regular, optical: nil, tracking: 0.005, lineHeight: 1.5, italic: false)
    public static let uiLabel = Role(family: bodyFamily, sizeMin: 12, sizeMax: 12, weight: .medium, optical: nil, tracking: 0.02, lineHeight: 1.5, italic: false)
    public static let uiLabelSmall = Role(family: bodyFamily, sizeMin: 10, sizeMax: 10, weight: .medium, optical: nil, tracking: 0.04, lineHeight: 1.5, italic: false)
    public static let mono = Role(family: monoFamily, sizeMin: 14, sizeMax: 14, weight: .regular, optical: nil, tracking: 0, lineHeight: 1.5, italic: false)
    public static let monoSmall = Role(family: monoFamily, sizeMin: 12, sizeMax: 12, weight: .regular, optical: nil, tracking: 0, lineHeight: 1.5, italic: false)
}

// MARK: - Spacing (4px base unit)

public enum VesperSpacing {
    public static let s0: CGFloat = 0
    public static let s1: CGFloat = 4
    public static let s2: CGFloat = 8
    public static let s3: CGFloat = 12
    public static let s4: CGFloat = 16
    public static let s5: CGFloat = 20
    public static let s6: CGFloat = 24
    public static let s8: CGFloat = 32
    public static let s10: CGFloat = 40
    public static let s12: CGFloat = 48
    public static let s16: CGFloat = 64
    public static let s20: CGFloat = 80
    public static let s24: CGFloat = 96
    public static let s32: CGFloat = 128
}

// MARK: - Border radii

public enum VesperRadius {
    public static let none: CGFloat = 0 // full-bleed sections, hero panels
    public static let sm: CGFloat = 4 // chips, badges, small tags
    public static let md: CGFloat = 8 // buttons, input fields, secondary cards
    public static let lg: CGFloat = 12 // plan blocks, primary cards
    public static let xl: CGFloat = 16 // modal sheets, large containers
    public static let xl2: CGFloat = 24 // sheet headers, prominent containers
    public static let full: CGFloat = 9999 // avatars, pill buttons, FAB
}

// MARK: - Elevation (rich-posture warm shadows)

/// Warm box-shadow set mirroring tokens.ts `boxShadow` (Design-Track Re-Overhaul /
/// ADD-D). SwiftUI applies these as `.shadow(color:radius:x:y:)`; the tuple carries
/// (color, opacity, radius, y-offset). Tinted with the near-black espresso base
/// (#14100D) so depth reads warm. `glow` is the bronze focus halo.
public enum VesperElevation {
    public struct Shadow {
        public let color: Color
        public let radius: CGFloat
        public let y: CGFloat
    }
    private static func espressoShadow(_ opacity: Double) -> Color {
        Color(red: 20.0 / 255.0, green: 16.0 / 255.0, blue: 13.0 / 255.0).opacity(opacity)
    }
    public static let raised = Shadow(color: espressoShadow(0.35), radius: 4, y: 2) // rest — cards, buttons
    public static let floating = Shadow(color: espressoShadow(0.55), radius: 20, y: 8) // lifted — menus, sheets
    public static let glow = Shadow(color: VesperColor.bronze.opacity(0.35), radius: 9, y: 0) // bronze focus halo
}

// MARK: - Motion (durations, easing, spring)

/// Duration bands as [min, max] seconds, plus a representative midpoint per band.
/// `instant` (0) is the reduced-motion fallback (UIAccessibility.isReduceMotionEnabled),
/// not a separate band.
public enum VesperMotion {
    public static let instant: Double = 0

    public static let quick: Double = 0.2 // band 0.15…0.25 — taps, presses, toggles
    public static let considered: Double = 0.4 // band 0.30…0.50 — transitions, sheet slide-up, reveals
    public static let slow: Double = 0.75 // band 0.60…0.90 — ambient (butler rotation, time-of-day)
    public static let cinematic: Double = 1.5 // band 1.00…2.00 — hero reveals, onboarding, splash

    public static let quickBand: ClosedRange<Double> = 0.15...0.25
    public static let consideredBand: ClosedRange<Double> = 0.30...0.50
    public static let slowBand: ClosedRange<Double> = 0.60...0.90
    public static let cinematicBand: ClosedRange<Double> = 1.00...2.00

    // Easing curves (cubic-bezier control points) — match tokens.ts.
    public static let standardOut: (Double, Double, Double, Double) = (0.2, 0.8, 0.2, 1.0) // entry
    public static let standardIn: (Double, Double, Double, Double) = (0.4, 0.0, 1.0, 1.0) // exit
    public static let cinematicCurve: (Double, Double, Double, Double) = (0.4, 0.0, 0.1, 1.0) // storytelling (KEPT)
    // NEW rich-posture curves (Design-Track Re-Overhaul / ADD-D) — mirror tokens.ts motion.easing.
    public static let emphasizedCurve: (Double, Double, Double, Double) = (0.2, 0.0, 0.0, 1.0) // decelerate-heavy reveal
    public static let overshootCurve: (Double, Double, Double, Double) = (0.34, 1.56, 0.64, 1.0) // gentle spring overshoot

    // Interactive spring (mirror of the RN Reanimated spring).
    public static let springDamping: Double = 18
    public static let springStiffness: Double = 150
}
