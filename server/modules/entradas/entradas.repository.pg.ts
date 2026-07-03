import type { Pool, PoolClient } from 'pg';
import { pool, query } from '../../core/db';
import { ApiError } from '../../core/errors';
import {
  Asiento,
  AsientoPublico,
  Boleto,
  CompraInput,
  CompraResultado,
  Descuento,
  DescuentoInput,
  EntradaConfig,
  EntradaConfigInput,
  Evento,
  EventoInput,
  EntradaLog,
  FeeTipo,
  GenerarAsientosInput,
  ListLogOptions,
  MapaBatchInput,
  MapaEventoInput,
  MapaTipoInput,
  Promotor,
  PromotorInput,
  PromotorRanking,
  ReservaAsientos,
  Tanda,
  TandaInput,
  TicketType,
  TipoInput,
  VentasEvento,
  VentasPorDia,
  ZonaMapa,
} from './entradas.types';
import { EntradasRepository, LogEntradaInput } from './entradas.repository';
import {
  asientoLabel,
  boletoCodigo,
  calcularTotales,
  DescuentoAplicado,
  FeeConfig,
  filaLabel,
  genId,
  normalizeCodigo,
  qrData,
  slugify,
  tandaActiva,
} from './entradas.helpers';

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
    formato: (row.formato ?? 'partido') as 'partido' | 'espectaculo',
    fieldTemplate: row.field_template ?? null,
    fieldSplits: row.field_splits ?? null,
    feeTipo: (row.fee_tipo ?? null) as FeeTipo | null,
    feeValor: row.fee_valor == null ? null : Number(row.fee_valor),
  };
}

function toTanda(row: any): Tanda {
  return {
    id: row.id,
    tipoId: row.tipo_id,
    nombre: row.nombre,
    precioCrc: Number(row.precio_crc),
    ventaDesde: row.venta_desde ? row.venta_desde.toISOString() : null,
    ventaHasta: row.venta_hasta ? row.venta_hasta.toISOString() : null,
    cupo: row.cupo == null ? null : Number(row.cupo),
    vendidos: Number(row.vendidos),
    orden: Number(row.orden),
  };
}

function toPromotor(row: any): Promotor {
  return {
    id: row.id,
    nombre: row.nombre,
    codigo: row.codigo,
    comisionTipo: row.comision_tipo,
    comisionValor: Number(row.comision_valor),
    activo: row.activo,
    creadoAt: row.creado_at ? row.creado_at.toISOString() : new Date().toISOString(),
  };
}

// Atribución RRPP: resuelve el promotor del ?ref= y calcula su comisión sobre el
// subtotal. Un código inválido o inactivo no bloquea la compra (sin atribución).
async function resolvePromotor(
  client: Pool | PoolClient,
  refCodigo: string | null | undefined,
  subtotal: number,
): Promise<{ id: string; comision: number } | null> {
  const norm = normalizeCodigo(refCodigo);
  if (!norm) return null;
  const res = await client.query('select * from entrada_promotores where codigo = $1 and activo = true', [norm]);
  const p = res.rows[0];
  if (!p) return null;
  const comision = p.comision_tipo === 'pct'
    ? Math.round((subtotal * Number(p.comision_valor)) / 100)
    : Number(p.comision_valor);
  return { id: p.id, comision: Math.max(0, comision) };
}

function toDescuento(row: any): Descuento {
  return {
    id: row.id,
    codigo: row.codigo,
    tipo: row.tipo,
    valor: Number(row.valor),
    eventoId: row.evento_id ?? null,
    usosMax: row.usos_max == null ? null : Number(row.usos_max),
    usosActuales: Number(row.usos_actuales),
    vigenciaDesde: row.vigencia_desde ? row.vigencia_desde.toISOString() : null,
    vigenciaHasta: row.vigencia_hasta ? row.vigencia_hasta.toISOString() : null,
    activo: row.activo,
    creadoAt: row.creado_at ? row.creado_at.toISOString() : new Date().toISOString(),
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
    numerado: Boolean(row.numerado),
  };
}

function toAsiento(row: any): Asiento {
  return {
    id: row.id,
    eventoId: row.evento_id,
    tipoId: row.tipo_id,
    fila: row.fila,
    numero: Number(row.numero),
    x: row.x == null ? null : Number(row.x),
    y: row.y == null ? null : Number(row.y),
    estado: row.estado,
    reservadoHasta: row.reservado_hasta ? row.reservado_hasta.toISOString() : null,
    boletoId: row.boleto_id ?? null,
    ordenId: row.orden_id ?? null,
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
    asientoId: row.asiento_id ?? null,
    asientoLabel: row.asiento_fila ? asientoLabel(row.asiento_fila, Number(row.asiento_numero)) : null,
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

// Decora los tipos con el precio de la tanda vigente (preventa). Sin tanda activa,
// precioVigente = precioCrc base.
async function decorarPrecios(tipos: TicketType[]): Promise<TicketType[]> {
  if (tipos.length === 0) return tipos;
  const rows = await query<any>(
    'select * from entrada_tipo_tandas where tipo_id = any($1) order by orden',
    [tipos.map((t) => t.id)],
  );
  const byTipo = new Map<string, Tanda[]>();
  for (const r of rows) {
    const t = toTanda(r);
    if (!byTipo.has(t.tipoId)) byTipo.set(t.tipoId, []);
    byTipo.get(t.tipoId)!.push(t);
  }
  return tipos.map((t) => {
    const activa = tandaActiva(byTipo.get(t.id) ?? []);
    return { ...t, precioVigente: activa ? activa.precioCrc : t.precioCrc, tandaNombre: activa?.nombre ?? null };
  });
}

// Consume cupo de la tanda vigente dentro de la transacción de compra. Si la tanda
// activa no puede cubrir toda la cantidad, prueba la siguiente; sin tanda aplicable
// devuelve null y el tipo vende a precio base.
async function consumirTanda(
  client: Pool | PoolClient,
  tipoId: string,
  cantidad: number,
): Promise<{ precio: number; nombre: string } | null> {
  const res = await client.query('select * from entrada_tipo_tandas where tipo_id = $1 order by orden for update', [tipoId]);
  if (res.rows.length === 0) return null;
  const now = new Date();
  for (const row of res.rows) {
    if (row.venta_desde && row.venta_desde > now) continue;
    if (row.venta_hasta && row.venta_hasta < now) continue;
    const upd = await client.query(
      'update entrada_tipo_tandas set vendidos = vendidos + $1 where id = $2 and (cupo is null or vendidos + $1 <= cupo) returning precio_crc, nombre',
      [cantidad, row.id],
    );
    if (upd.rows[0]) return { precio: Number(upd.rows[0].precio_crc), nombre: upd.rows[0].nombre };
  }
  return null;
}

// Fee del evento: si el evento define override lo usa; si no, el default global.
async function resolveFeeConfig(client: Pool | PoolClient, evRow: any): Promise<FeeConfig> {
  if (evRow.fee_tipo) return { tipo: evRow.fee_tipo as FeeTipo, valor: Number(evRow.fee_valor ?? 0) };
  const cfg = await client.query('select fee_tipo_default, fee_valor_default from entrada_config where id = 1');
  const row = cfg.rows[0];
  return { tipo: (row?.fee_tipo_default ?? 'ninguno') as FeeTipo, valor: Number(row?.fee_valor_default ?? 0) };
}

// Consume un código de descuento de forma atómica dentro de la transacción de compra.
// Devuelve null si no se envió código; lanza 400 si el código es inválido/agotado.
async function consumeDescuento(
  client: Pool | PoolClient,
  codigo: string | null | undefined,
  eventoId: string,
): Promise<{ codigo: string; aplicado: DescuentoAplicado } | null> {
  const norm = normalizeCodigo(codigo);
  if (!norm) return null;
  const upd = await client.query(
    `update entrada_descuentos
        set usos_actuales = usos_actuales + 1
      where codigo = $1 and activo = true
        and (evento_id is null or evento_id = $2)
        and (vigencia_desde is null or vigencia_desde <= now())
        and (vigencia_hasta is null or vigencia_hasta >= now())
        and (usos_max is null or usos_actuales < usos_max)
      returning codigo, tipo, valor`,
    [norm, eventoId],
  );
  if (!upd.rows[0]) throw new ApiError(400, 'Código de descuento no válido o agotado');
  const r = upd.rows[0];
  return { codigo: r.codigo, aplicado: { tipo: r.tipo, valor: Number(r.valor) } };
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
    return { evento, tipos: await decorarPrecios(tipos) };
  }

  async comprar({ slug, lineas, comprador, pago, descuentoCodigo, holdId, refCodigo }: CompraInput): Promise<CompraResultado> {
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
      let subtotal = 0;
      const aCrear: { tipoId: string; tipoNombre: string; asiento?: { id: string; fila: string; numero: number } }[] = [];
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
        // Preventa: si hay tanda vigente con cupo, vende al precio de la tanda.
        const tanda = await consumirTanda(client, tipo.id, cantidad);
        subtotal += (tanda ? tanda.precio : Number(tipo.precio_crc)) * cantidad;

        if (tipo.numerado) {
          // Sector numerado: reclama las butacas elegidas en la misma transacción.
          // Acepta disponibles, reservas vencidas, o reservas propias (mismo hold).
          const asientoIds = [...new Set(linea.asientos ?? [])];
          if (asientoIds.length !== cantidad) {
            await client.query('rollback');
            throw new ApiError(400, `Selecciona tus asientos en ${tipo.nombre}`);
          }
          const claim = await client.query(
            `update entrada_asientos
                set estado = 'vendido', hold_id = null, reservado_hasta = null
              where id = any($1) and tipo_id = $2
                and (estado = 'disponible' or (estado = 'reservado' and (reservado_hasta < now() or hold_id = $3)))
              returning id, fila, numero`,
            [asientoIds, tipo.id, holdId ?? ''],
          );
          if (claim.rows.length !== asientoIds.length) {
            await client.query('rollback');
            throw new ApiError(409, `Alguna butaca de ${tipo.nombre} ya no está disponible. Elegí otras.`);
          }
          for (const seat of claim.rows) {
            aCrear.push({ tipoId: tipo.id, tipoNombre: tipo.nombre, asiento: { id: seat.id, fila: seat.fila, numero: Number(seat.numero) } });
          }
        } else {
          for (let i = 0; i < cantidad; i++) aCrear.push({ tipoId: tipo.id, tipoNombre: tipo.nombre });
        }
      }
      // Fee: override por evento, si no, default global. Descuento: consumo atómico.
      const feeConfig = await resolveFeeConfig(client, evRow);
      const descAplicado = await consumeDescuento(client, descuentoCodigo, evRow.id);
      const totales = calcularTotales(subtotal, feeConfig, descAplicado?.aplicado ?? null);
      const promotor = await resolvePromotor(client, refCodigo, totales.subtotal);
      const ordenId = genId('ORD');
      await client.query(
        `insert into entrada_ordenes
           (id, evento_id, comprador_nombre, comprador_email, subtotal_crc, descuento_crc, descuento_codigo, fee_crc, total_crc, promotor_id, comision_crc, comprador_telefono, notif_whatsapp, pago, estado)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [ordenId, evRow.id, comprador.nombre, comprador.email, totales.subtotal, totales.descuento, descAplicado?.codigo ?? null, totales.fee, totales.total, promotor?.id ?? null, promotor?.comision ?? 0, comprador.telefono ?? null, comprador.notifWhatsapp ?? false, pago ? JSON.stringify(pago) : null, 'pagada'],
      );
      const boletos: Boleto[] = [];
      for (const b of aCrear) {
        const id = genId('BOL');
        const codigo = boletoCodigo();
        const qr = qrData(codigo, evRow.id, b.tipoId, comprador.email);
        await client.query(
          'insert into entrada_boletos (id, orden_id, tipo_id, evento_id, codigo, qr_data, estado, asiento_id) values ($1,$2,$3,$4,$5,$6,$7,$8)',
          [id, ordenId, b.tipoId, evRow.id, codigo, qr, 'valido', b.asiento?.id ?? null],
        );
        if (b.asiento) {
          await client.query('update entrada_asientos set boleto_id = $1, orden_id = $2 where id = $3', [id, ordenId, b.asiento.id]);
        }
        boletos.push({
          id, ordenId, tipoId: b.tipoId, eventoId: evRow.id, codigo, qrData: qr, estado: 'valido',
          validadoAt: null, validadoPor: null, tipoNombre: b.tipoNombre, eventoNombre: evRow.nombre,
          asientoId: b.asiento?.id ?? null,
          asientoLabel: b.asiento ? asientoLabel(b.asiento.fila, b.asiento.numero) : null,
        });
      }
      const notaDesc = descAplicado ? `, desc ${descAplicado.codigo} -CRC ${totales.descuento}` : '';
      await logEvento(client, 'compra', { eventoId: evRow.id, user: { id: null, name: comprador.nombre }, notas: `${boletos.length} boleto(s), CRC ${totales.total}${notaDesc}, ${comprador.email}` });
      await this.autoAgotar(client, evRow.id);
      await client.query('commit');
      const orden = {
        id: ordenId,
        eventoId: evRow.id,
        compradorNombre: comprador.nombre,
        compradorEmail: comprador.email,
        subtotalCrc: totales.subtotal,
        descuentoCrc: totales.descuento,
        descuentoCodigo: descAplicado?.codigo ?? null,
        feeCrc: totales.fee,
        totalCrc: totales.total,
        promotorId: promotor?.id ?? null,
        comisionCrc: promotor?.comision ?? 0,
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
      `select b.*, t.nombre as tipo_nombre, e.nombre as evento_nombre, a.fila as asiento_fila, a.numero as asiento_numero
       from entrada_boletos b
       join entrada_tipos t on t.id = b.tipo_id
       join entrada_eventos e on e.id = b.evento_id
       left join entrada_asientos a on a.id = b.asiento_id
       where b.codigo = $1`,
      [codigo],
    );
    return rows[0] ? toBoleto(rows[0]) : null;
  }

  async getOrdenBoletos(ordenId: string): Promise<Boleto[]> {
    const rows = await query<any>(
      `select b.*, t.nombre as tipo_nombre, e.nombre as evento_nombre, a.fila as asiento_fila, a.numero as asiento_numero
       from entrada_boletos b
       join entrada_tipos t on t.id = b.tipo_id
       join entrada_eventos e on e.id = b.evento_id
       left join entrada_asientos a on a.id = b.asiento_id
       where b.orden_id = $1 order by b.codigo`,
      [ordenId],
    );
    return rows.map(toBoleto);
  }

  async getOrden(ordenId: string): Promise<{ id: string; eventoId: string; compradorEmail: string; compradorNombre: string; compradorTelefono: string | null; notifWhatsapp: boolean } | null> {
    const rows = await query<any>('select * from entrada_ordenes where id = $1', [ordenId]);
    if (!rows[0]) return null;
    return {
      id: rows[0].id,
      eventoId: rows[0].evento_id,
      compradorEmail: rows[0].comprador_email,
      compradorNombre: rows[0].comprador_nombre,
      compradorTelefono: rows[0].comprador_telefono ?? null,
      notifWhatsapp: Boolean(rows[0].notif_whatsapp),
    };
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
    const formato = input.formato === 'espectaculo' ? 'espectaculo' : 'partido';
    const mapImageUrl = formato === 'espectaculo' ? 'vector:erc-espectaculo-v1' : '/brand/estadio.jpg';
    const rows = await query<any>(
      'insert into entrada_eventos (id, slug, nombre, descripcion, venue, fecha, estado, imagen_url, formato, map_image_url, field_template, fee_tipo, fee_valor) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *',
      [id, slug, input.nombre, input.descripcion || '', input.venue || '', new Date(input.fecha), 'borrador', input.imagenUrl || '', formato, mapImageUrl, formato === 'espectaculo' ? '2' : null, input.feeTipo ?? null, input.feeValor ?? null],
    );
    return toEvento(rows[0]);
  }

  async actualizarEvento(id: string, input: Partial<EventoInput>): Promise<Evento> {
    const current = await query<any>('select * from entrada_eventos where id = $1', [id]);
    if (!current[0]) throw new ApiError(404, 'Evento no encontrado');
    const c = current[0];
    const fecha = input.fecha ? new Date(input.fecha) : c.fecha;
    const rows = await query<any>(
      'update entrada_eventos set nombre=$1, descripcion=$2, venue=$3, fecha=$4, imagen_url=$5, fee_tipo=$6, fee_valor=$7 where id=$8 returning *',
      [
        input.nombre ?? c.nombre,
        input.descripcion ?? c.descripcion,
        input.venue ?? c.venue,
        fecha,
        input.imagenUrl ?? c.imagen_url,
        input.feeTipo !== undefined ? input.feeTipo : c.fee_tipo,
        input.feeValor !== undefined ? input.feeValor : c.fee_valor,
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
      const orden = { id: ordenId, eventoId, compradorNombre: comprador.nombre, compradorEmail: comprador.email, subtotalCrc: 0, descuentoCrc: 0, descuentoCodigo: null, feeCrc: 0, totalCrc: 0, promotorId: null, comisionCrc: 0, pago: null, estado: 'pagada' as const, createdAt: new Date().toISOString() };
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

  // ── Asientos numerados (P2) ──────────────────────────────────────

  // Devuelve las butacas de un evento publicado, liberando de paso las reservas vencidas.
  async getAsientosPublico(slug: string): Promise<AsientoPublico[]> {
    const ev = await query<any>("select id from entrada_eventos where slug = $1 and estado = 'publicado'", [slug]);
    if (!ev[0]) throw new ApiError(404, 'Evento no encontrado');
    await query(
      `update entrada_asientos set estado = 'disponible', hold_id = null, reservado_hasta = null
        where evento_id = $1 and estado = 'reservado' and reservado_hasta < now()`,
      [ev[0].id],
    );
    const rows = await query<any>('select * from entrada_asientos where evento_id = $1 order by fila, numero', [ev[0].id]);
    return rows.map((r) => ({
      id: r.id,
      tipoId: r.tipo_id,
      fila: r.fila,
      numero: Number(r.numero),
      x: r.x == null ? null : Number(r.x),
      y: r.y == null ? null : Number(r.y),
      estado: r.estado === 'disponible' ? 'disponible' : r.estado === 'reservado' ? 'reservado' : 'ocupado',
    }));
  }

  // Soft-lock: reserva temporal de butacas mientras el comprador completa el checkout.
  async reservarAsientos(slug: string, asientoIds: string[]): Promise<ReservaAsientos> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const ev = await client.query("select id from entrada_eventos where slug = $1 and estado = 'publicado'", [slug]);
      if (!ev.rows[0]) {
        await client.query('rollback');
        throw new ApiError(404, 'Evento no encontrado');
      }
      const holdId = genId('HOLD');
      const upd = await client.query(
        `update entrada_asientos
            set estado = 'reservado', hold_id = $1, reservado_hasta = now() + interval '7 minutes'
          where id = any($2) and evento_id = $3
            and (estado = 'disponible' or (estado = 'reservado' and reservado_hasta < now()))
          returning id, reservado_hasta`,
        [holdId, asientoIds, ev.rows[0].id],
      );
      if (upd.rows.length !== asientoIds.length) {
        await client.query('rollback');
        throw new ApiError(409, 'Alguna butaca ya no está disponible. Actualizá el mapa y elegí otras.');
      }
      await client.query('commit');
      return { holdId, expiraAt: upd.rows[0].reservado_hasta.toISOString(), asientos: upd.rows.map((r: any) => r.id) };
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

  async listAsientosTipo(tipoId: string): Promise<Asiento[]> {
    return (await query<any>('select * from entrada_asientos where tipo_id = $1 order by fila, numero', [tipoId])).map(toAsiento);
  }

  // Genera la grilla de butacas de un sector. Regenerar borra las existentes;
  // se rechaza si ya hay butacas vendidas. stock_total pasa a ser el total de butacas.
  async generarAsientos(tipoId: string, input: GenerarAsientosInput): Promise<{ tipo: TicketType; total: number }> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const tipoRows = await client.query('select * from entrada_tipos where id = $1 for update', [tipoId]);
      const tipo = tipoRows.rows[0];
      if (!tipo) {
        await client.query('rollback');
        throw new ApiError(404, 'Tipo de entrada no encontrado');
      }
      const vendidas = await client.query("select count(*)::int as n from entrada_asientos where tipo_id = $1 and estado = 'vendido'", [tipoId]);
      if (Number(vendidas.rows[0].n) > 0) {
        await client.query('rollback');
        throw new ApiError(409, 'No se puede regenerar: el sector ya tiene butacas vendidas');
      }
      await client.query('delete from entrada_asientos where tipo_id = $1', [tipoId]);
      const { filas, porFila } = input;
      const values: string[] = [];
      const params: unknown[] = [];
      let p = 1;
      for (let f = 0; f < filas; f++) {
        const fila = filaLabel(f);
        for (let n = 1; n <= porFila; n++) {
          values.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
          params.push(genId('AST'), tipo.evento_id, tipoId, fila, n, (n - 0.5) / porFila, (f + 0.5) / filas);
        }
      }
      await client.query(
        `insert into entrada_asientos (id, evento_id, tipo_id, fila, numero, x, y) values ${values.join(',')}`,
        params,
      );
      const total = filas * porFila;
      const upd = await client.query(
        'update entrada_tipos set numerado = true, stock_total = $1, stock_vendido = 0 where id = $2 returning *',
        [total, tipoId],
      );
      await client.query('commit');
      return { tipo: toTipo(upd.rows[0]), total };
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

  // Bloquear/desbloquear una butaca (prensa, cortesías, daños). Ajusta el stock vendible.
  async setEstadoAsiento(asientoId: string, estado: 'disponible' | 'bloqueado'): Promise<Asiento> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const rows = await client.query('select * from entrada_asientos where id = $1 for update', [asientoId]);
      const seat = rows.rows[0];
      if (!seat) {
        await client.query('rollback');
        throw new ApiError(404, 'Butaca no encontrada');
      }
      if (seat.estado === 'vendido') {
        await client.query('rollback');
        throw new ApiError(409, 'La butaca ya fue vendida');
      }
      if (seat.estado === estado) {
        await client.query('rollback');
        return toAsiento(seat);
      }
      const upd = await client.query(
        "update entrada_asientos set estado = $1, hold_id = null, reservado_hasta = null where id = $2 returning *",
        [estado, asientoId],
      );
      const delta = estado === 'bloqueado' ? -1 : 1;
      await client.query('update entrada_tipos set stock_total = greatest(stock_vendido, stock_total + $1) where id = $2', [delta, seat.tipo_id]);
      await client.query('commit');
      return toAsiento(upd.rows[0]);
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

  // ── Tandas / preventa (P1) ───────────────────────────────────────

  async listTandas(tipoId: string): Promise<Tanda[]> {
    return (await query<any>('select * from entrada_tipo_tandas where tipo_id = $1 order by orden, nombre', [tipoId])).map(toTanda);
  }

  async crearTanda(tipoId: string, input: TandaInput): Promise<Tanda> {
    const tipo = await query<any>('select 1 from entrada_tipos where id = $1', [tipoId]);
    if (!tipo[0]) throw new ApiError(404, 'Tipo de entrada no encontrado');
    const ordRow = await query<any>('select coalesce(max(orden), -1) + 1 as next from entrada_tipo_tandas where tipo_id = $1', [tipoId]);
    const rows = await query<any>(
      `insert into entrada_tipo_tandas (id, tipo_id, nombre, precio_crc, venta_desde, venta_hasta, cupo, orden)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [
        genId('TAN'),
        tipoId,
        input.nombre,
        input.precioCrc,
        input.ventaDesde ? new Date(input.ventaDesde) : null,
        input.ventaHasta ? new Date(input.ventaHasta) : null,
        input.cupo ?? null,
        input.orden ?? Number(ordRow[0].next),
      ],
    );
    return toTanda(rows[0]);
  }

  async actualizarTanda(id: string, input: TandaInput): Promise<Tanda> {
    const current = await query<any>('select * from entrada_tipo_tandas where id = $1', [id]);
    if (!current[0]) throw new ApiError(404, 'Tanda no encontrada');
    const c = current[0];
    if (input.cupo != null && input.cupo < Number(c.vendidos)) throw new ApiError(409, 'El cupo no puede ser menor a lo ya vendido');
    const rows = await query<any>(
      `update entrada_tipo_tandas set nombre=$1, precio_crc=$2, venta_desde=$3, venta_hasta=$4, cupo=$5, orden=$6 where id=$7 returning *`,
      [
        input.nombre,
        input.precioCrc,
        input.ventaDesde ? new Date(input.ventaDesde) : null,
        input.ventaHasta ? new Date(input.ventaHasta) : null,
        input.cupo ?? null,
        input.orden ?? Number(c.orden),
        id,
      ],
    );
    return toTanda(rows[0]);
  }

  async eliminarTanda(id: string): Promise<void> {
    await query('delete from entrada_tipo_tandas where id = $1', [id]);
  }

  // ── Promotores / RRPP (P1) ───────────────────────────────────────

  async listPromotores(): Promise<Promotor[]> {
    return (await query<any>('select * from entrada_promotores order by creado_at desc')).map(toPromotor);
  }

  async crearPromotor(input: PromotorInput): Promise<Promotor> {
    const exists = await query<any>('select 1 from entrada_promotores where codigo = $1', [input.codigo]);
    if (exists[0]) throw new ApiError(409, 'Ya existe un promotor con ese código');
    const rows = await query<any>(
      'insert into entrada_promotores (id, nombre, codigo, comision_tipo, comision_valor, activo) values ($1,$2,$3,$4,$5,$6) returning *',
      [genId('PRO'), input.nombre, input.codigo, input.comisionTipo, input.comisionValor, input.activo ?? true],
    );
    return toPromotor(rows[0]);
  }

  async actualizarPromotor(id: string, input: PromotorInput): Promise<Promotor> {
    const current = await query<any>('select * from entrada_promotores where id = $1', [id]);
    if (!current[0]) throw new ApiError(404, 'Promotor no encontrado');
    const dup = await query<any>('select 1 from entrada_promotores where codigo = $1 and id <> $2', [input.codigo, id]);
    if (dup[0]) throw new ApiError(409, 'Ya existe un promotor con ese código');
    const rows = await query<any>(
      'update entrada_promotores set nombre=$1, codigo=$2, comision_tipo=$3, comision_valor=$4, activo=$5 where id=$6 returning *',
      [input.nombre, input.codigo, input.comisionTipo, input.comisionValor, input.activo ?? true, id],
    );
    return toPromotor(rows[0]);
  }

  async eliminarPromotor(id: string): Promise<void> {
    // Las órdenes atribuidas conservan promotor_id (histórico); solo se borra el promotor.
    await query('delete from entrada_promotores where id = $1', [id]);
  }

  async rankingPromotores(): Promise<PromotorRanking[]> {
    // Agregaciones separadas: unir órdenes y boletos en un solo join duplicaría filas.
    const rows = await query<any>(
      `select p.*,
              coalesce(o.ordenes, 0) as ordenes,
              coalesce(o.ventas_crc, 0) as ventas_crc,
              coalesce(o.comision_total, 0) as comision_total,
              coalesce(bb.boletos, 0) as boletos
         from entrada_promotores p
         left join (
           select promotor_id, count(*)::int as ordenes, sum(total_crc)::int as ventas_crc, sum(comision_crc)::int as comision_total
             from entrada_ordenes where estado = 'pagada' and promotor_id is not null group by promotor_id
         ) o on o.promotor_id = p.id
         left join (
           select o2.promotor_id, count(*)::int as boletos
             from entrada_boletos b
             join entrada_ordenes o2 on o2.id = b.orden_id
            where o2.estado = 'pagada' and o2.promotor_id is not null and b.estado <> 'cancelado'
            group by o2.promotor_id
         ) bb on bb.promotor_id = p.id
        order by coalesce(o.ventas_crc, 0) desc, p.nombre`,
    );
    return rows.map((r) => ({
      promotor: toPromotor(r),
      ordenes: Number(r.ordenes),
      boletos: Number(r.boletos),
      ventasCrc: Number(r.ventas_crc),
      comisionCrc: Number(r.comision_total),
    }));
  }

  // ── Fee + descuentos (P1) ────────────────────────────────────────

  async getConfig(): Promise<EntradaConfig> {
    const rows = await query<any>('select fee_tipo_default, fee_valor_default from entrada_config where id = 1');
    const r = rows[0];
    return {
      feeTipoDefault: (r?.fee_tipo_default ?? 'ninguno') as FeeTipo,
      feeValorDefault: Number(r?.fee_valor_default ?? 0),
    };
  }

  async setConfig(input: EntradaConfigInput): Promise<EntradaConfig> {
    const current = await this.getConfig();
    const tipo = input.feeTipoDefault ?? current.feeTipoDefault;
    const valor = input.feeValorDefault ?? current.feeValorDefault;
    await query(
      `insert into entrada_config (id, fee_tipo_default, fee_valor_default) values (1, $1, $2)
       on conflict (id) do update set fee_tipo_default = $1, fee_valor_default = $2`,
      [tipo, valor],
    );
    return { feeTipoDefault: tipo, feeValorDefault: valor };
  }

  async listDescuentos(eventoId?: string): Promise<Descuento[]> {
    const rows = eventoId
      ? await query<any>('select * from entrada_descuentos where evento_id is null or evento_id = $1 order by creado_at desc', [eventoId])
      : await query<any>('select * from entrada_descuentos order by creado_at desc');
    return rows.map(toDescuento);
  }

  async getDescuentoByCodigo(codigo: string): Promise<Descuento | null> {
    const rows = await query<any>('select * from entrada_descuentos where codigo = $1', [codigo]);
    return rows[0] ? toDescuento(rows[0]) : null;
  }

  async crearDescuento(input: DescuentoInput): Promise<Descuento> {
    const exists = await query<any>('select 1 from entrada_descuentos where codigo = $1', [input.codigo]);
    if (exists[0]) throw new ApiError(409, 'Ya existe un código con ese nombre');
    const rows = await query<any>(
      `insert into entrada_descuentos (id, codigo, tipo, valor, evento_id, usos_max, vigencia_desde, vigencia_hasta, activo)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
      [
        genId('DESC'),
        input.codigo,
        input.tipo,
        input.valor,
        input.eventoId ?? null,
        input.usosMax ?? null,
        input.vigenciaDesde ? new Date(input.vigenciaDesde) : null,
        input.vigenciaHasta ? new Date(input.vigenciaHasta) : null,
        input.activo ?? true,
      ],
    );
    return toDescuento(rows[0]);
  }

  async actualizarDescuento(id: string, input: DescuentoInput): Promise<Descuento> {
    const current = await query<any>('select * from entrada_descuentos where id = $1', [id]);
    if (!current[0]) throw new ApiError(404, 'Descuento no encontrado');
    const dup = await query<any>('select 1 from entrada_descuentos where codigo = $1 and id <> $2', [input.codigo, id]);
    if (dup[0]) throw new ApiError(409, 'Ya existe un código con ese nombre');
    const rows = await query<any>(
      `update entrada_descuentos set codigo=$1, tipo=$2, valor=$3, evento_id=$4, usos_max=$5, vigencia_desde=$6, vigencia_hasta=$7, activo=$8 where id=$9 returning *`,
      [
        input.codigo,
        input.tipo,
        input.valor,
        input.eventoId ?? null,
        input.usosMax ?? null,
        input.vigenciaDesde ? new Date(input.vigenciaDesde) : null,
        input.vigenciaHasta ? new Date(input.vigenciaHasta) : null,
        input.activo ?? true,
        id,
      ],
    );
    return toDescuento(rows[0]);
  }

  async eliminarDescuento(id: string): Promise<void> {
    await query('delete from entrada_descuentos where id = $1', [id]);
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
      `update entrada_eventos set
         map_image_url  = coalesce($1, map_image_url),
         field_template = case when $2::text is not null then $2::text else field_template end,
         field_splits   = case when $3::jsonb is not null then $3::jsonb else field_splits end,
         map_version    = map_version + 1
       where id = $4 returning *`,
      [
        input.mapImageUrl ?? null,
        input.fieldTemplate !== undefined ? (input.fieldTemplate ?? null) : null,
        input.fieldSplits !== undefined ? (input.fieldSplits ? JSON.stringify(input.fieldSplits) : null) : null,
        eventoId,
      ],
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
