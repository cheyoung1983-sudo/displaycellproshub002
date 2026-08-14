import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listGatewayModels,
  getGatewayModelEndpoints,
  getGatewayCredits,
  getGatewayGeneration,
  getGatewaySpendReport,
  AI_GATEWAY_BASE_URL,
} from './aiGatewayClient.ts';

describe('Vercel AI Gateway REST API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lists models correctly via GET /v1/models', async () => {
    const mockResponse = {
      object: 'list',
      data: [
        {
          id: 'google/gemini-3.1-pro-preview',
          object: 'model',
          created: 1755815280,
          owned_by: 'google',
          name: 'Gemini 3.1 Pro Preview',
          context_window: 1000000,
          max_tokens: 64000,
          type: 'language',
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await listGatewayModels();
    expect(globalThis.fetch).toHaveBeenCalledWith('https://ai-gateway.vercel.sh/v1/models', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(result.data[0].id).toBe('google/gemini-3.1-pro-preview');
  });

  it('fetches model endpoints via GET /v1/models/{creator}/{model}/endpoints', async () => {
    const mockResponse = {
      data: {
        id: 'google/gemini-3.1-pro-preview',
        name: 'Gemini 3.1 Pro Preview',
        endpoints: [
          {
            name: 'google | google/gemini-3.1-pro-preview',
            model_name: 'Gemini 3.1 Pro Preview',
            context_length: 1000000,
            provider_name: 'google',
            pricing: { prompt: '0.000002', completion: '0.000012' },
          },
        ],
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await getGatewayModelEndpoints('google', 'gemini-3.1-pro-preview');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://ai-gateway.vercel.sh/v1/models/google/gemini-3.1-pro-preview/endpoints',
      expect.anything()
    );
    expect(result.data.endpoints[0].provider_name).toBe('google');
  });

  it('fetches credits via GET /v1/credits with authorization header', async () => {
    const mockResponse = {
      balance: '95.50',
      total_used: '4.50',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await getGatewayCredits('test-api-key');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://ai-gateway.vercel.sh/v1/credits',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-api-key',
        },
      }
    );
    expect(result.balance).toBe('95.50');
  });

  it('looks up a generation via GET /v1/generation?id=...', async () => {
    const mockResponse = {
      data: {
        id: 'gen_01ARZ3NDEKTSV4RRFFQ69G5FAV',
        total_cost: 0.00123,
        model: 'anthropic/claude-opus-5',
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await getGatewayGeneration('gen_01ARZ3NDEKTSV4RRFFQ69G5FAV', 'key-123');
    expect(result.data.id).toBe('gen_01ARZ3NDEKTSV4RRFFQ69G5FAV');
  });

  it('queries spend report via GET /v1/report', async () => {
    const mockResponse = {
      data: [{ date: '2026-01-01', total_cost: 1.25 }],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await getGatewaySpendReport(
      {
        start_date: '2026-01-01',
        end_date: '2026-01-31',
        group_by: 'model',
      },
      'key-123'
    );
    expect(result.data[0].total_cost).toBe(1.25);
  });
});
