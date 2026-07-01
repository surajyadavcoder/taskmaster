const AppError = require('../utils/AppError');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

// Takes a short, rough task title/idea from the user and asks Claude
// to turn it into a clear, well-structured task description.
async function generateTaskDescription(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new AppError(
      'AI description generation is not configured. Set ANTHROPIC_API_KEY in your .env file.',
      503
    );
  }

  const systemPrompt =
    'You write short, practical task descriptions for a team task tracker. ' +
    'Given a rough title or idea, return a 2-4 sentence description covering what needs to be done ' +
    'and any obvious acceptance criteria. Do not add a title, headers, or markdown formatting. ' +
    'Reply with plain text only.';

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new AppError(`AI service request failed: ${errBody}`, 502);
  }

  const data = await response.json();
  const textBlock = (data.content || []).find((block) => block.type === 'text');

  if (!textBlock) {
    throw new AppError('AI service returned an unexpected response.', 502);
  }

  return textBlock.text.trim();
}

module.exports = { generateTaskDescription };
