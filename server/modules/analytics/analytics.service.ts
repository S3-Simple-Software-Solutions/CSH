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
const LOCAL_MODEL = 'analytics-local';

export interface AnalyzedLog {
  tool: string;
  input: unknown;
  rows: unknown[];
}

type ToolName = 'query_usuarios' | 'query_entradas_log' | 'query_parqueo_eventos';
type Row = Record<string, unknown>;
type ToolRead = { rows: Row[]; error?: string };
type MetricConfig = { key: string; label: string; format: (value: number) => string };

function asRecord(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {};
}

function asRows(value: unknown[]): Row[] {
  return value.map(asRecord);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function hasAny(question: string, words: string[]): boolean {
  return words.some((word) => question.includes(word));
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('es-CR');
}

function formatCrc(value: number): string {
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: unknown): string {
  const raw = text(value);
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat('es-CR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Costa_Rica',
  }).format(date);
}

function metricas(row: Row): Row {
  const profile = asRecord(row.profile);
  return asRecord(profile.metricas);
}

function userName(row: Row): string {
  return text(row.name) || text(row.email) || text(row.username) || text(row.id) || 'Sin nombre';
}

function countBy(rows: Row[], key: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = text(row[key]) || 'sin tipo';
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return counts;
}

function summarizeCounts(counts: Map<string, number>): string {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `${label}: ${count}`)
    .join(', ');
}

function categoryFromQuestion(question: string): 'socio' | 'aficionado' | 'staff' | undefined {
  if (question.includes('socio')) return 'socio';
  if (question.includes('aficionado') || question.includes('fan')) return 'aficionado';
  if (question.includes('staff') || question.includes('colaborador')) return 'staff';
  return undefined;
}

function metricFromQuestion(question: string): MetricConfig {
  if (hasAny(question, ['gasto', 'gastado', 'ingreso', 'ingresos'])) {
    return { key: 'gastoTotalCrc', label: 'gasto total', format: formatCrc };
  }
  if (hasAny(question, ['partido', 'asistido'])) {
    return { key: 'partidosAsistidos', label: 'partidos asistidos', format: formatNumber };
  }
  if (hasAny(question, ['asistencia', 'porcentaje'])) {
    return { key: 'asistenciaPct', label: 'asistencia', format: (value) => `${formatNumber(value)}%` };
  }
  if (hasAny(question, ['entrada', 'comprada', 'compradas'])) {
    return { key: 'entradasCompradas', label: 'entradas compradas', format: formatNumber };
  }
  if (hasAny(question, ['parqueo', 'reserva', 'reservas'])) {
    return { key: 'reservasParqueo', label: 'reservas de parqueo', format: formatNumber };
  }
  return { key: 'puntosFidelidad', label: 'puntos de fidelidad', format: formatNumber };
}

async function readTool(tool: ToolName, input: Row, user: AdminUser, logs: AnalyzedLog[]): Promise<ToolRead> {
  try {
    const rows = await runTool(tool, input, user);
    logs.push({ tool, input, rows });
    return { rows: asRows(rows) };
  } catch (err) {
    const error = (err as Error).message || String(err);
    const rows = [{ error }];
    logs.push({ tool, input, rows });
    return { rows, error };
  }
}

function topUsers(rows: Row[], metric: MetricConfig): Row[] {
  return rows
    .filter((row) => Object.keys(metricas(row)).length > 0)
    .sort((a, b) => num(metricas(b)[metric.key]) - num(metricas(a)[metric.key]));
}

async function answerUsuarios(question: string, user: AdminUser, logs: AnalyzedLog[]): Promise<string> {
  const categoria = categoryFromQuestion(question);
  const metric = metricFromQuestion(question);
  const input: Row = categoria ? { categoria, limit: 100 } : { limit: 100 };
  const read = await readTool('query_usuarios', input, user, logs);
  if (read.error) return `No pude consultar usuarios: ${read.error}`;

  const ranked = topUsers(read.rows, metric);
  if (!ranked.length) return 'No encontré usuarios con métricas suficientes para responder esa pregunta.';

  const top = ranked[0];
  const value = num(metricas(top)[metric.key]);
  const categoryLabel = categoria ? ` de categoría ${categoria}` : '';
  const next = ranked
    .slice(1, 4)
    .map((row) => `${userName(row)} (${metric.format(num(metricas(row)[metric.key]))})`)
    .join(', ');

  return [
    `El usuario${categoryLabel} con más ${metric.label} es ${userName(top)} con ${metric.format(value)}.`,
    next ? `Le siguen: ${next}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function emailFromNotes(row: Row): string {
  const match = text(row.notas).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : '';
}

async function answerEntradas(question: string, user: AdminUser, logs: AnalyzedLog[]): Promise<string> {
  const read = await readTool('query_entradas_log', { limit: 100 }, user, logs);
  if (read.error) return `No pude consultar el log de entradas: ${read.error}`;
  if (!read.rows.length) return 'No encontré movimientos recientes en el log de entradas.';

  if (hasAny(question, ['cortesia', 'cortesias'])) {
    const cortesias = read.rows.filter((row) => normalize(`${text(row.tipo)} ${text(row.notas)}`).includes('cortesia'));
    if (!cortesias.length) return 'No encontré cortesías emitidas en los registros recientes.';
    const recipients = countBy(
      cortesias.map((row) => ({ receptor: emailFromNotes(row) || text(row.userName) || 'sin destinatario' })),
      'receptor',
    );
    return `Se emitieron ${cortesias.length} cortesía${cortesias.length === 1 ? '' : 's'} en los registros recientes. Destinatarios: ${summarizeCounts(recipients)}.`;
  }

  if (hasAny(question, ['venta', 'ventas', 'compra', 'compras', 'ingreso', 'ingresos'])) {
    const compras = read.rows.filter((row) => text(row.tipo) === 'compra');
    const total = compras.reduce((acc, row) => {
      const match = text(row.notas).match(/CRC\s*([0-9]+)/i);
      return acc + (match ? Number(match[1]) : 0);
    }, 0);
    return `Encontré ${compras.length} compra${compras.length === 1 ? '' : 's'} recientes en entradas${total ? ` por ${formatCrc(total)}` : ''}.`;
  }

  const counts = countBy(read.rows, 'tipo');
  const latest = read.rows
    .slice(0, 3)
    .map((row) => `${text(row.tipo)}${text(row.userName) ? ` por ${text(row.userName)}` : ''}${formatDate(row.timestamp) ? ` (${formatDate(row.timestamp)})` : ''}`)
    .join('; ');
  return `El log reciente de entradas tiene ${read.rows.length} movimiento${read.rows.length === 1 ? '' : 's'}: ${summarizeCounts(counts)}.${latest ? ` Últimos: ${latest}.` : ''}`;
}

function parkingTypeFromQuestion(question: string): string | undefined {
  if (hasAny(question, ['salida', 'salieron', 'liberado', 'liberaron'])) return 'salida';
  if (hasAny(question, ['entrada', 'entraron', 'ingreso', 'ingresaron'])) return 'entrada';
  if (hasAny(question, ['reserva', 'reservas', 'reservaron'])) return 'reserva';
  if (hasAny(question, ['pago', 'pagos'])) return 'pago';
  return undefined;
}

async function answerParqueo(question: string, user: AdminUser, logs: AnalyzedLog[]): Promise<string> {
  const eventType = parkingTypeFromQuestion(question);
  const read = await readTool('query_parqueo_eventos', { limit: 100 }, user, logs);
  if (read.error) return `No pude consultar eventos de parqueo: ${read.error}`;
  const rows = eventType ? read.rows.filter((row) => text(row.tipo) === eventType) : read.rows;
  if (!rows.length) return eventType ? `No encontré eventos recientes de tipo ${eventType} en parqueo.` : 'No encontré eventos recientes de parqueo.';

  const plates: string[] = [];
  for (const row of rows) {
    const plate = text(row.placa);
    if (plate && !plates.includes(plate)) plates.push(plate);
  }

  if (eventType === 'entrada') {
    return plates.length
      ? `Las placas que entraron recientemente son: ${plates.slice(0, 12).join(', ')}. Analicé ${rows.length} evento${rows.length === 1 ? '' : 's'} de entrada.`
      : `Encontré ${rows.length} entrada${rows.length === 1 ? '' : 's'} reciente${rows.length === 1 ? '' : 's'}, pero sin placas registradas.`;
  }

  const counts = countBy(rows, 'tipo');
  const latest = rows
    .slice(0, 5)
    .map((row) => `${text(row.placa) || 'sin placa'} · ${text(row.tipo)}${formatDate(row.timestamp) ? ` (${formatDate(row.timestamp)})` : ''}`)
    .join('; ');
  return `El parqueo registra ${rows.length} evento${rows.length === 1 ? '' : 's'} reciente${rows.length === 1 ? '' : 's'}${eventType ? ` de tipo ${eventType}` : ''}: ${summarizeCounts(counts)}.${latest ? ` Últimos: ${latest}.` : ''}`;
}

async function answerOverview(user: AdminUser, logs: AnalyzedLog[]): Promise<string> {
  const [usuarios, entradas, parqueo] = await Promise.all([
    readTool('query_usuarios', { limit: 20 }, user, logs),
    readTool('query_entradas_log', { limit: 20 }, user, logs),
    readTool('query_parqueo_eventos', { limit: 20 }, user, logs),
  ]);

  return [
    `Resumen rápido: ${usuarios.error ? 'usuarios no disponible' : `${usuarios.rows.length} usuarios revisados`}`,
    `${entradas.error ? 'entradas no disponible' : `${entradas.rows.length} movimientos de entradas`}`,
    `${parqueo.error ? 'parqueo no disponible' : `${parqueo.rows.length} eventos de parqueo`}.`,
    'Probá preguntar por puntos de fidelidad, cortesías emitidas o placas recientes para ver un análisis más específico.',
  ].join(', ');
}

async function answerLocally(pregunta: string, user: AdminUser): Promise<{ answer: string; logs: AnalyzedLog[]; model: string }> {
  const question = normalize(pregunta);
  const logs: AnalyzedLog[] = [];

  let answer: string;
  if (hasAny(question, ['parqueo', 'placa', 'placas', 'parking', 'vehiculo', 'vehiculos'])) {
    answer = await answerParqueo(question, user, logs);
  } else if (hasAny(question, ['cortesia', 'cortesias', 'boleto', 'boletos', 'entrada', 'entradas', 'evento', 'eventos', 'venta', 'ventas'])) {
    answer = await answerEntradas(question, user, logs);
  } else if (hasAny(question, ['socio', 'socios', 'usuario', 'usuarios', 'aficionado', 'aficionados', 'staff', 'persona', 'personas', 'fidelidad', 'puntos', 'gasto', 'membresia', 'asistencia'])) {
    answer = await answerUsuarios(question, user, logs);
  } else {
    answer = await answerOverview(user, logs);
  }

  return { answer, logs, model: LOCAL_MODEL };
}

// Corre el loop de tool-use: el modelo pide herramientas, las ejecutamos y le
// devolvemos los resultados hasta que produce la respuesta final en texto.
export async function answerQuery(pregunta: string, user: AdminUser): Promise<{ answer: string; logs: AnalyzedLog[]; model: string }> {
  if (!env.AGENTS_API_KEY) return answerLocally(pregunta, user);

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
