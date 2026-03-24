#!/usr/bin/env node
/**
 * Migration script — exécute la migration SQL sur Supabase.
 *
 * Usage :
 *   node scripts/migrate.js <DB_PASSWORD>
 *
 * Le DB_PASSWORD est dans :
 *   Supabase Dashboard > Project Settings > Database > Password
 *
 * Ce script installe temporairement 'pg' si nécessaire.
 */

const { execSync, spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Extrait le project ref depuis NEXT_PUBLIC_SUPABASE_URL (ex: https://xxxx.supabase.co)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const PROJECT_REF = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1]
if (!PROJECT_REF) {
  console.error('Erreur: NEXT_PUBLIC_SUPABASE_URL manquant ou invalide dans .env.local')
  process.exit(1)
}
const DB_HOST = `db.${PROJECT_REF}.supabase.co`
const DB_PORT = 5432
const DB_NAME = 'postgres'
const DB_USER = 'postgres'

const password = process.argv[2]
if (!password) {
  console.error('Usage: node scripts/migrate.js <DB_PASSWORD>')
  console.error('')
  console.error('Trouvez votre DB_PASSWORD dans :')
  console.error(`  https://supabase.com/dashboard/project/${PROJECT_REF || '<ref>'}/settings/database`)
  process.exit(1)
}

// Install pg if not already installed
try {
  require.resolve('pg')
} catch {
  console.log('Installation de pg...')
  execSync('npm install --no-save pg', { stdio: 'inherit' })
}

const { Client } = require('pg')

const SQL_FILE = path.join(__dirname, '..', 'supabase', 'migrations', '20240101000000_init_schema.sql')
const sql = fs.readFileSync(SQL_FILE, 'utf8')

;(async () => {
  const client = new Client({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password,
    ssl: { rejectUnauthorized: false },
  })

  try {
    console.log(`Connexion à ${DB_HOST}...`)
    await client.connect()
    console.log('Connecté. Exécution de la migration...')

    await client.query(sql)
    console.log('Migration executee avec succes!')

    // Verify tables
    const res = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `)
    console.log('\nTables créées :')
    res.rows.forEach(r => console.log('  -', r.table_name))

    // Verify buckets
    const buckets = await client.query(`SELECT id, name, public FROM storage.buckets ORDER BY name;`)
    console.log('\nStorage buckets :')
    buckets.rows.forEach(r => console.log(`  - ${r.name} (public=${r.public})`))

  } catch (err) {
    if (err.message?.includes('already exists')) {
      console.log('Tables déjà existantes — migration ignorée.')
    } else {
      console.error('Erreur:', err.message)
      process.exit(1)
    }
  } finally {
    await client.end()
  }
})()
