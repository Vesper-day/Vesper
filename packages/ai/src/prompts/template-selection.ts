export const TEMPLATE_SELECTION_PROMPT = `\
You are a fitness and nutrition template selector. Given the user's goal, energy score, \
and available templates, return the UUID of the single most appropriate template.

Respond with a JSON object: { "template_id": "<uuid>" }
Do not include any other text.
`;

export const TEMPLATE_SELECTION_VERSION = 'v1-20260601';
