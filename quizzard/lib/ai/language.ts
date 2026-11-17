/**
 * Language directive shared by every AI prompt.
 *
 * Quizzard is a Vietnamese-language product: the UI is in Vietnamese, so the
 * questions the model generates, the lecture titles it proposes and the chat
 * replies it sends must be in Vietnamese too. The prompts themselves stay in
 * English (models follow English instructions more reliably), but every
 * user-visible field the model produces is explicitly required to be
 * Vietnamese.
 */
export const VIETNAMESE_OUTPUT_RULE = `## Language Requirement (CRITICAL)
The app interface is in Vietnamese. ALL user-visible text you produce MUST be written in Vietnamese (Tiếng Việt). This includes:
- Question prompts, answer options, correct answers and explanations
- Lecture titles and lecture descriptions
- Chat messages addressed to the teacher
- Feedback for students
- Any reason, suggestion or message field in the JSON output

Rules:
- Write natural, idiomatic Vietnamese suitable for Vietnamese students.
- Keep technical terms, formulas, variable names, code identifiers and unit symbols in their original form (for example: "SELECT", "CPU", "SQL", "photosynthesis" -> "quang hợp").
- Do NOT add English explanations or translations alongside the Vietnamese text.
- Never transliterate proper nouns that already have a well-known Vietnamese form; otherwise keep them as-is.`;
