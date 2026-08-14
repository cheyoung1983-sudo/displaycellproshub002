import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import dotenv from 'dotenv';
import path from 'path';
import {
  listGatewayModels,
  getGatewayModelEndpoints,
  getGatewayCredits,
  AI_GATEWAY_BASE_URL
} from '../src/lib/aiGatewayClient.ts';

// Load both .env.local and .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
  console.log('=== Vercel AI Gateway Diagnostics & REST Verification ===');
  
  const apiKey =
    process.env.AI_GATEWAY_API_KEY ||
    process.env.AI_GATEWAY_TOKEN ||
    process.env.VERCEL_OIDC_TOKEN ||
    process.env.OPENAI_API_KEY;

  const baseURL =
    process.env.AI_GATEWAY_URL ||
    process.env.VERCEL_AI_GATEWAY_URL ||
    AI_GATEWAY_BASE_URL;

  console.log('Credentials detected:', apiKey ? '✓ Present' : '✗ Not detected in .env.local');
  console.log('Gateway BaseURL:', baseURL);

  // 1. Test REST Models Discovery (No Auth required)
  console.log('\n--- 1. Testing REST: GET /v1/models ---');
  try {
    const modelsRes = await listGatewayModels(baseURL);
    console.log(`✓ Fetched ${modelsRes.data?.length || 0} models successfully.`);
    const sampleModels = (modelsRes.data || []).slice(0, 5);
    sampleModels.forEach((m) => {
      console.log(`  • [${m.id}] ${m.name} (${m.type || 'language'}) - Max Tokens: ${m.max_tokens || 'N/A'}`);
    });
  } catch (err: any) {
    console.warn('  ⚠ Models discovery lookup note:', err.message || err);
  }

  // 2. Test REST Credits (Requires Auth)
  if (apiKey) {
    console.log('\n--- 2. Testing REST: GET /v1/credits ---');
    try {
      const credits = await getGatewayCredits(apiKey, baseURL);
      console.log(`✓ Credits Balance: $${credits.balance} USD | Total Used: $${credits.total_used} USD`);
    } catch (err: any) {
      console.warn('  ⚠ Credit check note:', err.message || err);
    }
  }

  // 3. Test Inference Stream
  console.log('\n--- 3. Testing Inference Streaming ---');
  const customOpenAI = createOpenAI({
    apiKey: apiKey || '',
    baseURL,
    headers: {
      ...(process.env.VERCEL_OIDC_TOKEN ? { 'x-vercel-oidc-token': process.env.VERCEL_OIDC_TOKEN } : {})
    }
  });

  const modelId = process.argv[2] || 'google/gemini-1.5-flash';
  console.log(`Target Model: ${modelId}`);

  try {
    const result = streamText({
      model: customOpenAI(modelId as any),
      prompt: 'Hello from DisplayCellPros Spokane Lab! Confirm connection to AI Gateway with a short 1-sentence technical greeting.',
    });

    process.stdout.write('AI Stream Response: ');
    for await (const textPart of result.textStream) {
      process.stdout.write(textPart);
    }
    console.log('\n\n=== Stream Completed Successfully ===');
  } catch (error: any) {
    console.error('\n[AI Gateway Stream Note]:', error.message || error);
  }
}

main();
