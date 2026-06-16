// Layout del croquis de parqueos derivado de los planos arquitectónicos
// (SÓTANO -1 y SÓTANO -2). Las coordenadas son FRACCIONES (0..1) relativas a la
// imagen del plano, calibradas contra el render del PDF. Esta es la única fuente
// de verdad: el seed de parking_spaces y el endpoint del croquis se generan de aquí,
// y el frontend dibuja el overlay con estas mismas fracciones (queda bloqueado al
// fondo => "match" de dimensiones a cualquier tamaño).

export interface BandDef {
  id: string;
  zona: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  count: number;
}

export interface FloorPlan {
  piso: number;
  plan: string; // nombre de la imagen (sotano-1 / sotano-2)
  aspect: number; // ancho/alto de la imagen
  bands: BandDef[];
}

export interface Stall {
  id: string;
  piso: number;
  zona: string;
  num: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Imagen renderizada del PDF: 1700 x 1134 px.
const ASPECT = 1700 / 1134;

export const FLOOR_PLANS: FloorPlan[] = [
  {
    piso: 1,
    plan: 'sotano-1',
    aspect: ASPECT,
    bands: [
      { id: 'norte-ext', zona: 'A', x0: 0.158, y0: 0.120, x1: 0.828, y1: 0.150, count: 33 },
      { id: 'norte-int', zona: 'A', x0: 0.205, y0: 0.162, x1: 0.610, y1: 0.190, count: 17 },
      { id: 'oeste-ext', zona: 'A', x0: 0.118, y0: 0.200, x1: 0.150, y1: 0.700, count: 18 },
      { id: 'oeste-int', zona: 'A', x0: 0.193, y0: 0.205, x1: 0.225, y1: 0.690, count: 16 },
      { id: 'sur', zona: 'B', x0: 0.158, y0: 0.745, x1: 0.792, y1: 0.775, count: 30 },
      { id: 'este', zona: 'B', x0: 0.740, y0: 0.300, x1: 0.772, y1: 0.620, count: 10 },
    ],
  },
  {
    piso: 2,
    plan: 'sotano-2',
    aspect: ASPECT,
    bands: [
      { id: 'norte', zona: 'A', x0: 0.158, y0: 0.120, x1: 0.840, y1: 0.150, count: 34 },
      { id: 'oeste-ext', zona: 'A', x0: 0.118, y0: 0.200, x1: 0.150, y1: 0.700, count: 18 },
      { id: 'oeste-int', zona: 'A', x0: 0.193, y0: 0.205, x1: 0.225, y1: 0.690, count: 16 },
      { id: 'sur', zona: 'B', x0: 0.158, y0: 0.770, x1: 0.840, y1: 0.800, count: 34 },
      { id: 'este', zona: 'B', x0: 0.740, y0: 0.300, x1: 0.772, y1: 0.620, count: 10 },
    ],
  },
];

// Genera las plazas con su geometría en fracciones, replicando exactamente el
// reparto usado para validar el calce sobre el plano.
export function buildStalls(): Stall[] {
  const PAD = 0.12;
  const out: Stall[] = [];
  for (const fp of FLOOR_PLANS) {
    let num = 0;
    for (const b of fp.bands) {
      const horiz = Math.abs(b.x1 - b.x0) >= Math.abs(b.y1 - b.y0);
      for (let i = 0; i < b.count; i++) {
        const t0 = i / b.count;
        const t1 = (i + 1) / b.count;
        let x: number;
        let y: number;
        let w: number;
        let h: number;
        if (horiz) {
          const cx0 = b.x0 + (b.x1 - b.x0) * (t0 + PAD / b.count);
          const cx1 = b.x0 + (b.x1 - b.x0) * (t1 - PAD / b.count);
          x = cx0;
          w = cx1 - cx0;
          y = Math.min(b.y0, b.y1);
          h = Math.abs(b.y1 - b.y0);
        } else {
          const cy0 = b.y0 + (b.y1 - b.y0) * (t0 + PAD / b.count);
          const cy1 = b.y0 + (b.y1 - b.y0) * (t1 - PAD / b.count);
          y = cy0;
          h = cy1 - cy0;
          x = Math.min(b.x0, b.x1);
          w = Math.abs(b.x1 - b.x0);
        }
        num += 1;
        out.push({ id: `${fp.piso}-${b.id}-${String(i + 1).padStart(2, '0')}`, piso: fp.piso, zona: b.zona, num, x, y, w, h });
      }
    }
  }
  return out;
}

// Metadatos estáticos de cada plano (imagen y proporción). La geometría de las
// plazas es editable y vive en la base de datos; esto no.
export function floorPlanMeta() {
  return FLOOR_PLANS.map((fp) => ({ piso: fp.piso, plan: fp.plan, aspect: fp.aspect }));
}

// Geometría que consume el frontend para dibujar el overlay.
export function croquisFloors() {
  const stalls = buildStalls();
  return FLOOR_PLANS.map((fp) => ({
    piso: fp.piso,
    plan: fp.plan,
    aspect: fp.aspect,
    stalls: stalls.filter((s) => s.piso === fp.piso).map((s) => ({ id: s.id, x: s.x, y: s.y, w: s.w, h: s.h, zona: s.zona })),
  }));
}
