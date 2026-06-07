// Prompt-versioning pattern (TECHNICAL_SPEC.md §5).
//
// Each prompt is shipped as two sibling string constants: the prompt body and a
// version string in the COMPACT format v{N}-{YYYYMMDD}, e.g. 'v1-20260601'.
// (This compact form supersedes the build plan's v{N}-{YYYY}-{MM}-{DD}.)
//
// The 8 existing prompt files under src/prompts already follow this convention.
// This module only provides the types; it does not modify those files.

/** A prompt version string in the compact form v{N}-{YYYYMMDD}, e.g. 'v1-20260601'. */
export type PromptVersion = `v${number}-${string}`;

/** A versioned prompt: the prompt body paired with its version string. */
export type VersionedPrompt = {
  prompt: string;
  version: PromptVersion;
};
