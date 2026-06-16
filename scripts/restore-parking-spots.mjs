import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const PLAN_ASPECT = 1700 / 1134;
const STALL_LONG_RATIO = 2.22;
const STALL_SHORT_W = 0.0145;
const STALL_SHORT_H = STALL_SHORT_W * PLAN_ASPECT;
const SIZE = {
  vertical: { w: STALL_SHORT_W, h: STALL_SHORT_H * STALL_LONG_RATIO },
  horizontal: { w: STALL_SHORT_W * STALL_LONG_RATIO, h: STALL_SHORT_H },
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function addRow(out, floor, zone, count, x0, x1, y, shape) {
  const size = SIZE[shape];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    out.push({ floor, zone, x: lerp(x0, x1, t), y, ...size });
  }
}

function addColumn(out, floor, zone, count, x, y0, y1, shape) {
  const size = SIZE[shape];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    out.push({ floor, zone, x, y: lerp(y0, y1, t), ...size });
  }
}

function addPoint(out, floor, zone, x, y, shape) {
  out.push({ floor, zone, x, y, ...SIZE[shape] });
}

function buildSpots() {
  const spots = [];

  // Sotano -1: calibrated from the green-box reference screenshot.
  addRow(spots, 1, 'A', 33, 0.257, 0.890, 0.136, 'vertical');
  addRow(spots, 1, 'A', 29, 0.221, 0.767, 0.206, 'vertical');
  addColumn(spots, 1, 'A', 18, 0.121, 0.242, 0.670, 'horizontal');
  addColumn(spots, 1, 'A', 16, 0.172, 0.236, 0.641, 'horizontal');
  addColumn(spots, 1, 'A', 8, 0.220, 0.516, 0.694, 'horizontal');
  addColumn(spots, 1, 'B', 14, 0.767, 0.392, 0.681, 'horizontal');
  addColumn(spots, 1, 'B', 12, 0.890, 0.392, 0.663, 'horizontal');
  addPoint(spots, 1, 'B', 0.558, 0.130, 'horizontal');
  addPoint(spots, 1, 'B', 0.604, 0.132, 'horizontal');

  // Sotano -2: same measured stall size, populated from the drawing bands.
  addRow(spots, 2, 'A', 34, 0.158, 0.840, 0.136, 'vertical');
  addColumn(spots, 2, 'A', 18, 0.121, 0.242, 0.670, 'horizontal');
  addColumn(spots, 2, 'A', 16, 0.172, 0.236, 0.641, 'horizontal');
  addRow(spots, 2, 'B', 34, 0.158, 0.840, 0.785, 'vertical');
  addColumn(spots, 2, 'B', 10, 0.767, 0.392, 0.663, 'horizontal');

  return spots;
}

function nextId(index) {
  return `P-${String(index + 1).padStart(4, '0')}`;
}

async function main() {
  if (!process.argv.includes('--force')) {
    throw new Error('Use --force para reemplazar el croquis actual.');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no esta configurado.');
  }

  const spots = buildSpots();
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('begin');
    await client.query('delete from parking_reservations');
    await client.query('delete from parking_spaces');
    for (let i = 0; i < spots.length; i += 1) {
      const spot = spots[i];
      const id = nextId(i);
      const num = spots.filter((item, idx) => idx <= i && item.floor === spot.floor).length;
      await client.query(
        `
          insert into parking_spaces
            (id, floor, zone, num, type, status, reservation_id, pos_x, pos_y, utilizado, name, spot_width, spot_height, accessible)
          values
            ($1,$2,$3,$4,'regular','disponible',null,$5,$6,true,null,$7,$8,false)
        `,
        [id, spot.floor, spot.zone, num, spot.x, spot.y, spot.w, spot.h],
      );
    }
    await client.query('commit');
    console.log(`Restauradas ${spots.length} plazas: ${spots.filter((s) => s.floor === 1).length} en Sotano -1 y ${spots.filter((s) => s.floor === 2).length} en Sotano -2.`);
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
