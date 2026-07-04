// Templates de evento: serializar la configuración de un evento existente y
// aplicarla a un evento recién creado.
//
// La aplicación es tolerante (CA4): cada pieza se intenta por separado y los
// fallos se acumulan como advertencias en vez de abortar todo — un template
// parcialmente aplicado sigue siendo un evento válido que el admin puede
// terminar a mano desde el wizard o el detalle.

import { ApiError } from '../../core/errors';
import { getEntradasRepository } from './entradas.repository';
import { diasAntesToFecha, fechaToDiasAntes } from './entradas.helpers';
import {
  AplicarTemplateResultado,
  EventTemplatePayload,
  TemplateSectorPayload,
} from './entradas.types';

export async function serializeEvento(eventoId: string): Promise<EventTemplatePayload> {
  const repo = getEntradasRepository();
  const data = await repo.adminGetEvento(eventoId);
  if (!data) throw new ApiError(404, 'Evento no encontrado');
  const { evento, tipos } = data;

  const sectores: TemplateSectorPayload[] = [];
  for (const t of tipos) {
    const tandas = await repo.listTandas(t.id);
    sectores.push({
      nombre: t.nombre,
      precioCrc: t.precioCrc,
      stockTotal: t.stockTotal,
      estado: t.estado,
      orden: t.orden,
      mapa: t.mapa,
      numerado: false,
      filas: null,
      porFila: null,
      bloqueadas: [],
      tandas: tandas.map((td) => ({
        nombre: td.nombre,
        precioCrc: td.precioCrc,
        cupo: td.cupo,
        orden: td.orden,
        ventaDesdeDias: fechaToDiasAntes(evento.fecha, td.ventaDesde),
        ventaHastaDias: fechaToDiasAntes(evento.fecha, td.ventaHasta),
      })),
    });
  }

  return {
    v: 1,
    formato: evento.formato,
    venue: evento.venue,
    imagenUrl: evento.imagenUrl,
    mapImageUrl: evento.mapImageUrl,
    fieldTemplate: evento.fieldTemplate,
    fieldSplits: evento.fieldSplits,
    feeTipo: evento.feeTipo,
    feeValor: evento.feeValor,
    sectores,
  };
}

export function validatePayload(payload: any): EventTemplatePayload {
  if (!payload || payload.v !== 1) throw new ApiError(400, 'Payload de template inválido (se espera v:1)');
  if (!Array.isArray(payload.sectores)) throw new ApiError(400, 'El template no tiene sectores');
  return payload as EventTemplatePayload;
}

export async function aplicarTemplate(eventoId: string, templateId: string): Promise<AplicarTemplateResultado> {
  const repo = getEntradasRepository();
  const data = await repo.adminGetEvento(eventoId);
  if (!data) throw new ApiError(404, 'Evento no encontrado');
  const tpl = await repo.getTemplate(templateId);
  if (!tpl) throw new ApiError(404, 'Template no encontrado');
  const p = validatePayload(tpl.payload);

  const advertencias: string[] = [];
  let sectoresOk = 0;
  let tandasOk = 0;

  // Fee y plantilla de campo/mapa del evento.
  try {
    await repo.actualizarEvento(eventoId, { feeTipo: p.feeTipo, feeValor: p.feeValor });
  } catch (err) {
    advertencias.push(`Fee: ${(err as Error).message}`);
  }
  try {
    await repo.actualizarMapaEvento(eventoId, {
      mapImageUrl: p.mapImageUrl || undefined,
      fieldTemplate: p.fieldTemplate,
      fieldSplits: p.fieldSplits,
    });
  } catch (err) {
    advertencias.push(`Mapa del evento: ${(err as Error).message}`);
  }

  const existentes = new Set(data.tipos.map((t) => t.nombre.toLowerCase()));
  for (const s of p.sectores) {
    if (existentes.has(String(s.nombre || '').toLowerCase())) {
      advertencias.push(`Sector "${s.nombre}" ya existe en el evento; omitido`);
      continue;
    }
    let tipoId: string;
    try {
      const tipo = await repo.crearTipo(eventoId, {
        nombre: s.nombre,
        precioCrc: s.precioCrc,
        stockTotal: s.stockTotal,
        estado: s.estado ?? 'activo',
        orden: s.orden,
      });
      tipoId = tipo.id;
      sectoresOk++;
    } catch (err) {
      advertencias.push(`Sector "${s.nombre}": ${(err as Error).message}`);
      continue;
    }
    if (s.mapa) {
      try {
        await repo.actualizarMapaTipo(tipoId, s.mapa);
      } catch (err) {
        advertencias.push(`Zona de mapa de "${s.nombre}": ${(err as Error).message}`);
      }
    }
    for (const td of s.tandas ?? []) {
      try {
        await repo.crearTanda(tipoId, {
          nombre: td.nombre,
          precioCrc: td.precioCrc,
          cupo: td.cupo,
          orden: td.orden,
          ventaDesde: diasAntesToFecha(data.evento.fecha, td.ventaDesdeDias),
          ventaHasta: diasAntesToFecha(data.evento.fecha, td.ventaHastaDias),
        });
        tandasOk++;
      } catch (err) {
        advertencias.push(`Tanda "${td.nombre}" de "${s.nombre}": ${(err as Error).message}`);
      }
    }
  }

  return { sectores: sectoresOk, butacas: 0, tandas: tandasOk, advertencias };
}
