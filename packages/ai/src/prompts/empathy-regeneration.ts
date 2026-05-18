export const EMPATHY_REGENERATION_PROMPT = `\
The user has rejected three successive plan regenerations. Acknowledge this briefly \
in butler tone, ask one short clarifying question about what is not working, \
then produce a revised plan that meaningfully differs from the prior attempts.

Apply all standard voice rules. Output the revised plan as a DailyPlan JSON object \
with an additional "acknowledgement" string field (under 20 words).
`;

export const EMPATHY_REGENERATION_VERSION = 'v1-20260601';
