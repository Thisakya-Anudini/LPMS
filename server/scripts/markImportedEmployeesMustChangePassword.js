import dotenv from 'dotenv';
import pool, { query } from '../db.js';

dotenv.config();

const run = async () => {
  try {
    const updateResult = await query(
      `
        UPDATE auth_principals ap
        SET must_change_password = TRUE,
            updated_at = NOW()
        WHERE ap.role = 'EMPLOYEE'
          AND ap.principal_type = 'EMPLOYEE'
          AND ap.must_change_password = FALSE
          AND EXISTS (
            SELECT 1
            FROM employees e
            WHERE e.principal_id = ap.id
          )
      `
    );

    const countResult = await query(
      `
        SELECT COUNT(*)::int AS total_flagged
        FROM auth_principals ap
        WHERE ap.role = 'EMPLOYEE'
          AND ap.principal_type = 'EMPLOYEE'
          AND ap.must_change_password = TRUE
      `
    );

    console.log(
      JSON.stringify({
        updated: updateResult.rowCount,
        totalFlagged: countResult.rows[0].total_flagged
      })
    );
  } catch (error) {
    console.error('Failed to mark imported employees:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
