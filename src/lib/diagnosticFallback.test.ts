import { describe, it, expect } from 'vitest';
import { generateFallbackDiagnosticPath } from './diagnosticFallback.ts';

describe('Spokane Lab Diagnostic Path Fallback Engine', () => {
  it('generates OLED/display diagnostic path when screen damage is reported', () => {
    const result = generateFallbackDiagnosticPath({
      repairNotes: 'Cracked screen with green flickering lines',
      deviceManufacturer: 'Apple',
      deviceModel: 'iPhone 15 Pro',
      symptoms: ['Screen / Display Flickering']
    });

    expect(result.primaryDiagnosis).toContain('Display');
    expect(result.confidenceScore).toBeGreaterThanOrEqual(90);
    expect(result.diagnosticSteps.length).toBeGreaterThanOrEqual(3);
    expect(result.requiredTools).toContain('Trinocular Stereo Microscope');
  });

  it('generates VDD_MAIN short-circuit diagnostic path when short to ground is detected', () => {
    const result = generateFallbackDiagnosticPath({
      repairNotes: 'Device dropped in water, drawing high current',
      deviceManufacturer: 'Samsung',
      deviceModel: 'Galaxy S24 Ultra',
      telemetry: {
        batteryHealthPercentage: 80,
        batteryTempCelsius: 32,
        ammeterDrawAmps: 2.8,
        isShortToGround: true
      }
    });

    expect(result.primaryDiagnosis).toContain('Short');
    expect(result.complexityLevel).toContain('Tier 3');
    expect(result.diagnosticSteps.some(s => s.toolRequired.includes('Thermal'))).toBe(true);
  });

  it('generates battery diagnostic path when drainage or battery wear is reported', () => {
    const result = generateFallbackDiagnosticPath({
      repairNotes: 'Battery drains in 2 hours and randomly reboots',
      deviceManufacturer: 'Google',
      deviceModel: 'Pixel 8'
    });

    expect(result.primaryDiagnosis).toContain('Battery');
    expect(result.diagnosticSteps.length).toBeGreaterThanOrEqual(3);
  });

  it('provides baseline nominal steps for generic intake notes', () => {
    const result = generateFallbackDiagnosticPath({
      repairNotes: 'Routine bench inspection requested',
      deviceManufacturer: 'Motorola',
      deviceModel: 'Edge 50'
    });

    expect(result.diagnosticSteps.length).toBeGreaterThanOrEqual(3);
    expect(result.requiredTools.length).toBeGreaterThan(0);
    expect(result.riskPrecautions.length).toBeGreaterThan(0);
  });
});
