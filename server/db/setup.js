require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function setupDb() {
  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;

  if (!host || !user || !database) {
    throw new Error('Missing DB_HOST, DB_USER, or DB_NAME in environment');
  }

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  const adminConn = await mysql.createConnection({ host, port, user, password, multipleStatements: true });
  await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
  await adminConn.end();

  const dbConn = await mysql.createConnection({ host, port, user, password, database, multipleStatements: true });
  await dbConn.query('SET FOREIGN_KEY_CHECKS=0;');
  await dbConn.query(schemaSql);
  await dbConn.query('SET FOREIGN_KEY_CHECKS=1;');
  await dbConn.end();

  console.log(`Database setup complete for '${database}'.`);
}

setupDb().catch((error) => {
  console.error('DB setup failed:', error.message);
  process.exit(1);
});
