import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import pdfParse from 'pdf-parse';

const apiKey = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL_NAME || 'gemini-2.5-flash';

const MAX_RESUME_CHARS = 8000; // keeps prompt size (and cost) in check
const MAX_RESUME_FILE_BYTES = 5 * 1024 * 1024; // 5MB upload cap

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const name = formData.get('name');
    const role = formData.get('role');
    const company = formData.get('company');
    const skills = formData.get('skills');
    const resumeFile = formData.get('resume') as File | null;

    // Required fields must actually be present, non-empty strings
    if (
      typeof name !== 'string' || !name.trim() ||
      typeof role !== 'string' || !role.trim() ||
      typeof company !== 'string' || !company.trim()
    ) {
      return NextResponse.json(
        { error: 'Missing required fields: name, role, and company are required.' },
        { status: 400 }
      );
    }

    const skillsText = typeof skills === 'string' ? skills.trim() : '';

    if (!apiKey) {
      // Phase 1 MVP fallback when no API key is configured
      return NextResponse.json({ simulated: true });
    }

    let resumeText = '';

    // Phase 3: PDF Parsing
    if (resumeFile) {
      if (resumeFile.type && resumeFile.type !== 'application/pdf') {
        return NextResponse.json(
          { error: 'Resume must be a PDF file.' },
          { status: 400 }
        );
      }

      if (resumeFile.size > MAX_RESUME_FILE_BYTES) {
        return NextResponse.json(
          { error: 'Resume file is too large (max 5MB).' },
          { status: 400 }
        );
      }

      try {
        const arrayBuffer = await resumeFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const pdfData = await pdfParse(buffer);
        resumeText = pdfData.text.slice(0, MAX_RESUME_CHARS);
      } catch (e) {
        console.error('Error parsing PDF:', e);
        // Non-fatal: fall back to generating without resume context
      }
    }

    // Phase 2: LLM Integration
    const ai = new GoogleGenAI({ apiKey });

    let prompt = `You are an expert career coach and professional copywriter.
Write a highly compelling, professional, and personalized cover letter.
Candidate Name: ${name}
Target Role: ${role}
Target Company: ${company}
Key Skills to Highlight: ${skillsText}
`;

    if (resumeText) {
      prompt += `\nHere is the candidate's resume for additional context to heavily personalize the cover letter:\n${resumeText}\n`;
    }

    prompt += `\nOutput only the cover letter content in clean markdown format with paragraphs. Do not include a subject line or any conversational wrapper.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    if (!response.text) {
      throw new Error('Empty response from model');
    }

    return NextResponse.json({ coverLetter: response.text });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate cover letter. Please try again.' },
      { status: 500 }
    );
  }
}
