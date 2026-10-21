const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const path = require('path');

const DB_DATA_DIR = path.join(__dirname, '..', 'data', 'pgdata');

async function initializeDatabase(options = { loadSeed: true, verbose: true }) {
  if (options.verbose) {
    console.log('Initializing PostgreSQL database at:', DB_DATA_DIR);
  }
  
  // Create or load persistent PGlite database
  const db = new PGlite(DB_DATA_DIR);
  
  // Read and execute schema
  const schemaPath = path.join(__dirname, '..', 'database', '01_schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  
  if (options.verbose) console.log('Executing 01_schema.sql...');
  await db.exec(schemaSql);
  if (options.verbose) console.log('✓ Schema applied successfully.');

  if (options.loadSeed) {
    const seedPath = path.join(__dirname, '..', 'database', '02_seed_data.sql');
    if (fs.existsSync(seedPath)) {
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      if (options.verbose) console.log('Executing 02_seed_data.sql...');
      await db.exec(seedSql);
      if (options.verbose) console.log('✓ Seed data loaded successfully.');
    }

    const viewsPath = path.join(__dirname, '..', 'database', '03_queries_and_views.sql');
    if (fs.existsSync(viewsPath)) {
      const viewsSql = fs.readFileSync(viewsPath, 'utf8');
      if (options.verbose) console.log('Executing 03_queries_and_views.sql...');
      await db.exec(viewsSql);
      if (options.verbose) console.log('✓ Views and analytical queries executed successfully.');
    }
  }

  // Check table count
  const tablesRes = await db.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  
  if (options.verbose) {
    console.log(`✓ Total tables created: ${tablesRes.rows.length}`);
    tablesRes.rows.forEach(r => console.log(`   - ${r.table_name}`));
  }

  return db;
}

if (require.main === module) {
  initializeDatabase({ loadSeed: true, verbose: true })
    .then(() => {
      console.log('Database initialization and seeding successfully completed!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Database initialization failed:', err);
      process.exit(1);
    });
}

module.exports = { initializeDatabase, DB_DATA_DIR };
