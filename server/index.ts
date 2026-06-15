import fs from 'fs';
import { env } from './config/env';
import { CACHE_DIR, DATA_DIR } from './config/constants';
import { createApp } from './app';
import { ensureUsuariosSchema } from './modules/usuarios/usuarios.schema';
import { ensureParqueoSchema } from './modules/parqueo/parqueo.schema';

async function bootstrap(): Promise<void> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });

  await ensureUsuariosSchema();
  await ensureParqueoSchema();

  const app = createApp();
  app.listen(env.PORT, env.HOST, () => console.log(`Herediano React + PostgreSQL corriendo en http://${env.HOST}:${env.PORT}`));
}

bootstrap().catch((err) => {
  console.error('No se pudo inicializar:', err);
  process.exit(1);
});
