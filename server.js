require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MAX_SKILLS_LEN = 500;
const MAX_TEXT_LEN = 120;

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- helpers -------------------------------------------------------------

function clean(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function buildPrompt({ name, role, company, skills }) {
  return [
    'Write a professional, tailored cover letter using exactly this information:',
    `- Candidate name: ${name}`,
    `- Target role: ${role}`,
    `- Target company: ${company}`,
    `- Key skills to highlight: ${skills}`,
    '',
    'Requirements:',
    '- 3 to 4 short paragraphs.',
    '- Warm, confident, professional tone. No generic filler.',
    '- Address it to the hiring manager at the target company by name of company, not a placeholder.',
    '- Do NOT use bracket placeholders like [Your Name] anywhere — use the real values given above.',
    '- Return only the letter body as plain paragraphs separated by blank lines. No markdown headers, no bullet points, no extra commentary before or after the letter.',
  ].join('\n');
}

// --- routes ----------------------------------------------------------------

app.post('/api/generate-cover-letter', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'Server is missing GEMINI_API_KEY. Add it to a .env file (see .env.example) and restart the server.',
      });
    }

    const name = clean(req.body?.name, MAX_TEXT_LEN);
    const role = clean(req.body?.role, MAX_TEXT_LEN);
    const company = clean(req.body?.company, MAX_TEXT_LEN);
    const skills = clean(req.body?.skills, MAX_SKILLS_LEN);

    if (!name || !role || !company || !skills) {
      return res.status(400).json({
        error: 'Please provide candidate name, job role, target company, and key skills.',
      });
    }

    const prompt = buildPrompt({ name, role, company, skills });

    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{
            text: 'You are an expert career coach who writes concise, compelling, professional cover letters tailored to the exact role and company given.',
          }],
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 700 },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => '');
      console.error('Gemini API error:', geminiRes.status, errText);
      const message = geminiRes.status === 429
        ? 'Gemini API rate limit reached. Wait a minute and try again.'
        : `Gemini API request failed (status ${geminiRes.status}). Check your API key and try again.`;
      return res.status(502).json({ error: message });
    }

    const data = await geminiRes.json();
    const letter = (data?.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || '')
      .join('')
      .trim();

    if (!letter) {
      return res.status(502).json({ error: 'Gemini returned an empty response. Please try again.' });
    }

    res.json({ letter });
  } catch (err) {
    console.error('Unexpected error generating cover letter:', err);
    res.status(500).json({ error: 'Something went wrong while generating the cover letter.' });
  }
});

// Simple health check — useful for confirming the key loaded without printing it
app.get('/api/health', (req, res) => {
  res.json({ ok: true, geminiKeyConfigured: Boolean(GEMINI_API_KEY) });
});

app.listen(PORT, () => {
  console.log(`AI Cover Letter Generator running at http://localhost:${PORT}`);
  console.log(`Gemini API key configured: ${Boolean(GEMINI_API_KEY)}`);
});
