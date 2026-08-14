import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import dotenv from 'dotenv';
import path from 'path';

// Load both .env.local and .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
  console.log('=== Vercel AI Gateway Test Stream ===');
  
  const apiKey =
    process.env.AI_GATEWAY_TOKEN ||
    process.env.VERCEL_OIDC_TOKEN ||
    process.env.OPENAI_API_KEY;

  const baseURL =
    process.env.AI_GATEWAY_URL ||
    process.env.VERCEL_AI_GATEWAY_URL ||
    'https://ai-gateway.vercel.sh/v1';

  console.log('Credentials detected:', apiKey ? '✓ Present' : '✗ Not detected in .env.local');
  console.log('Gateway BaseURL:', baseURL);

  const customOpenAI = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_TOKEN || process.env.VERCEL_OIDC_TOKEN || '',
    baseURL,
    headers: {
      ...(process.env.VERCEL_OIDC_TOKEN ? { 'x-vercel-oidc-token': process.env.VERCEL_OIDC_TOKEN } : {})
    }
  });

  const modelId = process.argv[2] || 'openai/gpt-5.6-sol';
  console.log(`Target Model: ${modelId}`);

  try {
    const result = streamText({
      model: customOpenAI(modelId as any),
      prompt: 'Hello from DisplayCellPros Spokane Lab! Please confirm connection to AI Gateway with a short status greeting.',
    });

    process.stdout.write('AI Stream Response: ');
    for await (const textPart of result.textStream) {
      process.stdout.write(textPart);
    }
    console.log('\n\n=== Stream Completed Successfully ===');
  } catch (error: any) {
    console.error('\n[AI Gateway Response]:', error.message || error);
  }
}

main();
