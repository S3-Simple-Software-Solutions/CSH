import { ApiError } from '../../core/errors';
import { AdminUser } from '../usuarios/usuarios.data';
import { listUsers } from '../usuarios/usuarios.service';
import * as entradas from '../entradas/entradas.service';
import * as parqueo from '../parqueo/parqueo.service';

// Definiciones de tools (function calling) que el agente puede invocar. Cada
// una mapea a un servicio existente (solo lectura). Los resultados devueltos
// son los "logs analizados" que se muestran en la UI.
export const TOOLS = [
  {
    name: 'query_usuarios',
    description:
      'Lista usuarios del club con su perfil y métricas (socios, aficionados, staff). Útil para preguntas sobre personas: gasto acumulado, puntos de fidelidad, partidos asistidos, membresía, datos de contacto y estado de cuenta.',
    input_schema: {
      type: 'object',
      properties: {
        categoria: { type: 'string', enum: ['socio', 'aficionado', 'staff'], description: 'Filtrar por categoría de usuario.' },
        limit: { type: 'integer', description: 'Máximo de filas (1-100).' },
      },
    },
  },
  {
    name: 'query_entradas_log',
    description:
      'Log de actividad de entradas/boletos: compras, cortesías, cambios de estado de eventos. Útil para preguntas sobre ventas, cortesías emitidas, actividad por evento o por operador.',
    input_schema: {
      type: 'object',
      properties: {
        eventoId: { type: 'string', description: 'Filtrar por id de evento (opcional).' },
        limit: { type: 'integer', description: 'Máximo de filas (1-100).' },
      },
    },
  },
  {
    name: 'query_parqueo_eventos',
    description:
      'Eventos del parqueo: entradas, salidas y reservas, por placa o espacio. Útil para preguntas sobre uso del parqueo, placas, horarios y ocupación.',
    input_schema: {
      type: 'object',
      properties: {
        placa: { type: 'string', description: 'Filtrar por placa (opcional).' },
        limit: { type: 'integer', description: 'Máximo de filas (1-100).' },
      },
    },
  },
];

function clampLimit(input: any): number {
  return Math.min(Math.max(Number(input?.limit) || 50, 1), 100);
}

// Ejecuta una tool y devuelve las filas (read-only). El usuario es el admin
// autenticado (super admin), necesario para los servicios que verifican rol.
export async function runTool(name: string, input: any, user: AdminUser): Promise<unknown[]> {
  const limit = clampLimit(input);
  if (name === 'query_usuarios') {
    let rows: any[] = await listUsers();
    if (input?.categoria) rows = rows.filter((u) => u.category === input.categoria);
    return rows.slice(0, limit);
  }
  if (name === 'query_entradas_log') {
    const { eventos } = await entradas.adminLog({ limit, offset: 0, eventoId: input?.eventoId || undefined }, user);
    return eventos;
  }
  if (name === 'query_parqueo_eventos') {
    const placa = String(input?.placa || '').trim().toUpperCase();
    const { eventos } = await parqueo.adminEventos({ limit, offset: 0, plate: placa || undefined });
    return eventos;
  }
  throw new ApiError(400, `Tool desconocida: ${name}`);
}
