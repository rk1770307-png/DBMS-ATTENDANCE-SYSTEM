const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: (process.env.MYSQL_PASSWORD === 'root@123' ? 'root123' : (process.env.MYSQL_PASSWORD || 'root123')),
  database: process.env.MYSQL_DATABASE || 'amms',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  multipleStatements: true,
  dateStrings: true
};

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(DB_CONFIG);
  }
  return pool;
}

/**
 * Normalizes query string from PostgreSQL style ($1, $2) to MySQL style (?)
 */
function normalizeQuery(sql) {
  // Convert $1, $2 placeholders to ?
  return sql.replace(/\$(\d+)/g, '?');
}

/**
 * Execute query against MySQL pool
 */
async function query(sql, params = []) {
  const p = getPool();
  const normalizedSql = normalizeQuery(sql);
  const [rows, fields] = await p.query(normalizedSql, params);
  return { rows, fields };
}

/**
 * Execute raw batch SQL
 */
async function exec(sql) {
  const p = getPool();
  const [result] = await p.query(sql);
  return result;
}

/**
 * Programmatic transaction wrapper (START TRANSACTION ... COMMIT / ROLLBACK)
 */
async function withTransaction(callback) {
  const p = getPool();
  const connection = await p.getConnection();
  await connection.beginTransaction();
  
  // Create connection-bound query wrapper
  const connWrapper = {
    query: async (sql, params = []) => {
      const normalizedSql = normalizeQuery(sql);
      const [rows, fields] = await connection.query(normalizedSql, params);
      return { rows, fields };
    }
  };

  try {
    const result = await callback(connWrapper);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  getPool,
  query,
  exec,
  withTransaction,
  DB_CONFIG
};
