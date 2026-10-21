const mysql = require('mysql2/promise');

const candidates = [
  'root', 'root123', 'root@123', 'Root@123', 'root1234', 'root@1234',
  '', '1234', '12345', '123456', '12345678', '123456789',
  'password', 'admin', 'mysql',
  'rohit', 'rohit123', 'rohit@123', 'Rohit', 'Rohit123', 'Rohit@123', 'Rohit@1234',
  'kukate', 'Kukate', 'rohitkukate', 'RohitKukate', 'root@mysql', 'test'
];

async function testPasswords() {
  for (const pw of candidates) {
    try {
      const conn = await mysql.createConnection({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: pw
      });
      console.log('FOUND_PASSWORD=' + pw);
      await conn.end();
      process.exit(0);
    } catch (err) {
      if (err.code !== 'ER_ACCESS_DENIED_ERROR') {
        console.log('Error other than access denied:', err.message);
      }
    }
  }
  console.log('NO_PASSWORD_MATCH_FOUND');
}

testPasswords();
