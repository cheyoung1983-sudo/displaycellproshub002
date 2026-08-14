import type { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { generateFallbackDiagnosticPath } from '../src/lib/diagnosticFallback.ts';

export default async function handler(req: Request, res: Response) {
  // CORS & Security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const {
    repairNotes = '',
    deviceManufacturer = 'Unknown',
    deviceModel = 'Device',
    symptoms = [],
    telemetry
  } = req.body || {};

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'dcp-vercel-serverless' } }
        });

        const prompt = `
You are the Lead Master Bench Technician at D&CP Spokane Repair Lab (IPC-A-610 Certified).
Analyze the technician's intake notes, selected symptoms, hardware telemetry, and device details to generate a precise, step-by-step Recommended Diagnostic Path.

DEVICE INFORMATION:
- Manufacturer: ${deviceManufacturer || 'Unknown'}
- Model: ${deviceModel || 'Unspecified Model'}

TECHNICIAN & INTAKE NOTES:
"${repairNotes || 'No notes provided'}"

REPORTED SYMPTOMS:
${Array.isArray(symptoms) && symptoms.length > 0 ? symptoms.join(', ') : 'None listed'}

HARDWARE TELEMETRY:
${telemetry ? `
- Ammeter Current Draw: ${telemetry.ammeterDrawAmps} A
- Short to Ground: ${telemetry.isShortToGround ? 'YES (SHORT DETECTED)' : 'NO'}
- Battery Health: ${telemetry.batteryHealthPercentage}%
- Battery Temp: ${telemetry.batteryTempCelsius}°C
` : 'No live telemetry attached'}

Produce a structured JSON plan with step-by-step bench actions, expected readings, required tools, parts needed, and safety precautions.
`;

        const aiPromise = ai.models.generateContent({
          model: 'gemini-2.5-flash',
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
                'primaryDiagnosis',
                'confidenceScore',
                'complexityLevel',
                'estimatedBenchTimeMinutes',
                'technicianBriefing',
                'diagnosticSteps',
                'requiredTools',
                'riskPrecautions',
                'partsLikelyNeeded',
              ],
            },
          },
        });

        // 4.5s timeout for serverless function execution guarantee
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4500));
        const result = await Promise.race([aiPromise, timeoutPromise]);

        if (result && 'text' in result && result.text) {
          const parsed = JSON.parse(result.text);
          return res.status(200).json({ success: true, path: parsed });
        }
      } catch (geminiErr) {
        console.warn('Gemini API call warning, falling back to Spokane Lab heuristic engine:', geminiErr);
      }
    }

    // Fallback to certified D&CP rule engine
    const fallbackPath = generateFallbackDiagnosticPath({
      repairNotes,
      deviceManufacturer,
      deviceModel,
      symptoms,
      telemetry
    });

    return res.status(200).json({
      success: true,
      path: fallbackPath
    });
  } catch (error: any) {
    console.error('Serverless Diagnostic Path Exception:', error);
    const fallbackPath = generateFallbackDiagnosticPath({
      repairNotes,
      deviceManufacturer,
      deviceModel,
      symptoms,
      telemetry
    });
    return res.status(200).json({
      success: true,
      path: fallbackPath
    });
  }
}
