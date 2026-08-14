import { TelemetryData } from '../types.ts';

export interface DiagnosticStep {
  stepNumber: number;
  actionTitle: string;
  instructions: string;
  expectedReading: string;
  toolRequired: string;
}

export interface RecommendedDiagnosticPathData {
  primaryDiagnosis: string;
  confidenceScore: number;
  complexityLevel: string;
  estimatedBenchTimeMinutes: number;
  technicianBriefing: string;
  diagnosticSteps: DiagnosticStep[];
  requiredTools: string[];
  riskPrecautions: string[];
  partsLikelyNeeded: string[];
}

export function generateFallbackDiagnosticPath(params: {
  repairNotes?: string;
  deviceManufacturer?: string;
  deviceModel?: string;
  symptoms?: string[];
  telemetry?: TelemetryData;
}): RecommendedDiagnosticPathData {
  const {
    repairNotes = '',
    deviceManufacturer = 'Apple / Multi-Vendor',
    deviceModel = 'Bench Unit',
    symptoms = [],
    telemetry
  } = params;

  const notesLower = (repairNotes || '').toLowerCase();
  const symptomsLower = symptoms.map(s => s.toLowerCase());

  const hasKeyword = (keywords: string[]) =>
    keywords.some(k => notesLower.includes(k) || symptomsLower.some(s => s.includes(k)));

  // 1. Screen / Display / Touch Failure
  if (hasKeyword(['screen', 'crack', 'display', 'lines', 'black', 'flicker', 'touch', 'oled', 'lcd', 'digitizer', 'glass'])) {
    return {
      primaryDiagnosis: "Display Module / Digitizer FPC Flex Interruption",
      confidenceScore: 94,
      complexityLevel: "Tier 2 (Display Renewal & Calibration)",
      estimatedBenchTimeMinutes: 25,
      technicianBriefing: `Intake notes indicate display anomalies or touch matrix failure on ${deviceManufacturer} ${deviceModel}. Perform flashlight reflection check to verify GPU image rendering before adhesive release.`,
      diagnosticSteps: [
        {
          stepNumber: 1,
          actionTitle: "Flashlight Image & Backlight Isolation Test",
          instructions: "Shine high-intensity bench light directly on display glass during boot to confirm whether GPU renders image without backlight.",
          expectedReading: "Visible desktop icons under angled light = Backlight circuit fault; Complete dark screen = OLED panel or FPC failure",
          toolRequired: "High-Lumen Focus Inspection Flashlight"
        },
        {
          stepNumber: 2,
          actionTitle: "FPC Connector & Ground Pin Micro-Inspection",
          instructions: "Disconnect battery first, release display FPC, and inspect board socket under microscope for bent pins or blue corrosion.",
          expectedReading: "Zero pin displacement; nominal 0.420V diode drop on backlight boost line",
          toolRequired: "Trinocular Stereo Microscope & Multimeter"
        },
        {
          stepNumber: 3,
          actionTitle: "Modular OEM Test Panel Validation",
          instructions: "Connect verified OEM test panel assembly and test full 10-point multi-touch grid and ambient light sensor response.",
          expectedReading: "100% touch coverage across all quadrants; TrueTone/Ambient sensor transfer active",
          toolRequired: "OEM Known-Good Test Display Panel"
        }
      ],
      requiredTools: ["Trinocular Stereo Microscope", "Digital Multimeter", "ESD Driver Set", "Heated Separation Pad"],
      riskPrecautions: [
        "Unplug battery connector BEFORE connecting or disconnecting display FPC to prevent blown backlight filters.",
        "Keep heat plate temperature under 75°C to avoid lithium battery thermal expansion."
      ],
      partsLikelyNeeded: ["OEM Display & Digitizer Assembly", "Pre-cut Frame Waterproof Adhesive", "Display FPC Shield Bracket Screws"]
    };
  }

  // 2. Liquid Damage / Short to Ground / Board Rework
  if (hasKeyword(['water', 'liquid', 'short', 'drop in pool', 'corrosion', 'solder', 'hot', 'burning', 'smoke']) || telemetry?.isShortToGround) {
    return {
      primaryDiagnosis: "VDD_MAIN / VDD_BOOST Primary Rail Short-to-Ground",
      confidenceScore: 96,
      complexityLevel: "Tier 3 (Precision Micro-Soldering Rework)",
      estimatedBenchTimeMinutes: 55,
      technicianBriefing: `High-priority liquid ingress or main rail short detected on ${deviceManufacturer} ${deviceModel}. Do NOT attempt battery charge. Follow thermal localization protocol.`,
      diagnosticSteps: [
        {
          stepNumber: 1,
          actionTitle: "Mainboard Diode Mode Rail Impedance Sweep",
          instructions: "Place red multimeter probe to ground chassis, black probe to VDD_MAIN filter capacitor positive pads.",
          expectedReading: "Normal: 0.350V - 0.480V diode drop. Shorted rail: <0.020V (Buzzer sound)",
          toolRequired: "Digital Multimeter (Diode Mode)"
        },
        {
          stepNumber: 2,
          actionTitle: "Thermal Cam Short Localization & Freeze Inspection",
          instructions: "Inject 1.2V with 2.0A current limit directly onto shorted rail while monitoring under thermal imaging camera.",
          expectedReading: "Immediate pinpoint thermal bloom (>55°C) localized to shorted decoupling ceramic capacitor",
          toolRequired: "DC Bench Power Supply & Thermal Imaging Camera"
        },
        {
          stepNumber: 3,
          actionTitle: "SMD Capacitor Replacement & Post-Rework Audit",
          instructions: "Apply mechanic UV flux and clear shorted capacitor with hot air at 370°C. Clean pad and measure impedance again.",
          expectedReading: "Diode reading returns above 0.380V; zero current draw at 0V sleep standby",
          toolRequired: "Hot Air Rework Station & Micro-Soldering Iron"
        }
      ],
      requiredTools: ["DC Bench Power Supply", "Thermal Imaging Camera", "Micro-Soldering Station", "99.9% Anhydrous Isopropanol"],
      riskPrecautions: [
        "Never exceed rated rail voltage during DC injection to protect baseband and SoC silicon.",
        "Ensure all conformal shield residue is thoroughly cleaned before bench reassembly."
      ],
      partsLikelyNeeded: ["0402 / 0201 SMD Ceramic Capacitors", "Thermal Conductive Silicone Pad", "Mechanic Rework Solder Flux"]
    };
  }

  // 3. Battery Degradation / Rapid Discharge / Power Loop
  if (hasKeyword(['battery', 'die fast', 'drain', 'percentage', 'shut down', 'reboot', 'loop', 'warm', 'swollen', 'health'])) {
    return {
      primaryDiagnosis: "Battery Cell Degradation & Gas-Gauge Calibration Fault",
      confidenceScore: 92,
      complexityLevel: "Tier 1 (Rapid Battery Renewal)",
      estimatedBenchTimeMinutes: 20,
      technicianBriefing: `Battery degradation suspected for ${deviceManufacturer} ${deviceModel}. Telemetry indicates potential internal cell impedance increase or BMS cycle exhaustion.`,
      diagnosticSteps: [
        {
          stepNumber: 1,
          actionTitle: "Inline USB-C Power Delivery Negotiated Current Analysis",
          instructions: "Connect to bench USB-PD monitor and measure fast charging handshake voltage and current curve.",
          expectedReading: "Nominal: 9.0V @ 1.8A - 2.2A fast charge rate; Faulty: oscillating between 0.05A and 0.45A",
          toolRequired: "USB-C Digital Power Analyzer"
        },
        {
          stepNumber: 2,
          actionTitle: "Battery Connector NTC & I2C Data Line Inspection",
          instructions: "Measure diode mode resistance on Bat_ID and Bat_NTC thermal sensor pins.",
          expectedReading: "Bat_ID: 0.650V - 0.720V; Bat_NTC: 0.580V - 0.680V (Nominal communication)",
          toolRequired: "Precision Multimeter"
        },
        {
          stepNumber: 3,
          actionTitle: "Replacement Battery Cycle & Load Simulation",
          instructions: "Install calibrated OEM battery cell, initialize BMS calibration cycle, and verify power-draw during 4K video playback load.",
          expectedReading: "Smooth discharge slope; steady 3.85V - 4.35V nominal cell voltage",
          toolRequired: "OEM Battery Programmer / Activator"
        }
      ],
      requiredTools: ["USB-C Power Analyzer", "Battery Pull Tab Grippers", "Precision Pentalobe & Tri-Point Drivers"],
      riskPrecautions: [
        "Do not puncture or bend lithium-ion pouch. Keep Class D fire safety container at bench.",
        "Always use antistatic adhesive release solvent rather than metal pry tools near battery cell."
      ],
      partsLikelyNeeded: ["High-Capacity OEM Battery Cell", "Pre-cut Battery Adhesive Strips", "Frame Perimeter Gasket Seal"]
    };
  }

  // 4. Port / Charging / Audio / Mic / Connectivity Fault
  if (hasKeyword(['charge', 'charging', 'port', 'mic', 'speaker', 'audio', 'earpiece', 'sound', 'lightning', 'usb-c', 'loose', 'slow charge'])) {
    return {
      primaryDiagnosis: "Charging Flex Port Contamination / Pin Sub-Board Fatigue",
      confidenceScore: 90,
      complexityLevel: "Tier 1 (Connector & Sub-Assembly Overhaul)",
      estimatedBenchTimeMinutes: 25,
      technicianBriefing: `Charging/audio sub-system issue reported on ${deviceManufacturer} ${deviceModel}. Inspect charge port receptacle for compressed lint and pin oxidation.`,
      diagnosticSteps: [
        {
          stepNumber: 1,
          actionTitle: "Receptacle Micro-Debris Extraction & Pin Scope",
          instructions: "Under stereo microscope, carefully extract lint with ultra-fine ESD tweezers. Check CC1/CC2 and VBUS pins for arcing burn marks.",
          expectedReading: "Full mechanical click when cable inserted; clean copper contacts",
          toolRequired: "Micro-Tweezers & Stereo Microscope"
        },
        {
          stepNumber: 2,
          actionTitle: "VBUS Input Voltage & Reverse Polarity Test",
          instructions: "Insert USB test breakout board and verify 5.1V / 9.2V transmission to PMIC without voltage droop.",
          expectedReading: "Steady 5.0V - 9.1V at mainboard interconnect test pad",
          toolRequired: "USB-C Breakout Board & Multimeter"
        },
        {
          stepNumber: 3,
          actionTitle: "Dock Assembly Current Draw Verification",
          instructions: "Verify charging current reaches rated laboratory baseline (>1.5A steady state).",
          expectedReading: "1.5A to 2.4A steady current draw",
          toolRequired: "USB Power Meter"
        }
      ],
      requiredTools: ["Stereo Microscope", "USB-C Test Breakout", "Precision ESD Driver Kit"],
      riskPrecautions: [
        "Avoid touching surrounding bottom speaker and haptic engine magnets with magnetic tweezers.",
        "Test microphones in voice memo app after dock installation before final housing seal."
      ],
      partsLikelyNeeded: ["OEM Charge Port Dock Flex Assembly", "Bottom Mic Acoustic Dust Filter Gasket"]
    };
  }

  // 5. Default General Diagnostic Flow
  return {
    primaryDiagnosis: "Power & Charge Rail Delivery Interruption",
    confidenceScore: 88,
    complexityLevel: "Tier 1 (Standard Bench Diagnostics)",
    estimatedBenchTimeMinutes: 20,
    technicianBriefing: `Diagnostic verification for ${deviceManufacturer} ${deviceModel}. Baseline hardware current consumption check recommended before internal chassis access.`,
    diagnosticSteps: [
      {
        stepNumber: 1,
        actionTitle: "DC USB Power Meter Consumption Check",
        instructions: "Connect device to inline USB-PD power meter. Observe handshake voltage step-up and current draw curve.",
        expectedReading: "1.2A - 2.1A @ 9V or 20V nominal charging curve",
        toolRequired: "USB-C Inline Ammeter / Power Analyzer"
      },
      {
        stepNumber: 2,
        actionTitle: "Visual Connector & Flex Pin Inspection",
        instructions: "Examine battery connector and charge port flex pins under stereo microscope for physical corrosion or displacement.",
        expectedReading: "Zero debris, uniform gold pin contact alignment",
        toolRequired: "Trinocular Stereo Microscope"
      },
      {
        stepNumber: 3,
        actionTitle: "Primary Power Rail Impedance Measurement",
        instructions: "Measure diode mode resistance to ground on VDD_MAIN and VDD_BOOST filter capacitors.",
        expectedReading: "0.350V - 0.480V diode drop (non-zero short)",
        toolRequired: "Digital Multimeter (Diode Mode)"
      }
    ],
    requiredTools: ["Digital Multimeter", "Stereo Microscope", "Precision Driver Kit", "DC Bench Power Supply"],
    riskPrecautions: [
      "Always disconnect battery BEFORE disconnecting display or camera flex cables.",
      "Use ESD grounding wrist strap when handling exposed mainboard PCB.",
      "Do not exceed 380°C hot air temperature near CPU or NAND memory shield."
    ],
    partsLikelyNeeded: [
      "OEM Battery / Port Flex",
      "Thermal Conductive Pad",
      "Replacement 0402 SMD Capacitors"
    ]
  };
}
