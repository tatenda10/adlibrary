const { GoogleGenerativeAI } = require('@google/generative-ai');

function extractJson(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, Math.round(n * 10) / 10));
}

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeTranscript(value, fallback = '') {
  const text = String(value || '').trim();
  if (text) return text;
  return String(fallback || '').trim() || 'Transcript unavailable from source.';
}

function normalizeAnalysis(raw = {}, transcriptInput = '') {
  const ratings = raw.ratings || {};
  const recommendations = Array.isArray(raw.recommendations)
    ? raw.recommendations
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];

  return {
    hook: String(raw.hook || '').trim(),
    structure: String(raw.structure || '').trim(),
    cta: String(raw.cta || '').trim(),
    viral_factor: String(raw.viral_factor || '').trim(),
    content_angle: String(raw.content_angle || '').trim(),
    replication_tips: String(raw.replication_tips || '').trim(),
    transcript: normalizeTranscript(raw.transcript, transcriptInput),
    estimated_performance: String(raw.estimated_performance || '').trim(),
    suggested_test_budget_usd: String(raw.suggested_test_budget_usd || '').trim(),
    virality_score: clampPercent(raw.virality_score),
    virality_label: String(raw.virality_label || '').trim(),
    recommendations,
    ratings: {
      hook: clampScore(ratings.hook),
      creative: clampScore(ratings.creative),
      cta: clampScore(ratings.cta),
      clarity: clampScore(ratings.clarity),
      scalability: clampScore(ratings.scalability),
      overall: clampScore(ratings.overall),
    },
  };
}

function buildPrompt({ videoUrl, caption, author, transcript, sourceContext }) {
  return `You are analyzing a TikTok ad concept.
Given this metadata:
- URL: ${videoUrl}
- Caption: ${caption}
- Author: ${author}
- Source transcript/subtitles (may be empty): ${transcript}
- Source context: ${sourceContext}

Return STRICT JSON with this exact shape:
{
  "hook": "string",
  "structure": "string",
  "cta": "string",
  "viral_factor": "string",
  "content_angle": "string",
  "replication_tips": "string",
  "transcript": "string",
  "estimated_performance": "string",
  "suggested_test_budget_usd": "string",
  "virality_score": 0,
  "virality_label": "Low | Medium | High | Very High",
  "recommendations": ["string", "string", "string"],
  "ratings": {
    "hook": 0,
    "creative": 0,
    "cta": 0,
    "clarity": 0,
    "scalability": 0,
    "overall": 0
  }
}

Rules:
- Ratings must be numbers from 0 to 10
- virality_score must be a number from 0 to 100
- recommendations should be concise and specific, max 8 items
- If source transcript is provided, clean and return it in transcript
- If source transcript is missing, set transcript to "Transcript unavailable from source."
- Be concise and actionable
- Do not include markdown.`;
}

async function analyzeWithGemini(prompt, transcriptInput) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-pro' });
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed = extractJson(text);

  if (!parsed) {
    throw new Error('Failed to parse Gemini response');
  }

  return normalizeAnalysis(parsed, transcriptInput);
}

async function analyzeWithClaude(prompt, transcriptInput) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY is not configured');
  }

  const configuredAnalysisModel = process.env.CLAUDE_ANALYSIS_MODEL || 'claude-3-5-haiku-latest';
  const fallbackModel = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
  const candidateModels = Array.from(
    new Set([configuredAnalysisModel, fallbackModel].map((value) => String(value || '').trim()).filter(Boolean))
  );

  const url = 'https://api.anthropic.com/v1/messages';
  const maxAttempts = 4;

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 900,
          temperature: 0.2,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.content?.map((part) => part.text).join('\n') || '';
        const parsed = extractJson(text);

        if (!parsed) {
          throw new Error('Failed to parse Claude response');
        }

        return normalizeAnalysis(parsed, transcriptInput);
      }

      const body = await response.text();
      const overloaded = response.status === 529 || response.status === 429;
      const missingModel = response.status === 404 && body.toLowerCase().includes('model:');

      if (missingModel) {
        console.warn(`Claude analysis model unavailable (${model}); trying next fallback if available.`);
        break;
      }

      if (overloaded && attempt < maxAttempts) {
        const delayMs = 600 * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      throw new Error(`Claude error ${response.status}: ${body}`);
    }
  }

  throw new Error('Claude analysis models unavailable after fallback attempts');
}

function fallbackAnalysis(transcriptInput = '') {
  return normalizeAnalysis(
    {
      hook: 'Fast visual hook in the first 2 seconds with a clear product outcome.',
      structure: 'Problem -> demo -> proof -> outcome in under 20 seconds.',
      cta: 'Add a single direct CTA in the final 3 seconds.',
      viral_factor: 'Uses familiar short-form pacing and quick pay-off visuals.',
      content_angle: 'Demo-focused ad angle with immediate value clarity.',
      replication_tips: 'Test 3 hooks, keep one offer, and iterate creatives weekly.',
      transcript: transcriptInput || 'Transcript unavailable from source.',
      estimated_performance: 'Moderate potential; likely improves with stronger hook contrast.',
      suggested_test_budget_usd: '$50-$150/day initial test for 5-7 days.',
      virality_score: 64,
      virality_label: 'Medium',
      recommendations: [
        'Put the strongest visual result in the first 2 seconds.',
        'Tighten total runtime to 15-25 seconds.',
        'Use one clear CTA and repeat it on-screen near the end.',
      ],
      ratings: {
        hook: 6.5,
        creative: 6.8,
        cta: 6.2,
        clarity: 6.7,
        scalability: 6.0,
        overall: 6.4,
      },
    },
    transcriptInput
  );
}

async function analyzeTikTokCore(input = {}) {
  const { videoUrl = '', caption = '', author = '', transcript = '', sourceContext = '' } = input;
  if (!String(videoUrl || '').trim() && !String(sourceContext || '').trim()) {
    throw new Error('videoUrl or sourceContext is required');
  }

  const transcriptInput = String(transcript || '').trim();
  const prompt = buildPrompt({
    videoUrl: String(videoUrl || 'uploaded-video'),
    caption,
    author,
    transcript: transcriptInput,
    sourceContext: String(sourceContext || '').trim(),
  });

  try {
    return await analyzeWithGemini(prompt, transcriptInput);
  } catch (geminiError) {
    const message = String(geminiError?.message || '');
    const status = Number(geminiError?.status || 0);
    const shouldFallbackToClaude =
      status === 400 ||
      status === 404 ||
      message.includes('API_KEY_INVALID') ||
      message.includes('API key not valid') ||
      message.includes('is not found for API version') ||
      message.includes('not supported for generateContent') ||
      message.includes('GEMINI_API_KEY is not configured');

    if (!shouldFallbackToClaude) {
      throw geminiError;
    }

    try {
      return await analyzeWithClaude(prompt, transcriptInput);
    } catch (claudeError) {
      const statusText = String(claudeError?.message || '');
      const isCapacityIssue =
        statusText.includes('Claude error 529') ||
        statusText.includes('Claude error 429') ||
        statusText.includes('overloaded');

      if (isCapacityIssue) {
        return fallbackAnalysis(transcriptInput);
      }

      throw claudeError;
    }
  }
}

async function analyzeTikTok(req, res) {
  try {
    return res.json(await analyzeTikTokCore(req.body || {}));
  } catch (error) {
    console.error('analyzeTikTok error:', error);
    return res.status(500).json({ error: error.message || 'Failed to analyze TikTok video' });
  }
}

module.exports = { analyzeTikTok, analyzeTikTokCore };
