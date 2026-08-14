/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const AI_GATEWAY_BASE_URL = process.env.AI_GATEWAY_URL || 'https://ai-gateway.vercel.sh/v1';

export interface GatewayModelPricing {
  input?: string;
  output?: string;
  input_cache_read?: string;
  input_cache_write?: string;
  image?: string;
  web_search?: string;
  input_tiers?: Array<{ cost: string; min: number; max?: number }>;
  output_tiers?: Array<{ cost: string; min: number; max?: number }>;
}

export interface GatewayModel {
  id: string;
  object: 'model';
  created: number;
  released?: number;
  owned_by: string;
  name: string;
  description?: string;
  context_window?: number;
  max_tokens?: number;
  type?: 'language' | 'embedding' | 'reranking' | 'image' | 'video';
  tags?: string[];
  pricing?: GatewayModelPricing;
}

export interface ListModelsResponse {
  object: 'list';
  data: GatewayModel[];
}

export interface ModelEndpointPricing {
  prompt: string;
  completion: string;
  input_cache_read?: string;
  input_cache_write?: string;
}

export interface ModelEndpoint {
  name: string;
  model_name: string;
  context_length: number;
  pricing: ModelEndpointPricing;
  provider_name: string;
  max_completion_tokens?: number;
  supported_parameters?: string[];
  status?: number;
  uptime_last_15m?: number;
  uptime_last_1h?: number;
  uptime_last_1d?: number;
  throughput_last_1h?: { p50: number; p95: number };
  latency_last_1h?: { p50: number; p95: number };
  supports_implicit_caching?: boolean;
}

export interface ModelEndpointsResponse {
  data: {
    id: string;
    name: string;
    created?: number;
    released?: number;
    description?: string;
    architecture?: {
      tokenizer?: string | null;
      instruct_type?: string | null;
      modality?: string;
      input_modalities?: string[];
      output_modalities?: string[];
    };
    endpoints: ModelEndpoint[];
  };
}

export interface CreditBalanceResponse {
  balance: string;
  total_used: string;
}

export interface GenerationLookupResponse {
  data: {
    id: string;
    total_cost: number;
    upstream_inference_cost: number;
    usage: number;
    created_at: string;
    model: string;
    is_byok: boolean;
    provider_name: string;
    streamed: boolean;
    finish_reason: string;
    latency: number;
    generation_time: number;
    tokens_prompt: number;
    tokens_completion: number;
    native_tokens_prompt?: number;
    native_tokens_completion?: number;
    native_tokens_reasoning?: number;
    native_tokens_cached?: number;
    native_tokens_cache_creation?: number;
    billable_web_search_calls?: number;
  };
}

export interface SpendReportQueryParams {
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  group_by?: 'day' | 'user' | 'model' | 'tag' | 'provider' | 'credential_type' | 'zero_data_retention' | 'api_key_name';
  date_part?: 'day' | 'hour';
  api_key_id?: string;
  user_id?: string;
  model?: string;
  provider?: string;
  credential_type?: 'byok' | 'system';
  zero_data_retention?: boolean;
  tags?: string;
  tags_match?: 'any' | 'all';
}

function getAuthHeader(customKey?: string): HeadersInit {
  const token =
    customKey ||
    process.env.AI_GATEWAY_API_KEY ||
    process.env.AI_GATEWAY_TOKEN ||
    process.env.VERCEL_OIDC_TOKEN ||
    process.env.OPENAI_API_KEY;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * List all available models from Vercel AI Gateway (public endpoint)
 * GET /v1/models
 */
export async function listGatewayModels(baseUrl = AI_GATEWAY_BASE_URL): Promise<ListModelsResponse> {
  const response = await fetch(`${baseUrl}/models`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(errorData?.error?.message || `AI Gateway models request failed (${response.status})`);
  }

  return response.json();
}

/**
 * Get provider endpoints serving a specific model
 * GET /v1/models/{creator}/{model}/endpoints
 */
export async function getGatewayModelEndpoints(
  creator: string,
  model: string,
  baseUrl = AI_GATEWAY_BASE_URL
): Promise<ModelEndpointsResponse> {
  const response = await fetch(`${baseUrl}/models/${encodeURIComponent(creator)}/${encodeURIComponent(model)}/endpoints`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(errorData?.error?.message || `AI Gateway model endpoints request failed (${response.status})`);
  }

  return response.json();
}

/**
 * Check credit balance and lifetime spend
 * GET /v1/credits
 */
export async function getGatewayCredits(
  apiKey?: string,
  baseUrl = AI_GATEWAY_BASE_URL
): Promise<CreditBalanceResponse> {
  const response = await fetch(`${baseUrl}/credits`, {
    method: 'GET',
    headers: getAuthHeader(apiKey),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(errorData?.error?.message || `AI Gateway credits request failed (${response.status})`);
  }

  return response.json();
}

/**
 * Look up a generation by ID
 * GET /v1/generation?id={generation_id}
 */
export async function getGatewayGeneration(
  generationId: string,
  apiKey?: string,
  baseUrl = AI_GATEWAY_BASE_URL
): Promise<GenerationLookupResponse> {
  const url = new URL(`${baseUrl}/generation`);
  url.searchParams.set('id', generationId);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: getAuthHeader(apiKey),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(errorData?.error?.message || `AI Gateway generation lookup failed (${response.status})`);
  }

  return response.json();
}

/**
 * Query spend reports over a date range
 * GET /v1/report
 */
export async function getGatewaySpendReport(
  params: SpendReportQueryParams,
  apiKey?: string,
  baseUrl = AI_GATEWAY_BASE_URL
): Promise<any> {
  const url = new URL(`${baseUrl}/report`);
  url.searchParams.set('start_date', params.start_date);
  url.searchParams.set('end_date', params.end_date);

  if (params.group_by) url.searchParams.set('group_by', params.group_by);
  if (params.date_part) url.searchParams.set('date_part', params.date_part);
  if (params.api_key_id) url.searchParams.set('api_key_id', params.api_key_id);
  if (params.user_id) url.searchParams.set('user_id', params.user_id);
  if (params.model) url.searchParams.set('model', params.model);
  if (params.provider) url.searchParams.set('provider', params.provider);
  if (params.credential_type) url.searchParams.set('credential_type', params.credential_type);
  if (params.zero_data_retention !== undefined) url.searchParams.set('zero_data_retention', String(params.zero_data_retention));
  if (params.tags) url.searchParams.set('tags', params.tags);
  if (params.tags_match) url.searchParams.set('tags_match', params.tags_match);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: getAuthHeader(apiKey),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(errorData?.error?.message || `AI Gateway spend report request failed (${response.status})`);
  }

  return response.json();
}
