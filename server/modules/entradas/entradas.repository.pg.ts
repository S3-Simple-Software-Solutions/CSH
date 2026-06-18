import type { Pool, PoolClient } from 'pg';
import { pool, query } from '../../core/db';
import { ApiError } from '../../core/errors';
import {
  Boleto,
  CompraInput,
  CompraResultado,
  Evento,
  EventoInput,
  EntradaLog,
  ListLogOptions,
  MapaBatchInput,
  MapaEventoInput,
  MapaTipoInput,
  TicketType,
  TipoInput,
  VentasEvento,
  VentasPorDia,
  ZonaMapa,
} from './entradas.types';
import { EntradasRepository, LogEntradaInput } from './entradas.repository';
import { boletoCodigo, genId, qrData, slugify } from './entradas.helpers';

function toEvento(row: any): Evento {
  return {
    id: row.id,
    slug: row.slug,
    nombre: row.nombre,
    descripcion: row.descripcion,
    venue: row.venue,
    fecha: row.fecha.toISOString(),
    estado: row.estado,
    imagenUrl: row.imagen_url,
    creadoAt: row.creado_at.toISOString(),
    mapImageUrl: row.map_image_url ?? '/brand/estadio.jpg',
    mapVersion: Number(row.map_version ?? 0),
  };
}

function toZona(row: any): ZonaMapa | null {
  if (!row.map_shape || !row.map_points) return null;
  return {
    shape: row.map_shape,
    points: row.map_points,
    color: row.map_color ?? '#c9a961',
    labelX: row.map_label_x ?? null,
    labelY: row.map_label_y ?? null,
  };
}

function toTipo(row: any): TicketType {
  const total = Number(row.stock_total);
  const vendido = Number(row.stock_vendido);
  return {
    id: row.id,
    eventoId: row.evento_id,
    nombre: row.nombre,
    precioCrc: Number(row.precio_crc),
    stockTotal: total,
    stockVendido: vendido,
    estado: row.estado,
    orden: Number(row.orden),
    disponibles: Math.max(0, total - vendido),
    mapa: toZona(row),
  };
}

function toBoleto(row: any): Boleto {
  return {
    id: row.id,
    ordenId: row.orden_id,
    tipoId: row.tipo_id,
    eventoId: row.evento_id,
    codigo: row.codigo,
    qrData: row.qr_data,
    estado: row.estado,
    validadoAt: row.validado_at ? row.validado_at.toISOString() : null,
    validadoPor: row.validado_por || null,
    tipoNombre: row.tipo_nombre,
    eventoNombre: row.evento_nombre,
  };
}

async function logEvento(client: Pool | PoolClient, tipo: string, { eventoId, boletoId, user, notas }: LogEntradaInput): Promise<void> {
  await client.query(
    'insert into entrada_log (tipo, evento_id, boleto_id, user_id, user_name, notas) values ($1,$2,$3,$4,$5,$6)',
    [tipo, eventoId || null, boletoId || null, user ? user.id : null, user ? user.name : '', notas || ''],
  );
}

async function loadTipos(eventoId: string): Promise<TicketType[]> {
  return (await query<any>('select * from entrada_tipos where evento_id = $1 order by orden, nombre', [eventoId])).map(toTipo);
}

export class PgEntradasRepository implements EntradasRepository {
  async publicEventos(): Promise<Evento[]> {
    return (await query<any>("select * from entrada_eventos where estado = 'publicado' order by fecha asc")).map(toEvento);
  }

  async publicEventoBySlug(slug: string): Promise<{ evento: Evento; tipos: TicketType[] } | null> {
    const rows = await query<any>("select * from entrada_eventos where slug = $1 and estado = 'publicado'", [slug]);
    if (!rows[0]) return null;
    const evento = toEvento(rows[0]);
    const tipos = (await loadTipos(evento.id)).filter((t) => t.estado === 'activo');
    return { evento, tipos };
  }

  async comprar({ slug, lineas, comprador, pago }: CompraInput): Promise<CompraResultado> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const evRows = await client.query('select * from entrada_eventos where slug = $1 for update', [slug]);
      const evRow = evRows.rows[0];
      if (!evRow) {
        await client.query('rollback');
        throw new ApiError(404, 'Evento no encontrado');
      }
      if (evRow.estado !== 'publicado') {
        await client.query('rollback');
        throw new ApiError(409, 'El evento no esta disponible para compra');
      }
      let total = 0;
      const aCrear: { tipoId: string; tipoNombre: string }[] = [];
      for (const linea of lineas) {
        const cantidad = Number(linea.cantidad);
        const tipoRows = await client.query('select * from entrada_tipos where id = $1 and evento_id = $2 for update', [linea.tipoId, evRow.id]);
        const tipo = tipoRows.rows[0];
        if (!tipo) {
          await client.query('rollback');
          throw new ApiError(404, 'Tipo de entrada no encontrado');
        }
        if (tipo.estado !== 'activo') {
          await client.query('rollback');
          throw new ApiError(409, `${tipo.nombre} no esta a la venta`);
        }
        const upd = await client.query(
          'update entrada_tipos set stock_vendido = stock_vendido + $1 where id = $2 and stock_vendido + $1 <= stock_total returning *',
          [cantidad, tipo.id],
        );
        if (!upd.rows[0]) {
          await client.query('rollback');
          throw new ApiError(409, `Sin disponibilidad suficiente para ${tipo.nombre}`);
        }
        total += Number(tipo.precio_crc) * cantidad;
        for (let i = 0; i < cantidad; i++) aCrear.push({ tipoId: tipo.id, tipoNombre: tipo.nombre });
      }
      const ordenId = genId('ORD');
      await client.query(
        'insert into entrada_ordenes (id, evento_id, comprador_nombre, comprador_email, total_crc, pago, estado) values ($1,$2,$3,$4,$5,$6,$7)',
        [ordenId, evRow.id, comprador.nombre, comprador.email, total, pago ? JSON.stringify(pago) : null, 'pagada'],
      );
      const boletos: Boleto[] = [];
      for (const b of aCrear) {
        const id = genId('BOL');
        const codigo = boletoCodigo();
        const qr = qrData(codigo, evRow.id, b.tipoId, comprador.email);
        await client.query(
          'insert into entrada_boletos (id, orden_id, tipo_id, evento_id, codigo, qr_data, estado) values ($1,$2,$3,$4,$5,$6,$7)',
          [id, ordenId, b.tipoId, evRow.id, codigo, qr, 'valido'],
        );
        boletos.push({ id, ordenId, tipoId: b.tipoId, eventoId: evRow.id, codigo, qrData: qr, estado: 'valido', validadoAt: null, validadoPor: null, tipoNombre: b.tipoNombre, eventoNombre: evRow.nombre });
      }
      await logEvento(client, 'compra', { eventoId: evRow.id, user: { id: null, name: comprador.nombre }, notas: `${boletos.length} boleto(s), CRC ${total}, ${comprador.email}` });
      await this.autoAgotar(client, evRow.id);
      await client.query('commit');
      const orden = {
        id: ordenId,
        eventoId: evRow.id,
        compradorNombre: comprador.nombre,
        compradorEmail: comprador.email,
        totalCrc: total,
        pago: null,
        estado: 'pagada' as const,
        createdAt: new Date().toISOString(),
      };
      return { orden, boletos, evento: toEvento(evRow) };
    } catch (err) {
      try {
        await client.query('rollback');
      } catch {
        /* noop */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  // Marca el evento como agotado cuando no queda stock activo.
  private async autoAgotar(client: Pool | PoolClient, eventoId: string): Promise<void> {
    const left = await client.query(
      "select coalesce(sum(stock_total - stock_vendido), 0)::int as left from entrada_tipos where evento_id = $1 and estado = 'activo'",
      [eventoId],
    );
    if (Number(left.rows[0].left) <= 0) {
      await client.query("update entrada_eventos set estado = 'agotado' where id = $1 and estado = 'publicado'", [eventoId]);
    }
  }

  async getBoletoByCodigo(codigo: string): Promise<Boleto | null> {
    const rows = await query<any>(
      `select b.*, t.nombre as tipo_nombre, e.nombre as evento_nombre
       from entrada_boletos b
       join entrada_tipos t on t.id = b.tipo_id
       join entrada_eventos e on e.id = b.evento_id
       where b.codigo = $1`,
      [codigo],
    );
    return rows[0] ? toBoleto(rows[0]) : null;
  }

  async getOrdenBoletos(ordenId: string): Promise<Boleto[]> {
    const rows = await query<any>(
      `select b.*, t.nombre as tipo_nombre, e.nombre as evento_nombre
       from entrada_boletos b
       join entrada_tipos t on t.id = b.tipo_id
       join entrada_eventos e on e.id = b.evento_id
       where b.orden_id = $1 order by b.codigo`,
      [ordenId],
    );
    return rows.map(toBoleto);
  }

  async getOrden(ordenId: string): Promise<{ id: string; eventoId: string; compradorEmail: string; compradorNombre: string } | null> {
    const rows = await query<any>('select * from entrada_ordenes where id = $1', [ordenId]);
    if (!rows[0]) return null;
    return { id: rows[0].id, eventoId: rows[0].evento_id, compradorEmail: rows[0].comprador_email, compradorNombre: rows[0].comprador_nombre };
  }

  async adminListEventos(): Promise<VentasEvento[]> {
    const eventos = (await query<any>('select * from entrada_eventos order by fecha asc')).map(toEvento);
    const out: VentasEvento[] = [];
    for (const evento of eventos) {
      const v = await this.ventasEvento(evento.id);
      if (v) out.push(v);
    }
    return out;
  }

  async adminGetEvento(id: string): Promise<{ evento: Evento; tipos: TicketType[] } | null> {
    const rows = await query<any>('select * from entrada_eventos where id = $1', [id]);
    if (!rows[0]) return null;
    return { evento: toEvento(rows[0]), tipos: await loadTipos(id) };
  }

  async crearEvento(input: EventoInput): Promise<Evento> {
    const id = genId('EV');
    let slug = slugify(input.nombre) || id.toLowerCase();
    const exists = await query<any>('select 1 from entrada_eventos where slug = $1', [slug]);
    if (exists[0]) slug = `${slug}-${id.slice(-4).toLowerCase()}`;
    const rows = await query<any>(
      'insert into entrada_eventos (id, slug, nombre, descripcion, venue, fecha, estado, imagen_url) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *',
      [id, slug, input.nombre, input.descripcion || '', input.venue || '', new Date(input.fecha), 'borrador', input.imagenUrl || ''],
    );
    return toEvento(rows[0]);
  }

  async actualizarEvento(id: string, input: Partial<EventoInput>): Promise<Evento> {
    const current = await query<any>('select * from entrada_eventos where id = $1', [id]);
    if (!current[0]) throw new ApiError(404, 'Evento no encontrado');
    const c = current[0];
    const fecha = input.fecha ? new Date(input.fecha) : c.fecha;
    const rows = await query<any>(
      'update entrada_eventos set nombre=$1, descripcion=$2, venue=$3, fecha=$4, imagen_url=$5 where id=$6 returning *',
      [
        input.nombre ?? c.nombre,
        input.descripcion ?? c.descripcion,
        input.venue ?? c.venue,
        fecha,
        input.imagenUrl ?? c.imagen_url,
        id,
      ],
    );
    return toEvento(rows[0]);
  }

  async setEstadoEvento(id: string, estado: string): Promise<Evento> {
    const valid = ['borrador', 'publicado', 'agotado', 'finalizado'];
    if (!valid.includes(estado)) throw new ApiError(400, 'Estado invalido');
    const rows = await query<any>('update entrada_eventos set estado=$1 where id=$2 returning *', [estado, id]);
    if (!rows[0]) throw new ApiError(404, 'Evento no encontrado');
    return toEvento(rows[0]);
  }

  async crearTipo(eventoId: string, input: TipoInput): Promise<TicketType> {
    const ev = await query<any>('select 1 from entrada_eventos where id = $1', [eventoId]);
    if (!ev[0]) throw new ApiError(404, 'Evento no encontrado');
    const ordRow = await query<any>('select coalesce(max(orden), -1) + 1 as next from entrada_tipos where evento_id = $1', [eventoId]);
    const rows = await query<any>(
      'insert into entrada_tipos (id, evento_id, nombre, precio_crc, stock_total, stock_vendido, estado, orden) values ($1,$2,$3,$4,$5,0,$6,$7) returning *',
      [genId('TT'), eventoId, input.nombre, input.precioCrc, input.stockTotal, input.estado || 'activo', input.orden ?? Number(ordRow[0].next)],
    );
    return toTipo(rows[0]);
  }

  async actualizarTipo(id: string, input: Partial<TipoInput>): Promise<TicketType> {
    const current = await query<any>('select * from entrada_tipos where id = $1', [id]);
    if (!current[0]) throw new ApiError(404, 'Tipo de entrada no encontrado');
    const c = current[0];
    const nuevoTotal = input.stockTotal ?? Number(c.stock_total);
    if (nuevoTotal < Number(c.stock_vendido)) throw new ApiError(409, 'El stock total no puede ser menor a lo ya vendido');
    const rows = await query<any>(
      'update entrada_tipos set nombre=$1, precio_crc=$2, stock_total=$3, estado=$4, orden=$5 where id=$6 returning *',
      [input.nombre ?? c.nombre, input.precioCrc ?? Number(c.precio_crc), nuevoTotal, input.estado ?? c.estado, input.orden ?? Number(c.orden), id],
    );
    return toTipo(rows[0]);
  }

  async ventasEvento(eventoId: string): Promise<VentasEvento | null> {
    const rows = await query<any>('select * from entrada_eventos where id = $1', [eventoId]);
    if (!rows[0]) return null;
    const tipos = await loadTipos(eventoId);
    const agg = await query<any>(
      `select
         count(*) filter (where estado <> 'cancelado')::int as vendidos,
         count(*) filter (where estado = 'usado')::int as usados
       from entrada_boletos where evento_id = $1`,
      [eventoId],
    );
    const ingresos = await query<any>(
      "select coalesce(sum(total_crc), 0)::int as total from entrada_ordenes where evento_id = $1 and estado = 'pagada'",
      [eventoId],
    );
    return {
      evento: toEvento(rows[0]),
      tipos,
      boletosVendidos: Number(agg[0].vendidos),
      boletosUsados: Number(agg[0].usados),
      ingresosCrc: Number(ingresos[0].total),
    };
  }

  async ventasPorDiaEvento(eventoId: string): Promise<VentasPorDia[]> {
    const TZ = 'America/Costa_Rica';
    const ingDia = await query<any>(
      `select to_char(created_at at time zone $2, 'YYYY-MM-DD') as fecha,
              count(*)::int as ordenes,
              coalesce(sum(total_crc),0)::int as ingresos
       from entrada_ordenes where evento_id = $1 and estado='pagada'
       group by 1 order by 1`,
      [eventoId, TZ],
    );
    const bolDia = await query<any>(
      `select to_char(o.created_at at time zone $2, 'YYYY-MM-DD') as fecha,
              count(b.id) filter (where b.estado <> 'cancelado')::int as boletos
       from entrada_ordenes o join entrada_boletos b on b.orden_id = o.id
       where o.evento_id = $1 and o.estado='pagada'
       group by 1`,
      [eventoId, TZ],
    );
    const boletosByFecha = new Map<string, number>(bolDia.map((r: any) => [r.fecha, Number(r.boletos)]));
    return ingDia.map((r: any) => ({
      fecha: r.fecha,
      ordenes: Number(r.ordenes),
      ingresos: Number(r.ingresos),
      boletos: boletosByFecha.get(r.fecha) ?? 0,
    }));
  }

  async validarBoleto(codigo: string, actor: { id: string; name: string }): Promise<Boleto> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const rows = await client.query('select * from entrada_boletos where codigo = $1 for update', [codigo]);
      const row = rows.rows[0];
      if (!row) {
        await client.query('rollback');
        throw new ApiError(404, 'Boleto no encontrado');
      }
      if (row.estado === 'cancelado') {
        await client.query('rollback');
        throw new ApiError(409, 'El boleto fue cancelado');
      }
      if (row.estado === 'usado') {
        const cuando = row.validado_at ? row.validado_at.toISOString() : '';
        await client.query('rollback');
        throw new ApiError(409, `El boleto ya ingreso${cuando ? ` (${new Date(cuando).toLocaleString('es-CR')})` : ''}`);
      }
      const upd = await client.query(
        "update entrada_boletos set estado = 'usado', validado_at = now(), validado_por = $1 where codigo = $2 returning *",
        [actor.name, codigo],
      );
      await logEvento(client, 'validacion', { eventoId: row.evento_id, boletoId: row.id, user: actor, notas: `Ingreso ${codigo}` });
      await client.query('commit');
      return await this.decorateBoleto(upd.rows[0]);
    } catch (err) {
      try {
        await client.query('rollback');
      } catch {
        /* noop */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  private async decorateBoleto(row: any): Promise<Boleto> {
    const meta = await query<any>(
      'select t.nombre as tipo_nombre, e.nombre as evento_nombre from entrada_tipos t join entrada_eventos e on e.id = $1 where t.id = $2',
      [row.evento_id, row.tipo_id],
    );
    return toBoleto({ ...row, tipo_nombre: meta[0]?.tipo_nombre, evento_nombre: meta[0]?.evento_nombre });
  }

  async emitirCortesia(eventoId: string, tipoId: string, comprador: { nombre: string; email: string }, actor: { id: string; name: string }): Promise<CompraResultado> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const evRows = await client.query('select * from entrada_eventos where id = $1 for update', [eventoId]);
      const evRow = evRows.rows[0];
      if (!evRow) {
        await client.query('rollback');
        throw new ApiError(404, 'Evento no encontrado');
      }
      const tipoRows = await client.query('select * from entrada_tipos where id = $1 and evento_id = $2 for update', [tipoId, eventoId]);
      const tipo = tipoRows.rows[0];
      if (!tipo) {
        await client.query('rollback');
        throw new ApiError(404, 'Tipo de entrada no encontrado');
      }
      const upd = await client.query(
        'update entrada_tipos set stock_vendido = stock_vendido + 1 where id = $1 and stock_vendido + 1 <= stock_total returning *',
        [tipo.id],
      );
      if (!upd.rows[0]) {
        await client.query('rollback');
        throw new ApiError(409, `Sin disponibilidad para ${tipo.nombre}`);
      }
      const ordenId = genId('ORD');
      await client.query(
        'insert into entrada_ordenes (id, evento_id, comprador_nombre, comprador_email, total_crc, pago, estado) values ($1,$2,$3,$4,0,$5,$6)',
        [ordenId, eventoId, comprador.nombre, comprador.email, JSON.stringify({ cortesia: true, emitidoPor: actor.name }), 'pagada'],
      );
      const id = genId('BOL');
      const codigo = boletoCodigo();
      const qr = qrData(codigo, eventoId, tipo.id, comprador.email);
      await client.query(
        'insert into entrada_boletos (id, orden_id, tipo_id, evento_id, codigo, qr_data, estado) values ($1,$2,$3,$4,$5,$6,$7)',
        [id, ordenId, tipo.id, eventoId, codigo, qr, 'valido'],
      );
      await logEvento(client, 'cortesia', { eventoId, boletoId: id, user: actor, notas: `Cortesia ${tipo.nombre} a ${comprador.email}` });
      await client.query('commit');
      const boleto: Boleto = { id, ordenId, tipoId: tipo.id, eventoId, codigo, qrData: qr, estado: 'valido', validadoAt: null, validadoPor: null, tipoNombre: tipo.nombre, eventoNombre: evRow.nombre };
      const orden = { id: ordenId, eventoId, compradorNombre: comprador.nombre, compradorEmail: comprador.email, totalCrc: 0, pago: null, estado: 'pagada' as const, createdAt: new Date().toISOString() };
      return { orden, boletos: [boleto], evento: toEvento(evRow) };
    } catch (err) {
      try {
        await client.query('rollback');
      } catch {
        /* noop */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async listLog({ limit, offset, eventoId }: ListLogOptions): Promise<{ total: number; eventos: EntradaLog[] }> {
    const where = eventoId ? 'where evento_id = $1' : '';
    const params = eventoId ? [eventoId, limit, offset] : [limit, offset];
    const countParams = eventoId ? [eventoId] : [];
    const total = Number((await query<any>(`select count(*)::int as total from entrada_log ${where}`, countParams))[0].total);
    const rows = await query<any>(
      `select * from entrada_log ${where} order by created_at desc limit $${eventoId ? 2 : 1} offset $${eventoId ? 3 : 2}`,
      params,
    );
    const eventos: EntradaLog[] = rows.map((e) => ({
      id: e.id,
      tipo: e.tipo,
      eventoId: e.evento_id,
      boletoId: e.boleto_id,
      userId: e.user_id,
      userName: e.user_name,
      notas: e.notas,
      timestamp: e.created_at.toISOString(),
    }));
    return { total, eventos };
  }

  async logEvento(tipo: string, input: LogEntradaInput): Promise<void> {
    await logEvento(pool, tipo, input);
  }

  // ── Mapa de zonas ────────────────────────────────────────────────

  async getMapaEvento(eventoId: string): Promise<{ evento: Evento; tipos: TicketType[] } | null> {
    const rows = await query<any>('select * from entrada_eventos where id = $1', [eventoId]);
    if (!rows[0]) return null;
    const tipos = await query<any>('select * from entrada_tipos where evento_id = $1 order by orden, nombre', [eventoId]);
    return { evento: toEvento(rows[0]), tipos: tipos.map(toTipo) };
  }

  async actualizarMapaEvento(eventoId: string, input: MapaEventoInput): Promise<Evento> {
    const rows = await query<any>(
      'update entrada_eventos set map_image_url = coalesce($1, map_image_url), map_version = map_version + 1 where id = $2 returning *',
      [input.mapImageUrl ?? null, eventoId],
    );
    if (!rows[0]) throw new Error('Evento no encontrado');
    return toEvento(rows[0]);
  }

  async actualizarMapaTipo(tipoId: string, input: MapaTipoInput | null): Promise<TicketType> {
    let rows: any[];
    if (input === null) {
      rows = await query<any>(
        'update entrada_tipos set map_shape = null, map_points = null, map_color = null, map_label_x = null, map_label_y = null where id = $1 returning *',
        [tipoId],
      );
    } else {
      rows = await query<any>(
        'update entrada_tipos set map_shape = $1, map_points = $2, map_color = $3, map_label_x = $4, map_label_y = $5 where id = $6 returning *',
        [input.shape, JSON.stringify(input.points), input.color ?? '#c9a961', input.labelX ?? null, input.labelY ?? null, tipoId],
      );
    }
    if (!rows[0]) throw new Error('Sector no encontrado');
    return toTipo(rows[0]);
  }

  async guardarMapaBatch(eventoId: string, input: MapaBatchInput): Promise<TicketType[]> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const result: TicketType[] = [];
      for (const item of input.tipos) {
        let rows: any[];
        if (item.mapa === null) {
          rows = (await client.query(
            'update entrada_tipos set map_shape = null, map_points = null, map_color = null, map_label_x = null, map_label_y = null where id = $1 and evento_id = $2 returning *',
            [item.tipoId, eventoId],
          )).rows;
        } else {
          rows = (await client.query(
            'update entrada_tipos set map_shape = $1, map_points = $2, map_color = $3, map_label_x = $4, map_label_y = $5 where id = $6 and evento_id = $7 returning *',
            [item.mapa.shape, JSON.stringify(item.mapa.points), item.mapa.color ?? '#c9a961', item.mapa.labelX ?? null, item.mapa.labelY ?? null, item.tipoId, eventoId],
          )).rows;
        }
        if (rows[0]) result.push(toTipo(rows[0]));
      }
      await client.query('commit');
      return result;
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }
}
