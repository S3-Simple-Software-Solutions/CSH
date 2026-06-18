import { env } from '../../config/env';
import { AdminUser } from '../usuarios/usuarios.data';
import { callMessages, ClaudeMessage } from './analytics.client';
import { TOOLS, runTool } from './analytics.tools';

const SYSTEM = [
  'Sos el analista de datos del Club Sport Herediano.',
  'Respondés preguntas sobre personas (usuarios/socios/aficionados), entradas (boletos, cortesías, ventas) y parqueo.',
  'Usá SIEMPRE las herramientas disponibles para fundamentar la respuesta con datos reales; no inventes cifras ni nombres.',
  'Si la pregunta no se puede responder con los datos disponibles, decilo con honestidad.',
  'Respondé en español, de forma concisa y directa, citando los números relevantes.',
].join(' ');

const MAX_TURNS = 4;

export interface AnalyzedLog {
  tool: string;
  input: unknown;
  rows: unknown[];
}

// Corre el loop de tool-use: el modelo pide herramientas, las ejecutamos y le
// devolvemos los resultados hasta que produce la respuesta final en texto.
export async function answerQuery(pregunta: string, user: AdminUser): Promise<{ answer: string; logs: AnalyzedLog[]; model: string }> {
  const messages: ClaudeMessage[] = [{ role: 'user', content: pregunta }];
  const logs: AnalyzedLog[] = [];
  let answer = '';

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const resp = await callMessages({ system: SYSTEM, messages, tools: TOOLS });
    const content: any[] = Array.isArray(resp?.content) ? resp.content : [];

    const text = content.filter((b) => b?.type === 'text').map((b) => b.text).join('\n').trim();
    if (text) answer = text;

    const toolUses = content.filter((b) => b?.type === 'tool_use');
    if (toolUses.length === 0) break;

    messages.push({ role: 'assistant', content });

    const toolResults: any[] = [];
    for (const tu of toolUses) {
      let rows: unknown[];
      try {
        rows = await runTool(tu.name, tu.input, user);
      } catch (err) {
        rows = [{ error: (err as Error).message || String(err) }];
      }
      logs.push({ tool: tu.name, input: tu.input, rows });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify(rows).slice(0, 60000),
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return { answer: answer || 'No pude generar una respuesta con los datos disponibles.', logs, model: env.ANALYTICS_MODEL };
}
