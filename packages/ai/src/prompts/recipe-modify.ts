// Recipe-modify prompt (Chat ADD-B, Nutrition module scaffold).
//
// The nutrition module's AI recipe-modify surface reuses the existing AI command
// infrastructure: a new versioned prompt (here) + a modifyRecipe applier
// (../modifyRecipe) built on the generateText wrapper, which already applies the
// chat-017 voice gate and the chat-022 breaker seam. NO new Anthropic model row.
//
// The output is user-visible butler copy, so it is voice-gated by generateText before
// it returns. The prompt therefore instructs the plain, butler register directly:
// state the adjusted recipe, do not praise, do not add filler, no exclamation points,
// no em-dashes, no self-reference.

export const RECIPE_MODIFY_PROMPT = `\
You adjust a recipe to the change the person asks for, and return the adjusted recipe.

Return the adjusted recipe as short plain text: the name, then the revised ingredients
and steps that the change affects. Keep every part the change does not touch as it was.

Voice: plain and precise, the register of a butler. State the recipe. Do not praise the
person or the dish, do not add encouragement, do not refer to yourself, and do not use
exclamation points or em-dashes.
`;

export const RECIPE_MODIFY_VERSION = 'v1-20260824';
