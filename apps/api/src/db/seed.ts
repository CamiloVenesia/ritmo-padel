import bcrypt from 'bcryptjs';
import { pool, query } from '../lib/db.js';
import { migrate } from './migrate.js';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';

const courts = [
  ['arena', 'ARENA 01', 'La central', 'Césped WPT', 'Indoor · Planta baja', 'lime', ['Panorámica', 'Indoor', 'Iluminación LED'], 2200000, 2800000, 1],
  ['pulse', 'PULSE 02', 'La eléctrica', 'Césped Mondo', 'Indoor · Planta baja', 'teal', ['Panorámica', 'Indoor', 'Premium'], 2200000, 2800000, 2],
  ['terra', 'TERRA 03', 'El clásico', 'Césped sintético', 'Outdoor · Patio norte', 'amber', ['Outdoor', 'Vestuarios', 'Clásica'], 1800000, 2300000, 3],
  ['sky', 'SKY 04', 'Bajo las estrellas', 'Césped Mondo', 'Outdoor · Terraza', 'blue', ['Outdoor', 'Panorámica', 'Premium'], 2400000, 3000000, 4]
];

async function seed() {
  await migrate();
  for (const row of courts) await query(`INSERT INTO courts (slug,name,subtitle,surface,location_label,accent,features,base_price_cents,peak_price_cents,sort_order)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(slug) DO NOTHING`, row);
  if (config.NODE_ENV !== 'production') {
    const hash = await bcrypt.hash('DemoClub2026!', 12);
    await query(`INSERT INTO app_users(full_name,email,password_hash,role) VALUES
      ('Sofi Demo','jugador@ritmopadel.test',$1,'player'),
      ('Equipo RITMO','admin@ritmopadel.test',$1,'admin') ON CONFLICT(email) DO NOTHING`, [hash]);
    logger.info('Usuarios locales: jugador@ritmopadel.test / admin@ritmopadel.test (clave DemoClub2026!)');
  }
  logger.info('4 canchas de demostración disponibles');
}
seed().then(() => pool.end()).catch(async err => { logger.error({ err }, 'Seed failed'); await pool.end(); process.exitCode = 1; });
