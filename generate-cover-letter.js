// Netlify Function: POST /api/generate-cover-letter
// (mapped from /.netlify/functions/generate-cover-letter via netlify.toml)
//
// This is the ONLY place the Gemini API key is read or used. It never
// reaches the browser bundle, satisfying the "no exposed API key" rule.
//
// Expects JSON body: { name, role, company, skills }
// Returns JSON:      { letter: "..." }  or  { error: "..." }

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/' +
  GEMINI_MODEL + ':generateContent';

const MAX_FIELD_LENGTH = 500;

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed. Use POST.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Missing env var — fail loudly in logs, vaguely to the client.
    console.error('GEMINI_API_KEY is not set in the function environment.');
    return jsonResponse(500, { error: 'Server is not configured to generate letters right now.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return jsonResponse(400, { error: 'Malformed request body.' });
  }

  const name = sanitizeField(body.name);
  const role = sanitizeField(body.role);
  const company = sanitizeField(body.company);
  const skills = sanitizeField(body.skills);

  if (!name || !role || !company || !skills) {
    return jsonResponse(400, { error: 'name, role, company, and skills are all required.' });
  }

  const prompt =
    'Write a professional, warm, and specific cover letter for a job application.\n\n' +
    'Candidate name: ' + name + '\n' +
    'Job role: ' + role + '\n' +
    'Target company: ' + company + '\n' +
    'Key skills: ' + skills + '\n\n' +
    'Rules:\n' +
    '- 3 to 5 short paragraphs.\n' +
    '- Open with "Dear Hiring Manager at ' + company + ',".\n' +
    '- Close with "Sincerely," on its own line followed by the candidate name.\n' +
    '- Separate each paragraph with a blank line.\n' +
    '- Do not use markdown headers, bullet points, or bold text.\n' +
    '- Do not invent specific past employers, dates, or achievements not implied by the skills given.';

  try {
    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 700 },
      }),
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const message = (data && data.error && data.error.message) || 'Gemini API request failed.';
      console.error('Gemini API error:', message);
      return jsonResponse(502, { error: 'The AI service could not generate a letter. Please try again.' });
    }

    const letter =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;

    if (!letter) {
      return jsonResponse(502, { error: 'The AI service returned an empty response. Please try again.' });
    }

    return jsonResponse(200, { letter: letter.trim() });
  } catch (err) {
    console.error('Unexpected error calling Gemini:', err);
    return jsonResponse(500, { error: 'Unexpected server error. Please try again.' });
  }
};

function sanitizeField(value) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, MAX_FIELD_LENGTH);
}

function jsonResponse(statusCode, payload) {
  return {
    statusCode: statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
}
