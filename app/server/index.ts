import fs from 'fs';
import { env } from './config/env';
import { DATA_DIR } from './config/constants';
import { createApp } from './app';
import { ensureUsuariosSchema } from './modules/usuarios/usuarios.schema';
import { ensureParqueoSchema } from './modules/parqueo/parqueo.schema';
import { ensureEntradasSchema } from './modules/entradas/entradas.schema';
import { ensureJugadoresSchema } from './modules/jugadores/jugadores.schema';
import { ensureNoticiasSchema } from './modules/noticias/noticias.schema';
import { ensurePartidosSchema } from './modules/partidos/partidos.schema';
import { ensureSponsorsSchema } from './modules/sponsors/sponsors.schema';
import { ensureContactoSchema } from './modules/contacto/contacto.schema';
import { ensureCuponeraSchema } from './modules/cuponera/cuponera.schema';
import { ensureRestaurantesSchema } from './modules/restaurantes/restaurantes.schema';
import { ensureVenuesSchema } from './modules/venues/venues.schema';

async function bootstrap(): Promise<void> {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  await ensureUsuariosSchema();
  await ensureParqueoSchema();
  await ensureEntradasSchema();
  await ensureJugadoresSchema();
  await ensureNoticiasSchema();
  await ensurePartidosSchema();
  await ensureSponsorsSchema();
  await ensureCuponeraSchema();
  await ensureContactoSchema();
  await ensureRestaurantesSchema();
  await ensureVenuesSchema();

  const app = createApp();
  app.listen(env.PORT, env.HOST, () => console.log(`Herediano React + PostgreSQL corriendo en http://${env.HOST}:${env.PORT}`));
}

bootstrap().catch((err) => {
  console.error('No se pudo inicializar:', err);
  process.exit(1);
});
