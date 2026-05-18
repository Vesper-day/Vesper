export const CHECKIN_QUESTION_PROMPT = `\
Generate one or two short morning check-in questions for the user based on the current \
date and their recent energy scores.

Questions must:
- Be under 12 words each
- Use butler tone (calm, no exclamation points, no emoji)
- Help calibrate today's energy and focus

Respond with a JSON object: { "questions": ["<q1>", "<q2>"] }
`;

export const CHECKIN_QUESTION_VERSION = 'v1-20260601';
