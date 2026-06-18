import { env } from '../../config/env';
import { ApiError } from '../../core/errors';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: unknown;
}

// Llama a la Messages API de Anthropic a través del proxy api_agents del
// workspace. El proxy identifica el proyecto por el header x-api-key y reenvía
// con la clave upstream real.
export async function callMessages(params: {
  system: string;
  messages: ClaudeMessage[];
  tools?: unknown[];
  maxTokens?: number;
}): Promise<any> {
  if (!env.AGENTS_API_KEY) {
    throw new ApiError(503, 'Analytics no está configurado (falta AGENTS_API_KEY).');
  }
  let res: Response;
  try {
    res = await fetch(new URL('/v1/messages', env.AGENTS_BASE_URL), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.AGENTS_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.ANALYTICS_MODEL,
        max_tokens: params.maxTokens ?? 1024,
        system: params.system,
        messages: params.messages,
        tools: params.tools,
      }),
    });
  } catch (err) {
    throw new ApiError(502, `No se pudo contactar al agente: ${(err as Error).message}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(502, `Error del agente (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json();
}
