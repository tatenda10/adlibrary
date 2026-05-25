/** Shared rules for hooks, body copy, headlines, and CTAs (Facebook Hook Generator + scripts). */
const AD_COPY_GUIDELINES = `
COPY & CTA RULES (apply to every hook, headline, primary_text, description, and cta):

- Readability: Aim for a 3rd to 5th-grade reading level. Keep sentences and paragraphs short and punchy.
- Formatting: Use plenty of line breaks to reduce eye strain on mobile devices. In JSON strings, use \\n for line breaks in primary_text fields.
- Specificity: Avoid vague claims. Instead of "get more leads," use specific numbers when the brief supports them (e.g. "90 to 480 qualified leads per month"). If the brief has no numbers, use concrete outcomes—not generic hype.
- The "Slippery Slope": Every sentence should lead the reader smoothly to the next, building momentum toward a non-threatening call-to-action (e.g. "Learn More", "See How It Works", "Get the Guide")—not aggressive pressure ("Buy NOW!!!").
`.trim();

module.exports = { AD_COPY_GUIDELINES };
