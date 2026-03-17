
import { HttpClient } from '../integracao_locador/utils/http-client';

// Mock fetch global
global.fetch = jest.fn();

describe('HttpClient', () => {
  let client: HttpClient;

  beforeEach(() => {
    client = new HttpClient();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should parse JSON response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ success: true }),
    });

    const result = await client.post('/test', {});
    expect(result).toEqual({ success: true });
  });

  it('should handle plain text response when JSON parse fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/plain' },
      text: async () => 'Confirmado com sucesso',
    });

    const result = await client.post('/test', {});
    expect(result).toBe('Confirmado com sucesso');
  });

  it('should handle empty response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/plain' },
      text: async () => '',
    });

    const result = await client.post('/test', {});
    expect(result).toEqual({});
  });

  it('should throw error on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: { get: () => 'text/plain' },
      text: async () => 'Error details',
      json: async () => ({ error: 'details' }), // safeJson calls json()
    });

    await expect(client.post('/test', {})).rejects.toMatchObject({
      status: 500,
      message: 'Internal Server Error',
    });
  });
});
