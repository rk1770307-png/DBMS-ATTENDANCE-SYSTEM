const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const DB_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: (process.env.MYSQL_PASSWORD === 'root@123' ? 'root123' : (process.env.MYSQL_PASSWORD || 'root123')),
  multipleStatements: true
};

async function initializeMySQL(options = { loadSeed: true, verbose: true }) {
  if (options.verbose) {
    console.log('Connecting to MySQL at:', `${DB_CONFIG.host}:${DB_CONFIG.port}`);
  }

  const conn = await mysql.createConnection(DB_CONFIG);

  // 1. Ensure database exists
  await conn.query('CREATE DATABASE IF NOT EXISTS amms;');
  await conn.changeUser({ database: 'amms' });
  if (options.verbose) console.log('✓ Database `amms` selected.');

  // 2. Read and apply schema
  const schemaPath = path.join(__dirname, '..', 'database', '01_schema_mysql.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  if (options.verbose) console.log('Executing 01_schema_mysql.sql...');
  
  // Strip DELIMITER statements for mysql2 execution
  const cleanSchemaSql = schemaSql
    .replace(/DELIMITER \$\$/g, '')
    .replace(/DELIMITER ;/g, '')
    .replace(/\$\$/g, ';');
  
  await conn.query(cleanSchemaSql);
  if (options.verbose) console.log('✓ MySQL 3NF Schema and trigger applied successfully.');

  // 3. Read and apply seed data
  if (options.loadSeed) {
    const seedPath = path.join(__dirname, '..', 'database', '02_seed_data_mysql.sql');
    if (fs.existsSync(seedPath)) {
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      if (options.verbose) console.log('Executing 02_seed_data_mysql.sql...');
      await conn.query(seedSql);
      if (options.verbose) console.log('✓ Academic seed dataset loaded successfully into MySQL.');
    }

    const viewsPath = path.join(__dirname, '..', 'database', '03_queries_and_views_mysql.sql');
    if (fs.existsSync(viewsPath)) {
      const viewsSql = fs.readFileSync(viewsPath, 'utf8');
      if (options.verbose) console.log('Executing 03_queries_and_views_mysql.sql...');
      await conn.query(viewsSql);
      if (options.verbose) console.log('✓ Views and analytical queries executed successfully.');
    }
  }

  // Count tables
  const [tables] = await conn.query('SHOW FULL TABLES IN amms WHERE Table_type = "BASE TABLE";');
  const [views] = await conn.query('SHOW FULL TABLES IN amms WHERE Table_type = "VIEW";');
  
  if (options.verbose) {
    console.log(`✓ Total Base Tables: ${tables.length}`);
    tables.forEach(t => console.log(`   - ${Object.values(t)[0]}`));
    console.log(`✓ Total Analytical Views: ${views.length}`);
    views.forEach(v => console.log(`   - ${Object.values(v)[0]}`));
  }

  await conn.end();
}

if (require.main === module) {
  initializeMySQL({ loadSeed: true, verbose: true })
    .then(() => {
      console.log('\nMySQL Database initialization and seeding completed successfully!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('MySQL database initialization failed:');
      console.error('Code:', err.code);
      console.error('SQL Message:', err.sqlMessage);
      console.error('SQL State:', err.sqlState);
      process.exit(1);
    });
}

module.exports = { initializeMySQL, DB_CONFIG };
