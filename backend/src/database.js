import 'dotenv/config';
import mysql from 'mysql2/promise';

const databaseName = process.env.DB_NAME || 'kecamatan_db';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: databaseName,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  charset: 'utf8mb4'
});

export async function initializeDatabase() {
  await pool.query('SELECT 1');

  const requiredTables = ['users', 'news', 'public_documents'];
  const [tableRows] = await pool.query(
    `SELECT TABLE_NAME
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?`,
    [databaseName]
  );
  const availableTables = new Set(tableRows.map((row) => row.TABLE_NAME));
  const missingTables = requiredTables.filter((table) => !availableTables.has(table));

  if (missingTables.length) {
    throw new Error(`Tabel wajib belum tersedia: ${missingTables.join(', ')}`);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS survey_responses (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      respondent_name VARCHAR(160) NULL,
      service_type VARCHAR(180) NOT NULL,
      overall_rating TINYINT UNSIGNED NOT NULL,
      ease_rating TINYINT UNSIGNED NOT NULL,
      speed_rating TINYINT UNSIGNED NOT NULL,
      staff_rating TINYINT UNSIGNED NOT NULL,
      feedback TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_survey_created_at (created_at),
      INDEX idx_survey_service_type (service_type),
      CONSTRAINT chk_survey_overall_rating CHECK (overall_rating BETWEEN 1 AND 5),
      CONSTRAINT chk_survey_ease_rating CHECK (ease_rating BETWEEN 1 AND 5),
      CONSTRAINT chk_survey_speed_rating CHECK (speed_rating BETWEEN 1 AND 5),
      CONSTRAINT chk_survey_staff_rating CHECK (staff_rating BETWEEN 1 AND 5)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
}

export { databaseName };
