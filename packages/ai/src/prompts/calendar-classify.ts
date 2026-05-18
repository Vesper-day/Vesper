export const CALENDAR_CLASSIFY_PROMPT = `\
Classify the given Google Calendar event title into exactly one block_type_enum value.

Valid values: work, fitness, nutrition, sleep, errands, medication, finance, focus, commute, custom

Respond with a JSON object: { "block_type": "<value>" }
`;

export const CALENDAR_CLASSIFY_VERSION = 'v1-20260601';
