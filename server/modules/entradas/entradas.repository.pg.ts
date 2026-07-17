import type { Pool, PoolClient } from 'pg';
import { pool, query } from '../../core/db';
import { ApiError } from '../../core/errors';
import {
  Asiento,
  AsientoPublico,
  Boleto,
  CompraResultado,
  Descuento,
  DescuentoInput,
  EntradaConfig,
  EntradaConfigInput,
  Evento,
  EventoInput,
  EventTemplate,
  EventTemplatePayload,
  EntradaLog,
  FeeTipo,
  GenerarAsientosInput,
  IniciarOrdenInput,
  IniciarOrdenResult,
  ListLogOptions,
  MapaBatchInput,
  MapaEventoInput,
  MapaTipoInput,
  MiBoleto,
  OrdenLineaSnapshot,
  OrdenPublica,
  PagoEntrada,
  Promotor,
  PromotorInput,
  PromotorRanking,
  ReservaAsientos,
  Reventa,
  ReventaPayout,
  ReventaPublica,
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

function toReventa(row: any): Reventa {
  return {
    id: row.id,
    boletoId: row.boleto_id,
    eventoId: row.evento_id,
    eventoNombre: row.evento_nombre,
    eventoFecha: row.evento_fecha ? row.evento_fecha.toISOString() : undefined,
    tipoNombre: row.tipo_nombre,
    asientoLabel: row.asiento_fila ? asientoLabel(row.asiento_fila, Number(row.asiento_numero)) : null,
    sellerUserId: row.seller_user_id,
    sellerEmail: row.seller_email ?? '',
    precioCrc: Number(row.precio_crc),
    feeCompradorCrc: Number(row.fee_comprador_crc),
    feeVendedorCrc: Number(row.fee_vendedor_crc),
    estado: row.estado,
    buyerUserId: row.buyer_user_id ?? null,
    ordenReventaId: row.orden_reventa_id ?? null,
    createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
    vendidaAt: row.vendida_at ? row.vendida_at.toISOString() : null,
  };
}

function toPayout(row: any): ReventaPayout {
  return {
    id: row.id,
    reventaId: row.reventa_id,
    sellerUserId: row.seller_user_id,
    sellerEmail: row.seller_email ?? '',
    montoNetoCrc: Number(row.monto_neto_crc),
    estado: row.estado,
    metodo: row.metodo ?? null,
    referencia: row.referencia ?? null,
    createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
    pagadoAt: row.pagado_at ? row.pagado_at.toISOString() : null,
    pagadoPor: row.pagado_por ?? null,
    eventoNombre: row.evento_nombre,
    tipoNombre: row.tipo_nombre,
    precioCrc: row.precio_crc == null ? undefined : Number(row.precio_crc),
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
): Promise<{ id: string; precio: number; nombre: string } | null> {
  const res = await client.query('select * from entrada_tipo_tandas where tipo_id = $1 order by orden for update', [tipoId]);
  if (res.rows.length === 0) return null;
  const now = new Date();
  for (const row of res.rows) {
    if (row.venta_desde && row.venta_desde > now) continue;
    if (row.venta_hasta && row.venta_hasta < now) continue;
    const upd = await client.query(
      'update entrada_tipo_tandas set vendidos = vendidos + $1 where id = $2 and (cupo is null or vendidos + $1 <= cupo) returning id, precio_crc, nombre',
      [cantidad, row.id],
    );
    if (upd.rows[0]) return { id: upd.rows[0].id, precio: Number(upd.rows[0].precio_crc), nombre: upd.rows[0].nombre };
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
    const tipos = (await loadTipos(evento.id)).filter((t) => t.estado === 'activo' || t.mapa?.shape === 'rect');
    return { evento, tipos: await decorarPrecios(tipos) };
  }

  // Reserva cupo (hold) y crea una orden 'pendiente'. Los boletos NO se crean
  // aquí: se materializan cuando el webhook confirma el pago (confirmarOrden).
  // El hold incluye stock, cupo de tanda, uso del descuento y butacas
  // (estado 'reservado' con hold_id = ordenId); expirarOrden lo revierte todo.
  async iniciarOrdenPendiente({ slug, lineas, comprador, provider, descuentoCodigo, holdId, refCodigo }: IniciarOrdenInput): Promise<IniciarOrdenResult> {
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
      const ordenId = genId('ORD');
      let subtotal = 0;
      const snapshot: OrdenLineaSnapshot[] = [];
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
        const precioUnit = tanda ? tanda.precio : Number(tipo.precio_crc);
        subtotal += precioUnit * cantidad;

        const lineaSnap: OrdenLineaSnapshot = { tipoId: tipo.id, cantidad, nombre: tipo.nombre, precioCrc: precioUnit, tandaId: tanda?.id ?? null };
        if (tipo.numerado) {
          // Sector numerado: pasa las butacas al hold de la orden en la misma
          // transacción. Acepta disponibles, reservas vencidas o reservas
          // propias (mismo hold del selector de asientos).
          const asientoIds = [...new Set(linea.asientos ?? [])];
          if (asientoIds.length !== cantidad) {
            await client.query('rollback');
            throw new ApiError(400, `Selecciona tus asientos en ${tipo.nombre}`);
          }
          const claim = await client.query(
            `update entrada_asientos
                set estado = 'reservado', hold_id = $4, reservado_hasta = now() + interval '30 minutes', orden_id = $4
              where id = any($1) and tipo_id = $2
                and (estado = 'disponible' or (estado = 'reservado' and (reservado_hasta < now() or hold_id = $3)))
              returning id, fila, numero`,
            [asientoIds, tipo.id, holdId ?? '', ordenId],
          );
          if (claim.rows.length !== asientoIds.length) {
            await client.query('rollback');
            throw new ApiError(409, `Alguna butaca de ${tipo.nombre} ya no está disponible. Elegí otras.`);
          }
          lineaSnap.asientos = claim.rows.map((s: any) => ({ id: s.id, fila: s.fila, numero: Number(s.numero) }));
        }
        snapshot.push(lineaSnap);
      }
      // Fee: override por evento, si no, default global. Descuento: consumo atómico.
      const feeConfig = await resolveFeeConfig(client, evRow);
      const descAplicado = await consumeDescuento(client, descuentoCodigo, evRow.id);
      const totales = calcularTotales(subtotal, feeConfig, descAplicado?.aplicado ?? null);
      const promotor = await resolvePromotor(client, refCodigo, totales.subtotal);
      await client.query(
        `insert into entrada_ordenes
           (id, evento_id, comprador_nombre, comprador_email, subtotal_crc, descuento_crc, descuento_codigo, fee_crc, total_crc, promotor_id, comision_crc, comprador_telefono, notif_whatsapp, estado, provider, lineas)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [ordenId, evRow.id, comprador.nombre, comprador.email, totales.subtotal, totales.descuento, descAplicado?.codigo ?? null, totales.fee, totales.total, promotor?.id ?? null, promotor?.comision ?? 0, comprador.telefono ?? null, comprador.notifWhatsapp ?? false, 'pendiente', provider, JSON.stringify(snapshot)],
      );
      const notaDesc = descAplicado ? `, desc ${descAplicado.codigo} -CRC ${totales.descuento}` : '';
      await logEvento(client, 'checkout_iniciado', { eventoId: evRow.id, user: { id: null, name: comprador.nombre }, notas: `Orden ${ordenId}, CRC ${totales.total}${notaDesc}, ${comprador.email}` });
      await client.query('commit');

      // Line items para la pasarela. Stripe no admite líneas negativas: con
      // descuento se colapsa a una sola línea por el total ya rebajado.
      let lineItems: { nombre: string; montoUnitarioCrc: number; cantidad: number }[];
      if (totales.descuento > 0) {
        lineItems = [{ nombre: `Entradas ${evRow.nombre}${descAplicado ? ` (desc. ${descAplicado.codigo})` : ''}`, montoUnitarioCrc: totales.total, cantidad: 1 }];
      } else {
        lineItems = snapshot.map((s) => ({ nombre: s.nombre, montoUnitarioCrc: s.precioCrc, cantidad: s.cantidad }));
        if (totales.fee > 0) lineItems.push({ nombre: 'Cargo por servicio', montoUnitarioCrc: totales.fee, cantidad: 1 });
      }
      return { ordenId, total: totales.total, evento: toEvento(evRow), lineItems, desglose: totales };
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

  async setProviderRef(ordenId: string, providerRef: string): Promise<void> {
    await pool.query('update entrada_ordenes set provider_ref = $1 where id = $2', [providerRef, ordenId]);
  }

  // Confirma una orden pendiente: crea los boletos y la marca 'pagada'.
  // Idempotente: si ya estaba 'pagada' devuelve los boletos existentes (Stripe
  // reenvía eventos). Si estaba 'cancelada' o no existe, devuelve null.
  async confirmarOrden(ordenId: string, pago: PagoEntrada): Promise<CompraResultado | null> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const ordRows = await client.query('select * from entrada_ordenes where id = $1 for update', [ordenId]);
      const ord = ordRows.rows[0];
      if (!ord) {
        await client.query('rollback');
        return null;
      }
      const evRows = await client.query('select * from entrada_eventos where id = $1', [ord.evento_id]);
      const evRow = evRows.rows[0];

      if (ord.estado === 'pagada') {
        const existing = await this.getOrdenBoletos(ordenId);
        await client.query('commit');
        return { orden: this.toOrden(ord), boletos: existing, evento: toEvento(evRow) };
      }
      if (ord.estado !== 'pendiente') {
        await client.query('rollback');
        return null;
      }

      const snapshot: OrdenLineaSnapshot[] = Array.isArray(ord.lineas) ? ord.lineas : [];
      const boletos: Boleto[] = [];
      for (const linea of snapshot) {
        // Sectores numerados: un boleto por butaca del hold; el resto por cantidad.
        const asientos = linea.asientos ?? [];
        for (let i = 0; i < linea.cantidad; i++) {
          const asiento = asientos[i] ?? null;
          const id = genId('BOL');
          const codigo = boletoCodigo();
          const qr = qrData(codigo, ord.evento_id, linea.tipoId, ord.comprador_email);
          await client.query(
            'insert into entrada_boletos (id, orden_id, tipo_id, evento_id, codigo, qr_data, estado, asiento_id) values ($1,$2,$3,$4,$5,$6,$7,$8)',
            [id, ordenId, linea.tipoId, ord.evento_id, codigo, qr, 'valido', asiento?.id ?? null],
          );
          if (asiento) {
            await client.query(
              "update entrada_asientos set estado = 'vendido', hold_id = null, reservado_hasta = null, boleto_id = $1, orden_id = $2 where id = $3",
              [id, ordenId, asiento.id],
            );
          }
          boletos.push({
            id, ordenId, tipoId: linea.tipoId, eventoId: ord.evento_id, codigo, qrData: qr, estado: 'valido',
            validadoAt: null, validadoPor: null, tipoNombre: linea.nombre, eventoNombre: evRow?.nombre,
            asientoId: asiento?.id ?? null,
            asientoLabel: asiento ? asientoLabel(asiento.fila, asiento.numero) : null,
          });
        }
      }
      await client.query('update entrada_ordenes set estado = $1, pago = $2 where id = $3', ['pagada', JSON.stringify(pago), ordenId]);
      await logEvento(client, 'compra', { eventoId: ord.evento_id, user: { id: null, name: ord.comprador_nombre }, notas: `${boletos.length} boleto(s), CRC ${ord.total_crc}, ${ord.comprador_email}` });
      await this.autoAgotar(client, ord.evento_id);
      await client.query('commit');
      return { orden: this.toOrden({ ...ord, estado: 'pagada' }), boletos, evento: toEvento(evRow) };
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

  // Libera el cupo reservado de una orden pendiente que expiró o se canceló.
  async expirarOrden(ordenId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const ordRows = await client.query('select * from entrada_ordenes where id = $1 for update', [ordenId]);
      const ord = ordRows.rows[0];
      if (!ord || ord.estado !== 'pendiente') {
        await client.query('rollback');
        return;
      }
      const snapshot: OrdenLineaSnapshot[] = Array.isArray(ord.lineas) ? ord.lineas : [];
      for (const linea of snapshot) {
        await client.query(
          'update entrada_tipos set stock_vendido = greatest(0, stock_vendido - $1) where id = $2',
          [linea.cantidad, linea.tipoId],
        );
        // Devuelve el cupo consumido de la tanda de preventa, si aplicó.
        if (linea.tandaId) {
          await client.query('update entrada_tipo_tandas set vendidos = greatest(0, vendidos - $1) where id = $2', [linea.cantidad, linea.tandaId]);
        }
        // Libera las butacas del hold de esta orden.
        if (linea.asientos?.length) {
          await client.query(
            `update entrada_asientos set estado = 'disponible', hold_id = null, reservado_hasta = null, orden_id = null
              where id = any($1) and estado = 'reservado' and hold_id = $2`,
            [linea.asientos.map((a) => a.id), ordenId],
          );
        }
      }
      // Devuelve el uso del código de descuento consumido al iniciar.
      if (ord.descuento_codigo) {
        await client.query('update entrada_descuentos set usos_actuales = greatest(0, usos_actuales - 1) where codigo = $1', [ord.descuento_codigo]);
      }
      await client.query('update entrada_ordenes set estado = $1 where id = $2', ['cancelada', ordenId]);
      // Si el evento se había marcado 'agotado' por este hold, vuelve a 'publicado'.
      await client.query("update entrada_eventos set estado = 'publicado' where id = $1 and estado = 'agotado'", [ord.evento_id]);
      await logEvento(client, 'checkout_expirado', { eventoId: ord.evento_id, user: { id: null, name: ord.comprador_nombre }, notas: `Orden ${ordenId} liberada` });
      await client.query('commit');
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

  // Estado de una orden para el polling de la página de retorno.
  async getOrdenPublica(ref: string): Promise<OrdenPublica | null> {
    const rows = await query<any>('select * from entrada_ordenes where id = $1', [ref]);
    if (!rows[0]) return null;
    const estado = rows[0].estado;
    if (estado !== 'pagada') return { estado, boletos: [] };
    // Compra secundaria (reventa): el boleto transferido conserva su orden_id
    // original, así que se resuelve por el listing en vez de por la orden.
    if (rows[0].reventa_id) {
      const rv = await query<any>(
        `select b.codigo, b.qr_data, t.nombre as tipo_nombre, a.fila as asiento_fila, a.numero as asiento_numero
           from entrada_reventas r
           join entrada_boletos b on b.id = r.boleto_id
           join entrada_tipos t on t.id = b.tipo_id
           left join entrada_asientos a on a.id = b.asiento_id
          where r.id = $1`,
        [rows[0].reventa_id],
      );
      return {
        estado,
        boletos: rv.map((b) => ({
          codigo: b.codigo,
          qrData: b.qr_data,
          tipoNombre: b.tipo_nombre,
          asientoLabel: b.asiento_fila ? asientoLabel(b.asiento_fila, Number(b.asiento_numero)) : null,
        })),
      };
    }
    const boletos = await this.getOrdenBoletos(ref);
    return { estado, boletos: boletos.map((b) => ({ codigo: b.codigo, qrData: b.qrData, tipoNombre: b.tipoNombre, asientoLabel: b.asientoLabel ?? null })) };
  }

  private toOrden(row: any) {
    return {
      id: row.id,
      eventoId: row.evento_id,
      compradorNombre: row.comprador_nombre,
      compradorEmail: row.comprador_email,
      subtotalCrc: Number(row.subtotal_crc ?? row.total_crc),
      descuentoCrc: Number(row.descuento_crc ?? 0),
      descuentoCodigo: row.descuento_codigo ?? null,
      feeCrc: Number(row.fee_crc ?? 0),
      totalCrc: Number(row.total_crc),
      promotorId: row.promotor_id ?? null,
      comisionCrc: Number(row.comision_crc ?? 0),
      compradorTelefono: row.comprador_telefono ?? null,
      notifWhatsapp: Boolean(row.notif_whatsapp),
      pago: null,
      estado: row.estado as 'pendiente' | 'pagada' | 'cancelada',
      createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
    };
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
    // Cambiar el formato redefine el mapa: vuelve a los defaults del formato
    // nuevo (mismos valores que usa crearEvento).
    const formato = input.formato ?? c.formato ?? 'partido';
    const formatoCambio = formato !== (c.formato ?? 'partido');
    const mapImageUrl = formatoCambio
      ? (formato === 'espectaculo' ? 'vector:erc-espectaculo-v1' : '/brand/estadio.jpg')
      : c.map_image_url;
    const fieldTemplate = formatoCambio ? (formato === 'espectaculo' ? '2' : null) : c.field_template;
    const fieldSplits = formatoCambio || c.field_splits == null ? null : JSON.stringify(c.field_splits);
    // Mientras el evento sea borrador el slug sigue al nombre; ya publicado no
    // se toca para no romper enlaces compartidos.
    let slug = c.slug;
    if (input.nombre && input.nombre !== c.nombre && c.estado === 'borrador') {
      const nuevo = slugify(input.nombre);
      if (nuevo && nuevo !== c.slug) {
        const exists = await query<any>('select 1 from entrada_eventos where slug = $1 and id <> $2', [nuevo, id]);
        slug = exists[0] ? `${nuevo}-${String(id).slice(-4).toLowerCase()}` : nuevo;
      }
    }
    const rows = await query<any>(
      'update entrada_eventos set nombre=$1, descripcion=$2, venue=$3, fecha=$4, imagen_url=$5, fee_tipo=$6, fee_valor=$7, formato=$8, map_image_url=$9, field_template=$10, field_splits=$11::jsonb, slug=$12 where id=$13 returning *',
      [
        input.nombre ?? c.nombre,
        input.descripcion ?? c.descripcion,
        input.venue ?? c.venue,
        fecha,
        input.imagenUrl ?? c.imagen_url,
        input.feeTipo !== undefined ? input.feeTipo : c.fee_tipo,
        input.feeValor !== undefined ? input.feeValor : c.fee_valor,
        formato,
        mapImageUrl,
        fieldTemplate,
        fieldSplits,
        slug,
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
    // `numerado` no se toca aquí: lo gestiona exclusivamente generarAsientos.
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

  // ── Templates de evento ──────────────────────────────────────────

  async listTemplates(): Promise<EventTemplate[]> {
    const rows = await query<any>('select * from entrada_event_templates order by creado_at desc');
    return rows.map((r) => ({ id: r.id, nombre: r.nombre, descripcion: r.descripcion, payload: r.payload, creadoAt: r.creado_at.toISOString() }));
  }

  async getTemplate(id: string): Promise<EventTemplate | null> {
    const rows = await query<any>('select * from entrada_event_templates where id = $1', [id]);
    if (!rows[0]) return null;
    return { id: rows[0].id, nombre: rows[0].nombre, descripcion: rows[0].descripcion, payload: rows[0].payload, creadoAt: rows[0].creado_at.toISOString() };
  }

  async crearTemplate(nombre: string, descripcion: string, payload: EventTemplatePayload): Promise<EventTemplate> {
    const exists = await query<any>('select 1 from entrada_event_templates where lower(nombre) = lower($1)', [nombre]);
    if (exists[0]) throw new ApiError(409, 'Ya existe un template con ese nombre');
    const rows = await query<any>(
      'insert into entrada_event_templates (id, nombre, descripcion, payload) values ($1,$2,$3,$4) returning *',
      [genId('TPL'), nombre, descripcion, JSON.stringify(payload)],
    );
    return { id: rows[0].id, nombre: rows[0].nombre, descripcion: rows[0].descripcion, payload: rows[0].payload, creadoAt: rows[0].creado_at.toISOString() };
  }

  async actualizarTemplate(id: string, nombre: string, descripcion: string): Promise<EventTemplate> {
    const dup = await query<any>('select 1 from entrada_event_templates where lower(nombre) = lower($1) and id <> $2', [nombre, id]);
    if (dup[0]) throw new ApiError(409, 'Ya existe un template con ese nombre');
    const rows = await query<any>('update entrada_event_templates set nombre=$1, descripcion=$2 where id=$3 returning *', [nombre, descripcion, id]);
    if (!rows[0]) throw new ApiError(404, 'Template no encontrado');
    return { id: rows[0].id, nombre: rows[0].nombre, descripcion: rows[0].descripcion, payload: rows[0].payload, creadoAt: rows[0].creado_at.toISOString() };
  }

  async eliminarTemplate(id: string): Promise<void> {
    await query('delete from entrada_event_templates where id = $1', [id]);
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
    const rows = await query<any>(
      'select fee_tipo_default, fee_valor_default, reventa_activa, reventa_tope_nominal, reventa_fee_comprador_pct, reventa_fee_vendedor_pct from entrada_config where id = 1',
    );
    const r = rows[0];
    return {
      feeTipoDefault: (r?.fee_tipo_default ?? 'ninguno') as FeeTipo,
      feeValorDefault: Number(r?.fee_valor_default ?? 0),
      reventaActiva: r?.reventa_activa ?? true,
      reventaTopeNominal: r?.reventa_tope_nominal ?? true,
      reventaFeeCompradorPct: Number(r?.reventa_fee_comprador_pct ?? 0),
      reventaFeeVendedorPct: Number(r?.reventa_fee_vendedor_pct ?? 0),
    };
  }

  async setConfig(input: EntradaConfigInput): Promise<EntradaConfig> {
    const current = await this.getConfig();
    const tipo = input.feeTipoDefault ?? current.feeTipoDefault;
    const valor = input.feeValorDefault ?? current.feeValorDefault;
    const reventaActiva = input.reventaActiva ?? current.reventaActiva;
    const reventaTope = input.reventaTopeNominal ?? current.reventaTopeNominal;
    const feeComprador = input.reventaFeeCompradorPct ?? current.reventaFeeCompradorPct;
    const feeVendedor = input.reventaFeeVendedorPct ?? current.reventaFeeVendedorPct;
    await query(
      `insert into entrada_config (id, fee_tipo_default, fee_valor_default, reventa_activa, reventa_tope_nominal, reventa_fee_comprador_pct, reventa_fee_vendedor_pct)
       values (1, $1, $2, $3, $4, $5, $6)
       on conflict (id) do update set fee_tipo_default = $1, fee_valor_default = $2, reventa_activa = $3, reventa_tope_nominal = $4, reventa_fee_comprador_pct = $5, reventa_fee_vendedor_pct = $6`,
      [tipo, valor, reventaActiva, reventaTope, feeComprador, feeVendedor],
    );
    return {
      feeTipoDefault: tipo,
      feeValorDefault: valor,
      reventaActiva,
      reventaTopeNominal: reventaTope,
      reventaFeeCompradorPct: feeComprador,
      reventaFeeVendedorPct: feeVendedor,
    };
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

  async eliminarTipo(id: string): Promise<{ eventoId: string; nombre: string }> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const tipo = await client.query('select evento_id, nombre from entrada_tipos where id = $1', [id]);
      if (!tipo.rows[0]) throw new Error('Sector no encontrado');
      // No se puede borrar un sector con boletos emitidos (la FK no cascada y
      // perderíamos historial de venta). Asientos y tandas sí cascadan.
      const boletos = await client.query(
        "select count(*)::int as n from entrada_boletos where tipo_id = $1 and estado <> 'cancelado'",
        [id],
      );
      if (Number(boletos.rows[0].n) > 0) throw new Error('No se puede eliminar: el sector tiene boletos emitidos');
      await client.query('delete from entrada_tipos where id = $1', [id]);
      await client.query('commit');
      return { eventoId: String(tipo.rows[0].evento_id), nombre: String(tipo.rows[0].nombre) };
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  async eliminarEvento(id: string): Promise<{ nombre: string; imagenUrl: string }> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const ev = await client.query('select nombre, imagen_url from entrada_eventos where id = $1', [id]);
      if (!ev.rows[0]) throw new Error('Evento no encontrado');
      // No se puede borrar un evento con boletos emitidos: perderíamos el
      // historial de venta y dejaríamos compradores con entradas huérfanas.
      const boletos = await client.query(
        "select count(*)::int as n from entrada_boletos where evento_id = $1 and estado <> 'cancelado'",
        [id],
      );
      if (Number(boletos.rows[0].n) > 0) throw new Error(`No se puede eliminar: el evento tiene ${boletos.rows[0].n} boleto(s) emitido(s)`);
      // Órdenes y boletos referencian el evento sin cascade: se borran primero.
      // El resto (tipos, asientos, tandas, descuentos) cascada desde el evento.
      await client.query('delete from entrada_boletos where evento_id = $1', [id]);
      await client.query('delete from entrada_ordenes where evento_id = $1', [id]);
      await client.query('delete from entrada_log where evento_id = $1', [id]);
      await client.query('delete from entrada_eventos where id = $1', [id]);
      await client.query('commit');
      return { nombre: String(ev.rows[0].nombre), imagenUrl: String(ev.rows[0].imagen_url || '') };
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
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

  // ── Reventa (mercado secundario) ─────────────────────────────────

  // Boletos del usuario: backfill perezoso del vínculo cuenta<->orden por email
  // y devuelve los boletos que le pertenecen (por owner explícito o por la orden
  // original), con su listing de reventa si existe.
  async listMisBoletos(userId: string, email: string): Promise<MiBoleto[]> {
    const mail = String(email || '').trim().toLowerCase();
    if (mail) {
      // Vincula las órdenes anónimas del usuario por coincidencia de correo.
      await query(
        'update entrada_ordenes set comprador_user_id = $1 where comprador_user_id is null and lower(comprador_email) = $2',
        [userId, mail],
      );
    }
    const rows = await query<any>(
      `select b.*, t.nombre as tipo_nombre, t.precio_crc as tipo_precio, e.nombre as evento_nombre,
              e.fecha as evento_fecha, e.slug as evento_slug, e.estado as evento_estado,
              a.fila as asiento_fila, a.numero as asiento_numero,
              r.id as reventa_id, r.precio_crc as reventa_precio, r.estado as reventa_estado
         from entrada_boletos b
         join entrada_tipos t on t.id = b.tipo_id
         join entrada_eventos e on e.id = b.evento_id
         join entrada_ordenes o on o.id = b.orden_id
         left join entrada_asientos a on a.id = b.asiento_id
         left join entrada_reventas r on r.boleto_id = b.id and r.estado in ('activa','reservada')
        where (b.owner_user_id = $1 or (b.owner_user_id is null and o.comprador_user_id = $1))
        order by e.fecha asc, b.codigo`,
      [userId],
    );
    const now = Date.now();
    return rows.map((b) => {
      const eventoFecha = b.evento_fecha ? b.evento_fecha.toISOString() : new Date().toISOString();
      const iniciado = new Date(eventoFecha).getTime() <= now;
      const finalizado = b.evento_estado === 'finalizado';
      const reventa = b.reventa_id
        ? { id: b.reventa_id, precioCrc: Number(b.reventa_precio), estado: b.reventa_estado as any }
        : null;
      const vendible = b.estado === 'valido' && !iniciado && !finalizado && !reventa;
      return {
        id: b.id,
        codigo: b.codigo,
        estado: b.estado,
        eventoId: b.evento_id,
        eventoNombre: b.evento_nombre,
        eventoFecha,
        eventoSlug: b.evento_slug,
        tipoId: b.tipo_id,
        tipoNombre: b.tipo_nombre,
        valorNominalCrc: Number(b.tipo_precio),
        qrData: b.qr_data,
        asientoLabel: b.asiento_fila ? asientoLabel(b.asiento_fila, Number(b.asiento_numero)) : null,
        reventa,
        vendible,
      } as MiBoleto;
    });
  }

  async crearReventa(userId: string, sellerEmail: string, boletoId: string, precioCrc: number): Promise<Reventa> {
    const cfg = await this.getConfig();
    if (!cfg.reventaActiva) throw new ApiError(409, 'La reventa no está habilitada en este momento');
    const client = await pool.connect();
    try {
      await client.query('begin');
      const bolRows = await client.query(
        `select b.*, t.precio_crc as tipo_precio, o.comprador_user_id, e.estado as evento_estado, e.fecha as evento_fecha
           from entrada_boletos b
           join entrada_tipos t on t.id = b.tipo_id
           join entrada_ordenes o on o.id = b.orden_id
           join entrada_eventos e on e.id = b.evento_id
          where b.id = $1 for update of b`,
        [boletoId],
      );
      const b = bolRows.rows[0];
      if (!b) { await client.query('rollback'); throw new ApiError(404, 'Boleto no encontrado'); }
      const esDueno = b.owner_user_id === userId || (b.owner_user_id == null && b.comprador_user_id === userId);
      if (!esDueno) { await client.query('rollback'); throw new ApiError(403, 'Este boleto no está a tu nombre'); }
      if (b.estado !== 'valido') { await client.query('rollback'); throw new ApiError(409, 'Solo se pueden revender boletos válidos'); }
      if (b.evento_estado === 'finalizado' || new Date(b.evento_fecha).getTime() <= Date.now()) {
        await client.query('rollback');
        throw new ApiError(409, 'El evento ya inició; no se puede revender');
      }
      const precio = Math.round(Number(precioCrc));
      if (!Number.isFinite(precio) || precio <= 0) { await client.query('rollback'); throw new ApiError(400, 'Precio inválido'); }
      const nominal = Number(b.tipo_precio);
      if (cfg.reventaTopeNominal && precio > nominal) {
        await client.query('rollback');
        throw new ApiError(400, `El precio no puede superar el valor nominal (${nominal})`);
      }
      const feeComprador = Math.round((precio * cfg.reventaFeeCompradorPct) / 100);
      const feeVendedor = Math.round((precio * cfg.reventaFeeVendedorPct) / 100);
      const existing = await client.query(
        "select 1 from entrada_reventas where boleto_id = $1 and estado in ('activa','reservada')",
        [boletoId],
      );
      if (existing.rows[0]) { await client.query('rollback'); throw new ApiError(409, 'Este boleto ya está publicado en reventa'); }
      const id = genId('RVT');
      const ins = await client.query(
        `insert into entrada_reventas (id, boleto_id, evento_id, seller_user_id, seller_email, precio_crc, fee_comprador_crc, fee_vendedor_crc, estado)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'activa') returning *`,
        [id, boletoId, b.evento_id, userId, String(sellerEmail || '').toLowerCase(), precio, feeComprador, feeVendedor],
      );
      await logEvento(client, 'reventa_listada', { eventoId: b.evento_id, boletoId, user: { id: userId, name: sellerEmail }, notas: `Listing ${id}, CRC ${precio}` });
      await client.query('commit');
      return toReventa(ins.rows[0]);
    } catch (err) {
      try { await client.query('rollback'); } catch { /* noop */ }
      throw err;
    } finally {
      client.release();
    }
  }

  async listMisReventas(userId: string): Promise<Reventa[]> {
    const rows = await query<any>(
      `select r.*, e.nombre as evento_nombre, e.fecha as evento_fecha, t.nombre as tipo_nombre,
              a.fila as asiento_fila, a.numero as asiento_numero
         from entrada_reventas r
         join entrada_eventos e on e.id = r.evento_id
         join entrada_boletos b on b.id = r.boleto_id
         join entrada_tipos t on t.id = b.tipo_id
         left join entrada_asientos a on a.id = b.asiento_id
        where r.seller_user_id = $1
        order by r.created_at desc`,
      [userId],
    );
    return rows.map(toReventa);
  }

  async cancelarReventa(userId: string, reventaId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const rows = await client.query('select * from entrada_reventas where id = $1 for update', [reventaId]);
      const r = rows.rows[0];
      if (!r) { await client.query('rollback'); throw new ApiError(404, 'Reventa no encontrada'); }
      if (r.seller_user_id !== userId) { await client.query('rollback'); throw new ApiError(403, 'No es tu publicación'); }
      if (r.estado !== 'activa') { await client.query('rollback'); throw new ApiError(409, 'Solo se pueden cancelar publicaciones activas'); }
      await client.query("update entrada_reventas set estado = 'cancelada' where id = $1", [reventaId]);
      await logEvento(client, 'reventa_cancelada', { eventoId: r.evento_id, boletoId: r.boleto_id, user: { id: userId, name: r.seller_email }, notas: `Listing ${reventaId}` });
      await client.query('commit');
    } catch (err) {
      try { await client.query('rollback'); } catch { /* noop */ }
      throw err;
    } finally {
      client.release();
    }
  }

  async listReventasPublicas(slug: string): Promise<ReventaPublica[]> {
    const ev = await query<any>("select id from entrada_eventos where slug = $1 and estado = 'publicado'", [slug]);
    if (!ev[0]) return [];
    const rows = await query<any>(
      `select r.id, r.precio_crc, r.fee_comprador_crc, t.nombre as tipo_nombre,
              a.fila as asiento_fila, a.numero as asiento_numero
         from entrada_reventas r
         join entrada_boletos b on b.id = r.boleto_id
         join entrada_tipos t on t.id = b.tipo_id
         left join entrada_asientos a on a.id = b.asiento_id
        where r.evento_id = $1 and r.estado = 'activa' and b.estado = 'valido'
        order by r.precio_crc asc, r.created_at asc`,
      [ev[0].id],
    );
    return rows.map((r) => ({
      id: r.id,
      tipoNombre: r.tipo_nombre,
      asientoLabel: r.asiento_fila ? asientoLabel(r.asiento_fila, Number(r.asiento_numero)) : null,
      precioCrc: Number(r.precio_crc),
      feeCompradorCrc: Number(r.fee_comprador_crc),
      totalCrc: Number(r.precio_crc) + Number(r.fee_comprador_crc),
    }));
  }

  // Reserva el listing y crea la orden de compra secundaria (pendiente). El
  // boleto se transfiere al confirmar el pago (confirmarReventa).
  async iniciarReventaOrden(userId: string, buyerEmail: string, buyerNombre: string, reventaId: string, provider: string): Promise<{ ordenId: string; total: number; evento: Evento; lineItems: { nombre: string; montoUnitarioCrc: number; cantidad: number }[] }> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const rvRows = await client.query('select * from entrada_reventas where id = $1 for update', [reventaId]);
      const rv = rvRows.rows[0];
      if (!rv) { await client.query('rollback'); throw new ApiError(404, 'Publicación no encontrada'); }
      if (rv.estado !== 'activa') { await client.query('rollback'); throw new ApiError(409, 'La publicación ya no está disponible'); }
      if (rv.seller_user_id === userId) { await client.query('rollback'); throw new ApiError(409, 'No podés comprar tu propia publicación'); }
      const evRows = await client.query('select * from entrada_eventos where id = $1', [rv.evento_id]);
      const evRow = evRows.rows[0];
      if (!evRow || evRow.estado === 'finalizado' || new Date(evRow.fecha).getTime() <= Date.now()) {
        await client.query('rollback');
        throw new ApiError(409, 'El evento ya no admite compras');
      }
      // El boleto debe seguir válido.
      const bol = await client.query("select estado from entrada_boletos where id = $1", [rv.boleto_id]);
      if (!bol.rows[0] || bol.rows[0].estado !== 'valido') { await client.query('rollback'); throw new ApiError(409, 'El boleto ya no está disponible'); }
      const total = Number(rv.precio_crc) + Number(rv.fee_comprador_crc);
      const ordenId = genId('ORD');
      await client.query(
        `insert into entrada_ordenes
           (id, evento_id, comprador_nombre, comprador_email, comprador_user_id, subtotal_crc, total_crc, estado, provider, reventa_id, lineas)
         values ($1,$2,$3,$4,$5,$6,$7,'pendiente',$8,$9,$10)`,
        [ordenId, rv.evento_id, buyerNombre, String(buyerEmail).toLowerCase(), userId, rv.precio_crc, total, provider, reventaId, JSON.stringify([])],
      );
      await client.query("update entrada_reventas set estado = 'reservada', buyer_user_id = $2, orden_reventa_id = $3 where id = $1", [reventaId, userId, ordenId]);
      await logEvento(client, 'reventa_checkout', { eventoId: rv.evento_id, boletoId: rv.boleto_id, user: { id: userId, name: buyerEmail }, notas: `Orden ${ordenId}, listing ${reventaId}, CRC ${total}` });
      await client.query('commit');
      const lineItems = [{ nombre: `Reventa · ${evRow.nombre}`, montoUnitarioCrc: total, cantidad: 1 }];
      return { ordenId, total, evento: toEvento(evRow), lineItems };
    } catch (err) {
      try { await client.query('rollback'); } catch { /* noop */ }
      throw err;
    } finally {
      client.release();
    }
  }

  async getOrdenKind(ordenId: string): Promise<{ reventaId: string | null } | null> {
    const rows = await query<any>('select reventa_id from entrada_ordenes where id = $1', [ordenId]);
    if (!rows[0]) return null;
    return { reventaId: rows[0].reventa_id ?? null };
  }

  // Confirma una compra secundaria: transfiere el boleto al comprador (nuevo
  // código + QR, invalidando el anterior), cierra el listing y crea el payout
  // pendiente para el vendedor. Idempotente por estado de la orden.
  async confirmarReventa(ordenId: string, pago: PagoEntrada): Promise<{ evento: Evento; boleto: Boleto; compradorEmail: string; sellerEmail: string; precioCrc: number } | null> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const ordRows = await client.query('select * from entrada_ordenes where id = $1 for update', [ordenId]);
      const ord = ordRows.rows[0];
      if (!ord || !ord.reventa_id) { await client.query('rollback'); return null; }
      if (ord.estado === 'pagada') { await client.query('rollback'); return null; }
      if (ord.estado !== 'pendiente') { await client.query('rollback'); return null; }

      const rvRows = await client.query('select * from entrada_reventas where id = $1 for update', [ord.reventa_id]);
      const rv = rvRows.rows[0];
      if (!rv) { await client.query('rollback'); return null; }

      const bolRows = await client.query('select * from entrada_boletos where id = $1 for update', [rv.boleto_id]);
      const bol = bolRows.rows[0];
      if (!bol) { await client.query('rollback'); return null; }

      // Reemite el boleto: nuevo código + QR con el correo del comprador. El QR
      // viejo deja de validar automáticamente (la puerta busca por código).
      const nuevoCodigo = boletoCodigo();
      const nuevoQr = qrData(nuevoCodigo, bol.evento_id, bol.tipo_id, ord.comprador_email);
      const updBol = await client.query(
        `update entrada_boletos
            set codigo = $1, qr_data = $2, owner_user_id = $3, owner_email = $4
          where id = $5 returning *`,
        [nuevoCodigo, nuevoQr, ord.comprador_user_id, String(ord.comprador_email).toLowerCase(), bol.id],
      );

      await client.query("update entrada_reventas set estado = 'vendida', vendida_at = now() where id = $1", [rv.id]);
      await client.query('update entrada_ordenes set estado = $1, pago = $2 where id = $3', ['pagada', JSON.stringify(pago), ordenId]);

      const montoNeto = Number(rv.precio_crc) - Number(rv.fee_vendedor_crc);
      await client.query(
        `insert into entrada_reventa_payouts (id, reventa_id, seller_user_id, seller_email, monto_neto_crc, estado)
         values ($1,$2,$3,$4,$5,'pendiente')`,
        [genId('PAY'), rv.id, rv.seller_user_id, rv.seller_email, Math.max(0, montoNeto)],
      );

      await logEvento(client, 'reventa', { eventoId: bol.evento_id, boletoId: bol.id, user: { id: ord.comprador_user_id, name: ord.comprador_email }, notas: `Boleto transferido (listing ${rv.id}), CRC ${rv.precio_crc}` });

      const evRows = await client.query('select * from entrada_eventos where id = $1', [bol.evento_id]);
      const evento = toEvento(evRows.rows[0]);
      const meta = await client.query('select nombre from entrada_tipos where id = $1', [bol.tipo_id]);
      await client.query('commit');
      const boleto = toBoleto({ ...updBol.rows[0], tipo_nombre: meta.rows[0]?.nombre, evento_nombre: evRows.rows[0]?.nombre });
      return { evento, boleto, compradorEmail: String(ord.comprador_email), sellerEmail: String(rv.seller_email || ''), precioCrc: Number(rv.precio_crc) };
    } catch (err) {
      try { await client.query('rollback'); } catch { /* noop */ }
      throw err;
    } finally {
      client.release();
    }
  }

  // Compra secundaria expirada/cancelada: libera el listing y cancela la orden.
  async expirarReventaOrden(ordenId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const ordRows = await client.query('select * from entrada_ordenes where id = $1 for update', [ordenId]);
      const ord = ordRows.rows[0];
      if (!ord || !ord.reventa_id || ord.estado !== 'pendiente') { await client.query('rollback'); return; }
      await client.query('update entrada_ordenes set estado = $1 where id = $2', ['cancelada', ordenId]);
      await client.query(
        "update entrada_reventas set estado = 'activa', buyer_user_id = null, orden_reventa_id = null where id = $1 and estado = 'reservada'",
        [ord.reventa_id],
      );
      await logEvento(client, 'reventa_checkout_expirado', { eventoId: ord.evento_id, user: { id: ord.comprador_user_id, name: ord.comprador_email }, notas: `Orden ${ordenId} liberada, listing ${ord.reventa_id}` });
      await client.query('commit');
    } catch (err) {
      try { await client.query('rollback'); } catch { /* noop */ }
      throw err;
    } finally {
      client.release();
    }
  }

  async adminListReventas(): Promise<{ reventas: Reventa[]; payouts: ReventaPayout[] }> {
    const reventas = (await query<any>(
      `select r.*, e.nombre as evento_nombre, e.fecha as evento_fecha, t.nombre as tipo_nombre,
              a.fila as asiento_fila, a.numero as asiento_numero
         from entrada_reventas r
         join entrada_eventos e on e.id = r.evento_id
         join entrada_boletos b on b.id = r.boleto_id
         join entrada_tipos t on t.id = b.tipo_id
         left join entrada_asientos a on a.id = b.asiento_id
        order by r.created_at desc`,
    )).map(toReventa);
    const payouts = (await query<any>(
      `select p.*, e.nombre as evento_nombre, t.nombre as tipo_nombre, r.precio_crc
         from entrada_reventa_payouts p
         join entrada_reventas r on r.id = p.reventa_id
         join entrada_eventos e on e.id = r.evento_id
         join entrada_boletos b on b.id = r.boleto_id
         join entrada_tipos t on t.id = b.tipo_id
        order by (p.estado = 'pendiente') desc, p.created_at desc`,
    )).map(toPayout);
    return { reventas, payouts };
  }

  async marcarPayoutPagado(payoutId: string, actor: { id: string; name: string }, metodo?: string, referencia?: string): Promise<ReventaPayout> {
    const rows = await query<any>('select * from entrada_reventa_payouts where id = $1', [payoutId]);
    if (!rows[0]) throw new ApiError(404, 'Saldo no encontrado');
    if (rows[0].estado === 'pagado') throw new ApiError(409, 'El saldo ya fue marcado como pagado');
    const upd = await query<any>(
      "update entrada_reventa_payouts set estado = 'pagado', metodo = $2, referencia = $3, pagado_at = now(), pagado_por = $4 where id = $1 returning *",
      [payoutId, metodo ?? null, referencia ?? null, actor.name],
    );
    await this.logEvento('reventa_payout_pagado', { user: actor, notas: `Payout ${payoutId} · CRC ${rows[0].monto_neto_crc}${metodo ? ` · ${metodo}` : ''}` });
    return toPayout(upd[0]);
  }
}
