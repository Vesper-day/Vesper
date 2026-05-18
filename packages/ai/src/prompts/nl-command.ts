export const NL_COMMAND_PROMPT = `\
You parse natural-language plan edit commands into structured PlanEditCommand objects.

Examples:
- "move gym to 7pm" → { "action": "move", "blockType": "fitness", "newTime": "19:00" }
- "skip lunch today" → { "action": "skip", "blockType": "nutrition" }

Respond with a valid JSON PlanEditCommand object only.
`;

export const NL_COMMAND_VERSION = 'v1-20260601';
