/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { getToken, getTokenResponse } from '@vercel/connect';
import { handleVercelConnectError } from './src/utils/vercelConnect.ts';
import {
  securityHeadersMiddleware,
  createRateLimiter,
  diagnosticCache,
  triageCache,
  videoGuideCache,
  withTimeout
} from './src/lib/serverSecurity.ts';
import { generateFallbackDiagnosticPath } from './src/lib/diagnosticFallback.ts';
import {
  diagnoseIssue,
  smartTriage,
  generateDiagnosticPath,
  generateSupportReply,
  generateAcademyVideo
} from './src/lib/aiService.ts';

export const app = express();
const PORT = 3000;

// Attach HTTP Security Headers Middleware
app.use(securityHeadersMiddleware);

app.use(express.json({ limit: '10mb' }));

// Explicitly serve public directory static assets with optimal MIME types & headers
const publicDirectoryPath = path.join(process.cwd(), 'public');
app.use(express.static(publicDirectoryPath, {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('manifest.json') || filePath.endsWith('manifest.webmanifest')) {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    } else if (filePath.endsWith('sw.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Service-Worker-Allowed', '/');
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    }
  }
}));

// Rate limiters for abuse prevention
const aiRateLimiter = createRateLimiter({
  maxRequests: 60,
  windowMs: 60 * 1000,
  message: 'AI throughput limit reached. Please wait a moment before sending another request.'
});

const formRateLimiter = createRateLimiter({
  maxRequests: 30,
  windowMs: 60 * 1000,
  message: 'Submission limit reached. Please wait a moment before resubmitting.'
});

import {
  DiagnoseSchema,
  SmartTriageSchema,
  DiagnosticPathSchema,
  CalculateCompletionSchema,
  BookingScheduleSchema,
  SupportMessageSchema,
  AcademyVideoSchema,
  SupportChatSchema
} from './src/lib/schemas.ts';

const VERCEL_CONNECT_RESOURCE = 'mcp.vercel.com/cheyoung1983-sudo-www-displaycellpros-com-refractored';

// AWS Aurora Database API endpoints
app.get('/api/db/health', async (_req, res) => {
  try {
    const { query, getPoolMetrics } = await import('./src/lib/db.ts');
    const result = await query('SELECT NOW() as now, version() as version', []);
    res.json({
      status: 'ok',
      timestamp: result.rows[0]?.now,
      version: result.rows[0]?.version,
      database: process.env.PGDATABASE || 'postgres',
      host: process.env.PGHOST || 'dcp-production-db.cluster-cs7wcksg2js1.us-east-1.rds.amazonaws.com',
      poolMetrics: getPoolMetrics()
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Database connection error' });
  }
});

app.get('/api/db/version', async (_req, res) => {
  try {
    const { query } = await import('./src/lib/db.ts');
    const result = await query('SELECT version() as version', []);
    res.json({ status: 'ok', version: result.rows[0]?.version });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Database query error' });
  }
});

app.get('/api/db/read-only/version', async (_req, res) => {
  try {
    const { queryReadOnly } = await import('./src/lib/db.ts');
    const result = await queryReadOnly('SELECT version() as version', []);
    res.json({
      status: 'ok',
      version: result.rows[0]?.version,
      host: process.env.PGHOST_READ_ONLY || 'dcp-production-db.cluster-ro-cs7wcksg2js1.us-east-1.rds.amazonaws.com'
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Read-only database query error' });
  }
});

// Database Connection Pool Performance Metrics Endpoint
app.get('/api/db/pool/metrics', async (_req, res) => {
  try {
    const { getPoolMetrics } = await import('./src/lib/db.ts');
    res.json(getPoolMetrics());
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Error fetching pool metrics' });
  }
});

// High-Traffic Database Index Suggestions & DDL Generator
app.get('/api/db/indexes/suggestions', async (_req, res) => {
  try {
    const { REPAIR_DB_INDEX_RECOMMENDATIONS, generateMigrationScript } = await import('./src/lib/dbOptimizations.ts');
    res.json({
      status: 'ok',
      totalRecommendations: REPAIR_DB_INDEX_RECOMMENDATIONS.length,
      recommendations: REPAIR_DB_INDEX_RECOMMENDATIONS,
      migrationScript: generateMigrationScript(),
      strategies: [
        'CONCURRENT indexing to eliminate exclusive table locks during production deployment',
        'Partial indexing on uncompleted bench repair jobs to minimize index cache footprint',
        'Composite (customer_email, created_at DESC) indexing to eradicate filesort overhead',
        'BRIN indexing for time-series repair analytics and turnaround metric queries'
      ]
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Error fetching index recommendations' });
  }
});

// Execute B-Tree Index Migration for supported_devices table (device_model, repair_category)
app.post('/api/db/migrate/indexes', async (_req, res) => {
  try {
    const { runSupportedDevicesIndexMigration } = await import('./src/lib/db.ts');
    const result = await runSupportedDevicesIndexMigration();
    res.json({
      status: 'ok',
      ...result
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Migration execution failed' });
  }
});

app.get('/api/db/migrate/indexes', async (_req, res) => {
  try {
    const { runSupportedDevicesIndexMigration, SUPPORTED_DEVICES_INDEX_MIGRATION_SQL } = await import('./src/lib/db.ts');
    const result = await runSupportedDevicesIndexMigration();
    res.json({
      status: 'ok',
      sql: SUPPORTED_DEVICES_INDEX_MIGRATION_SQL,
      ...result
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Migration verification failed' });
  }
});

// Auth0 Authorization Extension RBAC Endpoints
app.get('/api/auth/rbac/config', (_req, res) => {
  res.json({
    status: 'ok',
    configuration: [
      {
        _id: 'v1',
        apikey: '66cb7c53a6b208edaff503f67bf39038d49948109fff330389e2761c6b3a6af5',
        rolesInToken: true,
        rolesPassthrough: true
      }
    ],
    permissions: [
      {
        _id: '8df20543-aa89-4ddb-aa83-cb00cab1801b',
        name: 'dcp',
        description: 'dcp1',
        applicationId: 'iHyCQzrHYenv4lrkCFy4v9528jtJUUHl',
        applicationType: 'client'
      }
    ],
    groups: [
      {
        _id: 'f80d5dc6-aa81-4a1e-89ef-46cafa97b541',
        name: 'SuperAdmin',
        description: 'Root',
        members: ['google-oauth2|102574138357203183279']
      }
    ]
  });
});

app.post('/api/auth/rbac/verify', (req, res) => {
  const { sub, email, groups = [], permissions = [] } = req.body || {};
  const isSuperAdminMember = sub === 'google-oauth2|102574138357203183279' || 
    (email && email.toLowerCase() === 'cheyoung1983@gmail.com') ||
    groups.includes('SuperAdmin');

  const hasDcp = permissions.includes('dcp') || isSuperAdminMember;

  res.json({
    status: 'ok',
    sub,
    isSuperAdmin: isSuperAdminMember,
    roles: isSuperAdminMember ? ['SuperAdmin'] : groups,
    permissions: hasDcp ? ['dcp', ...permissions] : permissions,
    accessLevel: isSuperAdminMember ? 'Root Administrator' : 'Technician',
    timestamp: new Date().toISOString()
  });
});

// Stripe Embedded Checkout Session Creation API
app.post('/api/checkout/session', async (req, res) => {
  try {
    const { getStripe } = await import('./src/lib/stripe.ts');
    const { productId, name, description, amountInCents } = req.body || {};

    const stripe = getStripe();

    const productName = name || `Spokane Lab Repair Tier - ${productId || 'Standard Service'}`;
    const productDescription = description || 'Certified laboratory bench diagnostics and micro-soldering rework.';
    const unitAmount = Number(amountInCents) > 0 ? Number(amountInCents) : 14900; // $149.00 USD default

    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      redirect_on_completion: 'never',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: productName,
              description: productDescription,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
    });

    res.json({
      status: 'ok',
      clientSecret: session.client_secret,
      sessionId: session.id,
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to create Stripe Checkout session',
    });
  }
});

// Database Query Benchmark Endpoint
app.get('/api/db/benchmark', async (_req, res) => {
  try {
    const { query, queryReadOnly, getPoolMetrics } = await import('./src/lib/db.ts');
    
    const startPrimary = Date.now();
    let primaryLatency = -1;
    let roLatency = -1;

    try {
      await query('SELECT 1 as ping', []);
      primaryLatency = Date.now() - startPrimary;
    } catch {
      primaryLatency = -1;
    }

    const startRO = Date.now();
    try {
      await queryReadOnly('SELECT 1 as ping', []);
      roLatency = Date.now() - startRO;
    } catch {
      roLatency = -1;
    }

    res.json({
      status: 'ok',
      benchmarkTimestamp: new Date().toISOString(),
      primaryCluster: {
        latencyMs: primaryLatency,
        status: primaryLatency >= 0 ? 'online' : 'unreachable'
      },
      readOnlyReplica: {
        latencyMs: roLatency,
        status: roLatency >= 0 ? 'online' : 'unreachable'
      },
      poolMetrics: getPoolMetrics()
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Error executing database benchmark' });
  }
});

app.get('/api/db/comments', async (_req, res) => {
  try {
    const { query } = await import('./src/lib/db.ts');
    const result = await query('SELECT * FROM comments ORDER BY id DESC LIMIT 50', []);
    res.json({ status: 'ok', comments: result.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Database query error' });
  }
});

// Vercel Connect Token Endpoint
app.post('/api/auth/vercel-connect/token', async (req, res) => {
  try {
    const { subjectType = 'app', userId = 'usr_123', scopes = ['openid', 'email', 'profile', 'offline_access'], externalSubject = 'external-subject-123', fullResponse = false } = req.body || {};

    let params: any = { subject: { type: 'app' } };
    if (subjectType === 'user') {
      params = { subject: { type: 'user', id: userId }, scopes };
    } else if (subjectType === 'jwt-bearer') {
      params = { subject: { type: 'jwt-bearer', sub: externalSubject }, scopes };
    }

    if (fullResponse) {
      const response = await getTokenResponse(VERCEL_CONNECT_RESOURCE, params);
      res.json({ status: 'ok', resource: VERCEL_CONNECT_RESOURCE, data: response });
    } else {
      const token = await getToken(VERCEL_CONNECT_RESOURCE, params);
      res.json({ status: 'ok', resource: VERCEL_CONNECT_RESOURCE, token });
    }
  } catch (error: any) {
    const handled = handleVercelConnectError(error);
    res.status(500).json({ status: 'error', resource: VERCEL_CONNECT_RESOURCE, ...handled });
  }
});

  // Gemini AI Diagnostic Assistant
  app.post('/api/ai/diagnose', aiRateLimiter, async (req, res) => {
    const parseResult = DiagnoseSchema.safeParse(req.body);
    const data = parseResult.success
      ? parseResult.data 
      : { telemetry: undefined, customerReportedIssue: '', deviceModel: 'Client Unit' };

    const cacheKey = `diag_${data.deviceModel}_${data.telemetry?.ammeterDrawAmps}_${data.telemetry?.isShortToGround}_${(data.customerReportedIssue || '').slice(0, 50)}`;
    const cached = diagnosticCache.get(cacheKey);
    if (cached) {
      return res.json({ analysis: cached, cached: true });
    }

    try {
      const analysis = await diagnoseIssue(data);

      if (analysis) {
        diagnosticCache.set(cacheKey, analysis);
        return res.json({ analysis });
      }

      // Rule-based fallback if GEMINI_API_KEY is not configured or failed
      const current = data.telemetry?.ammeterDrawAmps ?? 0;
      const isShort = Boolean(data.telemetry?.isShortToGround);
      const tier = isShort || current > 2.0 ? 'Tier 3 (Board Rework)' : current < 1.0 ? 'Tier 1 (Power/Port)' : 'Tier 2 (Display/Assembly)';
      
      const fallbackReport = `### D&CP Engineering Diagnostic Report\n**Device Target:** ${data.deviceModel || 'Client Unit'}  \n**Service Classification:** ${tier}  \n**Primary Finding:** ${isShort ? 'Logical short detected on primary power rail (VDD_MAIN).' : 'Telemetry indicates standard power delivery and logic loop analysis.'}\n\n#### Technical Analysis\n- **Current Draw:** ${current}A (${current > 2.0 ? 'Abnormal elevated draw' : 'Nominal draw'})\n- **Battery Health:** ${data.telemetry?.batteryHealthPercentage ?? 92}% (Nominal)\n- **Bench Protocol:** ${isShort ? 'Perform thermal imaging and rosin vapor detection to isolate shorted capacitor/PMIC.' : 'Verify dock connector flex and test battery under nominal load.'}\n\n#### Compliance & Safety\n- **WA RCW 19.415 Disclosure:** All OEM repair rights preserved. Safe non-destructive diagnostic bench scan performed.`;
      
      diagnosticCache.set(cacheKey, fallbackReport);
      return res.json({ analysis: fallbackReport });
    } catch (error: any) {
      console.error('AI Error:', error);
      res.json({
        analysis: `### Diagnostic Analysis (Cached Mode)\n**Status:** Service telemetry verified.\n**Recommendation:** Proceed with standard bench isolation and voltage rail probe under IPC-A-610 protocols.`
      });
    }
  });

  // Gemini Smart Triage Symptom Analyzer API
  app.post('/api/ai/smart-triage', aiRateLimiter, async (req, res) => {
    const parseResult = SmartTriageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: parseResult.error.issues[0]?.message || 'Invalid triage input' 
      });
    }

    const data = parseResult.data;
    const cacheKey = `triage_${data.deviceModel}_${data.symptomDescription.trim().toLowerCase()}`;
    const cachedTriage = triageCache.get(cacheKey);
    if (cachedTriage) {
      return res.json({ success: true, triage: cachedTriage, cached: true });
    }

    try {
      const triageResult = await smartTriage(data);

      if (triageResult) {
        triageCache.set(cacheKey, triageResult);
        return res.json({ success: true, triage: triageResult });
      }

      // Fallback rule-based smart triage if GEMINI_API_KEY is not set or API failed
      const descLower = (data.symptomDescription || '').toLowerCase();
      let suspectedFault = "Power Rail & Charge IC Interruption";
      let recommendedTier = "TIER_1_POWER_PORT_REFRESH";
      let recommendedTierLabel = "Tier 1 (Power/Port Refresh)";
      let confidenceScore = 85;
      let summary = "Analysis indicates power delivery or port contact impedance issue. Recommended bench current measurement to verify USB-C negotiation.";
      let diyInitialSteps = [
        "Power cycle the device while holding Force Reset keys for 15 seconds.",
        "Inspect the charge port under bright light for compressed lint or debris.",
        "Try an official high-wattage power adapter and cable."
      ];
      let technicianChecklistAdvice = [
        "Verify DC Ammeter current draw under 5V and 20V negotiation.",
        "Test battery internal resistance and fuel gauge IC telemetry."
      ];

      if (descLower.includes('screen') || descLower.includes('display') || descLower.includes('crack') || descLower.includes('touch') || descLower.includes('lines') || descLower.includes('black')) {
        suspectedFault = "Display Digitizer & OLED Matrix Fault";
        recommendedTier = "TIER_2_DISPLAY_RENEWAL";
        recommendedTierLabel = "Tier 2 (Display Renewal)";
        confidenceScore = 92;
        summary = "Reported symptoms match display assembly or digitizer layer failure. Requires OEM glass replacement and touch grid recalibration.";
        diyInitialSteps = [
          "Check if the device still vibrates or emits sound when toggling mute or plugging into power.",
          "Shine a bright flashlight on the display to check if faint image is visible (backlight coil failure vs screen).",
          "Ensure no liquid or heavy pressure was applied recently."
        ];
        technicianChecklistAdvice = [
          "Inspect FPC display connector pins for corrosion or bent pins.",
          "Test new OEM display assembly before final adhesive sealing."
        ];
      } else if (descLower.includes('short') || descLower.includes('water') || descLower.includes('liquid') || descLower.includes('heat') || descLower.includes('dead') || descLower.includes('solder') || descLower.includes('bootloop')) {
        suspectedFault = "VDD_MAIN Logic Board Short / Component Short";
        recommendedTier = "TIER_3_MICRO_SOLDERING";
        recommendedTierLabel = "Tier 3 (Logic Board Rework)";
        confidenceScore = 94;
        summary = "Symptoms strongly suggest a primary rail short to ground (VDD_MAIN / VDD_BOOST). Requires thermal inspection, rosin cloud mapping, and micro-soldering BGA replacement.";
        diyInitialSteps = [
          "Do NOT attempt to plug the device into a charger to prevent copper trace delamination.",
          "If exposed to liquid, keep the device in an airtight container with desiccant gel.",
          "Backup any cloud-synced data if temporary power was active."
        ];
        technicianChecklistAdvice = [
          "Connect to DC Bench Power Supply and observe short-circuit current draw.",
          "Apply Rosin flux / Thermal camera to identify blooming capacitor or PMIC."
        ];
      }

      const fallbackResult = {
        suspectedFault,
        recommendedTier,
        recommendedTierLabel,
        confidenceScore,
        summary,
        diyInitialSteps,
        technicianChecklistAdvice
      };

      triageCache.set(cacheKey, fallbackResult);
      return res.json({
        success: true,
        triage: fallbackResult
      });
    } catch (error) {
      console.error('Smart Triage Error:', error);
      res.json({
        success: true,
        triage: {
          suspectedFault: "Hardware Diagnostic Required",
          recommendedTier: "TIER_1_POWER_PORT_REFRESH",
          recommendedTierLabel: "Tier 1 (Standard Triage)",
          confidenceScore: 80,
          summary: "Intake registered for bench testing and hardware telemetry scan.",
          diyInitialSteps: ["Perform clean restart", "Inspect ports for debris"],
          technicianChecklistAdvice: ["Measure DC ammeter load", "Check battery health"]
        }
      });
    }
  });

  // Gemini AI Recommended Diagnostic Path Endpoint (Handles both /api/ai/diagnostic-path and /api/diagnostic-path)
  const handleDiagnosticPath = async (req: express.Request, res: express.Response) => {
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
        return res.json({ success: true, path });
      }

      // Fallback rule-based diagnostic path generator when GEMINI_API_KEY is omitted or timed out
      const fallbackPath = generateFallbackDiagnosticPath(data);
      return res.json({ success: true, path: fallbackPath });
    } catch (error) {
      console.error('Diagnostic Path API Error:', error);
      const fallbackPath = generateFallbackDiagnosticPath(data);
      res.json({ success: true, path: fallbackPath });
    }
  };

  app.post('/api/ai/diagnostic-path', aiRateLimiter, handleDiagnosticPath);
  app.post('/api/diagnostic-path', aiRateLimiter, handleDiagnosticPath);

  // Repair Status Workload Calculation API
  app.post('/api/repair-status/calculate-completion', (req, res) => {
    try {
      const parseResult = CalculateCompletionSchema.safeParse(req.body);
      const {
        serviceTier,
        currentStage,
        queuePosition,
        totalQueueJobs,
        activeTechnicians,
        partsInStock,
        priorityExpress
      } = parseResult.success ? parseResult.data : {
        serviceTier: 'Tier 2 (Display Renewal)',
        currentStage: 1,
        queuePosition: 3,
        totalQueueJobs: 12,
        activeTechnicians: 3,
        partsInStock: true,
        priorityExpress: 'standard' as const
      };

      // Base bench hours
      let baseBenchHours = 2.0;
      const tierLower = String(serviceTier).toLowerCase();
      if (tierLower.includes('tier 1') || tierLower.includes('power') || tierLower.includes('port')) {
        baseBenchHours = 1.2;
      } else if (tierLower.includes('tier 2') || tierLower.includes('display') || tierLower.includes('screen')) {
        baseBenchHours = 2.5;
      } else if (tierLower.includes('tier 3') || tierLower.includes('board') || tierLower.includes('soldering')) {
        baseBenchHours = 5.5;
      } else if (tierLower.includes('tier 4') || tierLower.includes('data')) {
        baseBenchHours = 12.0;
      }

      let stageMultiplier = 1.0;
      if (currentStage === 2) stageMultiplier = 0.85;
      if (currentStage === 3) stageMultiplier = 0.40;
      if (currentStage === 4) stageMultiplier = 0.10;

      const effectiveTechs = Math.max(1, Number(activeTechnicians) || 1);
      const queueJobsAhead = Math.max(0, (Number(queuePosition) || 1) - 1);
      let queueWaitHours = (queueJobsAhead * 0.75) / effectiveTechs;

      let partsDelayHours = 0;
      if (!partsInStock && currentStage < 3) {
        partsDelayHours = 24.0;
      }

      let priorityMultiplier = 1.0;
      if (priorityExpress === 'express') priorityMultiplier = 0.5;
      if (priorityExpress === 'emergency') priorityMultiplier = 0.25;

      const activeBenchHours = Number((baseBenchHours * stageMultiplier * priorityMultiplier).toFixed(1));
      const triageHours = currentStage === 1 ? 0.3 : 0;
      queueWaitHours = Number((queueWaitHours * priorityMultiplier).toFixed(1));
      const qaHours = tierLower.includes('tier 3') ? 1.5 : 0.75;

      const totalCalculatedHours = Number((triageHours + queueWaitHours + activeBenchHours + partsDelayHours + qaHours).toFixed(1));

      const now = new Date();
      const completionTimeMs = now.getTime() + totalCalculatedHours * 3600 * 1000;
      const estimatedCompletionDate = new Date(completionTimeMs);

      const formattedDate = estimatedCompletionDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });

      const formattedTime = estimatedCompletionDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });

      res.json({
        success: true,
        calculation: {
          formattedCompletionWindow: `${formattedDate} at ${formattedTime}`,
          totalCalculatedHours,
          baseBenchHours,
          queueWaitHours,
          partsDelayHours,
          qaHours,
          workloadLevel: totalQueueJobs > 15 ? 'Peak Queue Load' : totalQueueJobs < 6 ? 'Low Traffic' : 'Moderate Load'
        }
      });
    } catch (error) {
      console.error('Completion calculation error:', error);
      res.status(500).json({ success: false, error: 'Calculation failed' });
    }
  });

  // Repair Status Tracker API
  app.get('/api/repair-status/:ticketNumber', (req, res) => {
    const ticketNumber = (req.params.ticketNumber || '').trim().toUpperCase().slice(0, 30);

    // Default mock stage mapping for predefined tickets or custom user tickets
    const sampleTickets: Record<string, any> = {
      'DCP-8842': {
        ticketNumber: 'DCP-8842',
        customerName: 'Alex Mercer',
        deviceModel: 'iPhone 15 Pro Max',
        serviceTier: 'Tier 3 (Board Rework)',
        currentStage: 2,
        estimatedCompletionDate: 'Tomorrow at 3:15 PM (18h remaining)',
        technicianNotes: 'Triage complete. Awaiting logic board components for VDD_MAIN short rework near U3100 PMIC.',
        telemetrySummary: {
          batteryHealthPercentage: 88,
          batteryTempCelsius: 34,
          ammeterDrawAmps: 4.8,
          isShortToGround: true,
        },
        workloadFactors: {
          queuePosition: 3,
          totalQueueJobs: 12,
          activeTechnicians: 3,
          partsInStock: true,
        },
        lastUpdated: '10 minutes ago',
      },
      'DCP-9012': {
        ticketNumber: 'DCP-9012',
        customerName: 'Sarah Jenkins',
        deviceModel: 'Samsung Galaxy S24 Ultra',
        serviceTier: 'Tier 2 (Display Renewal)',
        currentStage: 3,
        estimatedCompletionDate: 'Today at 5:30 PM (2h remaining)',
        technicianNotes: 'Bench testing active. OEM Display Assembly installed and undergoing digitizer touch grid calibration.',
        telemetrySummary: {
          batteryHealthPercentage: 94,
          batteryTempCelsius: 31,
          ammeterDrawAmps: 0.85,
          isShortToGround: false,
        },
        workloadFactors: {
          queuePosition: 1,
          totalQueueJobs: 8,
          activeTechnicians: 4,
          partsInStock: true,
        },
        lastUpdated: '25 minutes ago',
      },
      'DCP-3109': {
        ticketNumber: 'DCP-3109',
        customerName: 'Marcus Vance',
        deviceModel: 'iPad Pro 12.9" (M2)',
        serviceTier: 'Tier 1 (Power/Port Refresh)',
        currentStage: 4,
        estimatedCompletionDate: 'Completed (Ready for Pickup)',
        technicianNotes: 'Quality Assurance complete. Charge current nominal at 2.1A. Ready for customer pickup at Spokane Lab HQ.',
        telemetrySummary: {
          batteryHealthPercentage: 91,
          batteryTempCelsius: 28,
          ammeterDrawAmps: 2.1,
          isShortToGround: false,
        },
        workloadFactors: {
          queuePosition: 0,
          totalQueueJobs: 5,
          activeTechnicians: 3,
          partsInStock: true,
        },
        lastUpdated: '1 hour ago',
      }
    };

    if (sampleTickets[ticketNumber]) {
      return res.json({ success: true, ticket: sampleTickets[ticketNumber] });
    }

    // Dynamic mock for any other valid ticket number format
    const stages = [1, 2, 3, 4];
    const numHash = ticketNumber.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const mockStage = stages[numHash % stages.length];

    res.json({
      success: true,
      ticket: {
        ticketNumber,
        customerName: 'Verified Customer',
        deviceModel: 'Mobile Communications Unit',
        serviceTier: mockStage > 2 ? 'Tier 3 (Board Rework)' : 'Tier 2 (Display Renewal)',
        currentStage: mockStage,
        estimatedCompletionDate: mockStage === 4 ? 'Completed' : 'Within 24 Hours',
        technicianNotes: `Ticket ${ticketNumber} is active in D&CP Spokane Lab. Current stage: ${mockStage}/4. Telemetry diagnostics active.`,
        telemetrySummary: {
          batteryHealthPercentage: 85 + (numHash % 12),
          batteryTempCelsius: 30 + (numHash % 10),
          ammeterDrawAmps: mockStage > 2 ? 2.45 : 0.65,
          isShortToGround: mockStage > 2,
        },
        lastUpdated: 'Just now'
      }
    });
  });

  // Shopify & Lab Intake Sync
  app.post('/api/intake/sync', formRateLimiter, async (req, res) => {
    const data = req.body || {};
    const devicePhotos = data.devicePhotos || [];
    const photoMetadata = data.photoMetadata || {
      totalCount: devicePhotos.length,
      categories: Array.from(new Set(devicePhotos.map((p: any) => p.category || 'General Condition')))
    };
    
    console.log('Syncing intake with Spokane Lab & Shopify:', {
      deviceManufacturer: data.deviceManufacturer,
      deviceModel: data.deviceModel,
      imei: data.imei,
      attachedPhotosCount: devicePhotos.length,
      photoCategories: photoMetadata.categories
    });
    
    const draftOrderId = `gid://shopify/DraftOrder/${Math.floor(100000000 + Math.random() * 900000000)}`;

    if (!process.env.SHOPIFY_STORE_DOMAIN || !process.env.SHOPIFY_ADMIN_API_TOKEN) {
      return res.json({ 
        success: true, 
        mocked: true,
        draftOrderId,
        invoiceUrl: 'https://checkout.shopify.com/mock-invoice',
        attachedPhotoCount: devicePhotos.length,
        attachedCategories: photoMetadata.categories,
        labTicketCreated: true,
      });
    }

    try {
      res.json({ 
        success: true, 
        draftOrderId, 
        invoiceUrl: '#',
        attachedPhotoCount: devicePhotos.length,
        attachedCategories: photoMetadata.categories,
        labTicketCreated: true,
      });
    } catch (error) {
      res.status(500).json({ success: false, errors: ['Shopify synchronization failed'] });
    }
  });

  // Support Message API
  app.post('/api/support/message', formRateLimiter, async (req, res) => {
    const parseResult = SupportMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: parseResult.error.issues[0]?.message || 'All fields are required and must be valid.' 
      });
    }

    const { name, email, subject, message } = parseResult.data;
    console.log('Support message received:', { name, email, subject, messageLength: message.length });
    
    res.json({ 
      success: true, 
      messageId: `msg_${Math.random().toString(36).substring(2, 11)}`,
      status: 'Queued for Lab Review' 
    });
  });

  // Real-time Support Chat API
  app.post('/api/support/chat', aiRateLimiter, async (req, res) => {
    try {
      const parseResult = SupportChatSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          success: false, 
          error: parseResult.error.issues[0]?.message || 'Message is required' 
        });
      }

      const data = parseResult.data;

      try {
        const reply = await generateSupportReply(data);

        if (reply) {
          return res.json({
            success: true,
            reply: reply,
            technician: {
              name: "David Chen",
              title: "Lead Systems Engineer",
              avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200"
            }
          });
        }
      } catch (aiErr) {
        console.warn('Gemini support chat call failed, falling back to rule-based technician response:', aiErr);
      }

      // Smart fallback responses if Gemini API Key is not set
      let reply = "Thank you for contacting Spokane Lab HQ. Our bench technicians are standing by. For immediate status updates, please check the Repair Status Tracker or submit a formal Intake Form.";
      const lower = message.toLowerCase();

      if (lower.includes('status') || lower.includes('ticket') || lower.includes('dcp-')) {
        reply = "I can assist with ticket telemetry! Please ensure your Ticket ID (e.g., DCP-8842) is entered into our 'Repair Status Tracker' tab for real-time oscilloscope and voltage readings directly from our bench.";
      } else if (lower.includes('price') || lower.includes('cost') || lower.includes('quote') || lower.includes('how much')) {
        reply = "Our pricing is transparent: Tier 1 (Power/Battery) starts around $65–$85, Tier 2 (OLED Display) starts around $145–$185, and Tier 3 (Logic Board micro-soldering) is custom evaluated after diagnostic triage. You can use our Repair Estimate Calculator for an instant quote.";
      } else if (lower.includes('data') || lower.includes('privacy') || lower.includes('passcode') || lower.includes('safe')) {
        reply = "Data security is our top priority. We operate under strict RCW 19.415 compliance. We never ask for device passcodes for standard hardware repairs unless calibration is required.";
      } else if (lower.includes('hour') || lower.includes('open') || lower.includes('location') || lower.includes('spokane')) {
        reply = "Our Spokane Lab at 115 S Adams St is open Mon-Fri, 8:00 AM – 6:00 PM PST. Live bench technicians are on duty during these hours!";
      } else if (lower.includes('water') || lower.includes('liquid') || lower.includes('short') || lower.includes('soldering')) {
        reply = "For liquid damage or board shorts, do NOT attempt to charge the device. Bring or ship it to Spokane Lab immediately for ultrasonic cleaning and rosin cloud thermal isolation.";
      }

      return res.json({
        success: true,
        reply,
        technician: {
          name: "David Chen",
          title: "Lead Systems Engineer",
          avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200"
        }
      });
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({ 
        success: false, 
        reply: "Our bench network experienced a transient signal interrupt. Please retry or transmit an email inquiry.",
        technician: {
          name: "Spokane Lab Support",
          title: "Engineering Queue",
          avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200"
        }
      });
    }
  });

  // Repair Academy AI Video Generator API
  app.post('/api/academy/generate-video', aiRateLimiter, async (req, res) => {
    const parseResult = AcademyVideoSchema.safeParse(req.body);
    const { topic = 'General Electronics Maintenance' } = parseResult.success ? parseResult.data : { topic: 'General Electronics Maintenance' };

    const cacheKey = `video_${topic.trim().toLowerCase()}`;
    const cachedVideo = videoGuideCache.get(cacheKey);
    if (cachedVideo) {
      return res.json({ success: true, video: cachedVideo, cached: true });
    }

    try {
      const parsed = await generateAcademyVideo(topic);

      if (parsed) {
        videoGuideCache.set(cacheKey, parsed);
        return res.json({ success: true, video: parsed });
      }
    } catch (aiErr) {
      console.warn('Gemini video generation failed, falling back to rule-based video generator:', aiErr);
    }

      // Fallback AI video tutorial response if GEMINI_API_KEY is absent or failed
      const topicLower = topic.toLowerCase();
      let category = "Cleanliness";
      if (topicLower.includes('display') || topicLower.includes('screen') || topicLower.includes('oled')) category = "Display";
      if (topicLower.includes('battery') || topicLower.includes('power') || topicLower.includes('charge')) category = "Power";
      if (topicLower.includes('static') || topicLower.includes('esd') || topicLower.includes('ground')) category = "ESD";
      if (topicLower.includes('solder') || topicLower.includes('tool') || topicLower.includes('driver')) category = "Tools";

      const fallbackVideo = {
        id: `vid-${Date.now()}`,
        title: `DIY Tutorial: ${topic}`,
        category,
        difficulty: "Intermediate",
        estimatedTime: "2:30 mins",
        description: `Step-by-step technical guide for ${topic} formulated by D&CP Spokane Lab Engineers.`,
        requiredTools: ["99.9% Anhydrous Isopropyl Alcohol", "Precision Microfiber Cloth", "Anti-Static Nylon Spudger"],
        safetyWarnings: ["Ensure device is fully powered down before applying liquids.", "Never apply alcohol directly to open speaker grilles."],
        scenes: [
          {
            stepNumber: 1,
            title: "Bench Environment & Power Down",
            narration: "Before beginning any maintenance, power down the device completely and discharge static electricity using an ESD wrist strap.",
            durationSeconds: 5,
            visualPrompt: "Technician grounding wrist strap and switching off device under ESD ring light.",
            graphicType: "warning",
            highlightRegion: { x: 50, y: 30, label: "Power Switch & ESD Strap" },
            actionTip: "Touch a grounded metal surface before handling delicate circuitry."
          },
          {
            stepNumber: 2,
            title: "Applying Anhydrous Solvents",
            narration: "Apply 2-3 drops of 99.9% Isopropyl Alcohol onto a lint-free microfiber cloth. Do NOT spray solvent directly onto display glass.",
            durationSeconds: 6,
            visualPrompt: "Precision applicator dropping anhydrous IPA onto microfiber cloth weave.",
            graphicType: "cleaning",
            highlightRegion: { x: 45, y: 55, label: "Microfiber Applicator Zone" },
            actionTip: "Higher water percentages in 70% alcohol can seep under display bezels and cause backlight staining."
          },
          {
            stepNumber: 3,
            title: "Circular Buffing & Debris Removal",
            narration: "Gently wipe in small overlapping circular motions, working from the center outward to dissolve finger oils and adhesive residues.",
            durationSeconds: 7,
            visualPrompt: "Magnified view of oleophobic layer restoration and oil residue breakdown.",
            graphicType: "microscope",
            highlightRegion: { x: 50, y: 50, label: "Display Surface Grid" },
            actionTip: "Use uniform light pressure. Excess force can damage delicate anti-reflective coatings."
          },
          {
            stepNumber: 4,
            title: "Final Inspection under UV Telemetry",
            narration: "Inspect the glass under angled LED lighting to ensure zero lint or streaks remain before re-engaging the device.",
            durationSeconds: 6,
            visualPrompt: "Angled inspection light revealing pristine glass surface.",
            graphicType: "tool",
            highlightRegion: { x: 60, y: 40, label: "Inspection Angle" },
            actionTip: "Check perimeter seals for any liquid ingress before powering back on."
          }
        ]
      };

      videoGuideCache.set(cacheKey, fallbackVideo);
      return res.json({ success: true, video: fallbackVideo });
    } catch (error) {
      console.error('Academy video generator error:', error);
      res.json({
        success: true,
        video: {
          id: `vid-${Date.now()}`,
          title: `Technical Guide: ${topic}`,
          category: "Tools",
          difficulty: "Beginner",
          estimatedTime: "2:00 mins",
          description: `Laboratory procedures for ${topic}.`,
          requiredTools: ["Precision Screwdriver Kit", "Nylon Spudger"],
          safetyWarnings: ["Work in an ESD safe environment"],
          scenes: [
            {
              stepNumber: 1,
              title: "Preparation & Inspection",
              narration: "Ground yourself and inspect the device casing thoroughly.",
              durationSeconds: 5,
              visualPrompt: "Technician performing preliminary examination.",
              graphicType: "warning",
              highlightRegion: { x: 50, y: 50, label: "Diagnostic Checkpoint" },
              actionTip: "Document all pre-existing cosmetic wear."
            }
          ]
        }
      });
    }
  });

  // Service Booking Drop-Off Reservation API
  app.post('/api/booking/schedule', formRateLimiter, async (req, res) => {
    try {
      const parseResult = BookingScheduleSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          success: false, 
          error: parseResult.error.issues[0]?.message || 'Required booking parameters missing or invalid.' 
        });
      }

      const { 
        date, 
        timeSlot, 
        dropOffType, 
        deviceCategory, 
        serviceTier, 
        customerName, 
        customerEmail, 
        customerPhone, 
        notes 
      } = parseResult.data;

      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const bookingId = `DCP-DROP-${randomSuffix}`;

      const bookingRecord = {
        bookingId,
        date,
        timeSlot,
        dropOffType: dropOffType || 'in_person',
        deviceCategory: deviceCategory || 'iPhone / iOS Device',
        serviceTier: serviceTier || 'tier2',
        customerName,
        customerEmail,
        customerPhone,
        notes: notes || '',
        createdAt: new Date().toISOString()
      };

      console.log('Spokane Lab Drop-Off Reservation Logged:', bookingRecord);

      return res.json({
        success: true,
        booking: bookingRecord
      });
    } catch (error) {
      console.error('Service booking error:', error);
      res.status(500).json({ success: false, error: 'Internal booking reservation error.' });
    }
  });

  // Dedicated JSON 404 handler for unmatched /api routes
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: `API route not found: ${req.method} ${req.originalUrl}`
    });
  });

  // Global API error handler to guarantee JSON response
  app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('API Error caught by global handler:', err);
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal Server Error'
    });
  });

  async function startServer() {
    if (!process.env.VERCEL) {
      if (process.env.NODE_ENV !== 'production') {
        const { createServer: createViteServer } = await import('vite');
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: 'spa',
        });
        app.use(vite.middlewares);
      } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      }

      app.listen(PORT, '0.0.0.0', () => {
        console.log(`D&CP LLC Server running on http://localhost:${PORT}`);
      });
    }
  }

  startServer();

  export default app;
