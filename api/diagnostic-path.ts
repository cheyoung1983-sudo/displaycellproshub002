import type { Request, Response } from 'express';
import { generateDiagnosticPath } from '../src/lib/aiService.ts';
import { generateFallbackDiagnosticPath } from '../src/lib/diagnosticFallback.ts';
import { DiagnosticPathSchema } from '../src/lib/schemas.ts';

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

  const parseResult = DiagnosticPathSchema.safeParse(req.body);
  const data = parseResult.success ? parseResult.data : {
    repairNotes: '',
    deviceManufacturer: 'Unknown',
    deviceModel: 'Device',
    symptoms: [],
    telemetry: undefined
  };

  try {
    const path = await generateDiagnosticPath(data);

    if (path) {
      return res.status(200).json({ success: true, path });
    }

    // Fallback to certified D&CP rule engine
    const fallbackPath = generateFallbackDiagnosticPath(data);
    return res.status(200).json({ success: true, path: fallbackPath });
  } catch (error: any) {
    console.error('Serverless Diagnostic Path Exception:', error);
    const fallbackPath = generateFallbackDiagnosticPath(data);
    return res.status(200).json({ success: true, path: fallbackPath });
  }
}
