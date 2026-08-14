import { GoogleGenAI, Type } from '@google/genai';
import { withTimeout } from './serverSecurity.ts';
import {
  DiagnoseSchema,
  SmartTriageSchema,
  DiagnosticPathSchema,
  AcademyVideoSchema,
  SupportChatSchema
} from './schemas.ts';
import { z } from 'zod';

// AI Gateway configuration
const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || 'https://ai-gateway.vercel.sh/v1';
const GEMINI_MODEL = 'gemini-1.5-flash';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'dcp-spokane-lab-server',
      // If using Vercel AI Gateway with Gemini directly via headers
      ...(process.env.AI_GATEWAY_TOKEN ? { 'Authorization': `Bearer ${process.env.AI_GATEWAY_TOKEN}` } : {})
    }
  }
});

/**
 * Utility to strip markdown code blocks and parse JSON safely
 */
function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    const cleanJson = text.replace(/```json\n?|```\n?/g, '').trim();
    return JSON.parse(cleanJson) as T;
  } catch (e) {
    console.error('AI JSON Parse Error:', e, 'Raw Text:', text);
    return fallback;
  }
}

/**
 * Technical Diagnosis Assistant
 */
export async function diagnoseIssue(data: z.infer<typeof DiagnoseSchema>) {
  if (!process.env.GEMINI_API_KEY) return null;

  const { telemetry, customerReportedIssue, deviceModel } = data;

  const prompt = `
    You are the D&CP LLC Senior Technical Diagnostic Assistant.
    Analyze the following telemetry data and technician notes for a ${deviceModel || 'Device'} according to D&CP Engineering Specification Rev 4.0.

    INPUT DATA:
    - Technician/Customer Notes: "${customerReportedIssue || 'No specific notes'}"
    - Battery Health: ${telemetry?.batteryHealthPercentage ?? 90}%
    - Battery Temperature: ${telemetry?.batteryTempCelsius ?? 22}°C
    - Ammeter DC Current Draw: ${telemetry?.ammeterDrawAmps ?? 0}A
    - Logical Short to Ground (Primary Rails): ${telemetry?.isShortToGround ? 'POSITIVE' : 'NEGATIVE'}

    DIAGNOSTIC MANDATES:
    1. CLASSIFY SERVICE TIER: TIER 1 (Power/Port), TIER 2 (Display), TIER 3 (Board Rework).
    2. TECHNICAL ANALYSIS: Evaluate VDD_MAIN and VDD_BOOST if short detected.
    3. SAFETY PROTOCOL: Thermal lockout if > 45°C.
    4. CUSTOMER SUMMARY: Professional summary mentioning WA RCW 19.415 compliance.

    Response must be structured, technical, and use markdown.
  `;

  const aiPromise = ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
  });

  const response = await withTimeout(aiPromise, 4000, null);
  return response?.text || null;
}

/**
 * Smart Triage Symptom Analyzer
 */
export async function smartTriage(data: z.infer<typeof SmartTriageSchema>) {
  if (!process.env.GEMINI_API_KEY) return null;

  const { deviceModel, symptomDescription } = data;

  const prompt = `
    You are the Lead Hardware Triage Specialist at D&CP Spokane Lab.
    Analyze the user's reported symptoms for "${deviceModel || 'Unspecified Device'}": "${symptomDescription}".

    Return ONLY a valid JSON object:
    {
      "suspectedFault": string,
      "recommendedTier": "TIER_1_POWER_PORT_REFRESH" | "TIER_2_DISPLAY_RENEWAL" | "TIER_3_MICRO_SOLDERING",
      "recommendedTierLabel": string,
      "confidenceScore": number,
      "summary": string,
      "diyInitialSteps": string[],
      "technicianChecklistAdvice": string[]
    }
  `;

  const aiPromise = ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  });

  const response = await withTimeout(aiPromise, 4000, null);
  return response?.text ? safeJsonParse(response.text, null) : null;
}

/**
 * Recommended Diagnostic Path Generator
 */
export async function generateDiagnosticPath(data: z.infer<typeof DiagnosticPathSchema>) {
  if (!process.env.GEMINI_API_KEY) return null;

  const { repairNotes, deviceManufacturer, deviceModel, symptoms, telemetry } = data;

  const prompt = `
    You are the Lead Master Bench Technician at D&CP Spokane Repair Lab.
    Generate a precise, step-by-step Recommended Diagnostic Path for:
    - Device: ${deviceManufacturer} ${deviceModel}
    - Symptoms: ${symptoms.join(', ') || 'None'}
    - Telemetry: ${JSON.stringify(telemetry || {})}
    - Notes: "${repairNotes}"
  `;

  const aiPromise = ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          primaryDiagnosis: { type: Type.STRING },
          confidenceScore: { type: Type.NUMBER },
          complexityLevel: { type: Type.STRING },
          estimatedBenchTimeMinutes: { type: Type.NUMBER },
          technicianBriefing: { type: Type.STRING },
          diagnosticSteps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                stepNumber: { type: Type.NUMBER },
                actionTitle: { type: Type.STRING },
                instructions: { type: Type.STRING },
                expectedReading: { type: Type.STRING },
                toolRequired: { type: Type.STRING },
              },
              required: ['stepNumber', 'actionTitle', 'instructions', 'expectedReading', 'toolRequired'],
            },
          },
          requiredTools: { type: Type.ARRAY, items: { type: Type.STRING } },
          riskPrecautions: { type: Type.ARRAY, items: { type: Type.STRING } },
          partsLikelyNeeded: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'primaryDiagnosis', 'confidenceScore', 'complexityLevel',
          'estimatedBenchTimeMinutes', 'technicianBriefing', 'diagnosticSteps',
          'requiredTools', 'riskPrecautions', 'partsLikelyNeeded'
        ],
      },
    },
  });

  const response = await withTimeout(aiPromise, 4500, null);
  return response?.text ? safeJsonParse(response.text, null) : null;
}

/**
 * Support Chat Assistant (David Chen Persona)
 */
export async function generateSupportReply(data: z.infer<typeof SupportChatSchema>) {
  if (!process.env.GEMINI_API_KEY) return null;

  const { message, conversationHistory, ticketId } = data;
  const historyText = conversationHistory.map(h => `${h.sender === 'user' ? 'Customer' : 'David Chen'}: ${h.text}`).join('\n');

  const systemPrompt = `
    You are David Chen, Lead Systems Engineer at D&CP LLC (Spokane Lab, WA).
    Respond concisely (2-4 sentences max), professionally, and directly in character.
    D&CP details: 115 S Adams St, Spokane, WA. LIFETIME warranty. RCW 19.415 compliant.
    ${ticketId ? `- Active Ticket: ${ticketId}` : ''}
  `;

  const aiPromise = ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: `Recent History:\n${historyText}\n\nCustomer: "${message}"\n\nDavid Chen:`,
    config: { systemInstruction: systemPrompt }
  });

  const response = await withTimeout(aiPromise, 4000, null);
  return response?.text || null;
}

/**
 * Academy Video Script Generator
 */
export async function generateAcademyVideo(topic: string) {
  if (!process.env.GEMINI_API_KEY) return null;

  const prompt = `
    You are the Master Educational Director at D&CP Spokane Repair Academy.
    Generate a video tutorial for: "${topic}".
    Return ONLY a valid JSON object with title, category, difficulty, estimatedTime, description, requiredTools, safetyWarnings, and 4-5 scenes.
  `;

  const aiPromise = ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  });

  const response = await withTimeout(aiPromise, 4000, null);
  return response?.text ? safeJsonParse(response.text, null) : null;
}
