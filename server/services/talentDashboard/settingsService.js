import { query } from "../../db.js";

/**
 * Resolves the applicable target hours based on date filters or fiscal year.
 * Preserves historical integrity by picking the target configured for that specific year.
 *
 * @param {string} [startDate]
 * @param {string} [endDate]
 * @param {number} [targetYear]
 * @returns {Promise<number>} Target hours (e.g. 18.0, 20.0, 25.0)
 */
export const getTargetHoursForDateRange = async (startDate, endDate, targetYear) => {
    try {
        let year = targetYear;

        if (!year) {
            if (startDate) {
                year = new Date(startDate).getFullYear();
            } else if (endDate) {
                year = new Date(endDate).getFullYear();
            } else {
                year = new Date().getFullYear();
            }
        }

        // 1. Try exact fiscal year match
        const res = await query(
            `SELECT target_hours FROM talent_target_settings WHERE fiscal_year = $1 LIMIT 1`,
            [year]
        );

        if (res.rows.length > 0) {
            return parseFloat(res.rows[0].target_hours);
        }

        // 2. If no record for a future year, fallback to most recently configured year
        const fallbackRes = await query(
            `SELECT target_hours FROM talent_target_settings ORDER BY fiscal_year DESC LIMIT 1`
        );

        if (fallbackRes.rows.length > 0) {
            return parseFloat(fallbackRes.rows[0].target_hours);
        }

        return 18.0;
    } catch (err) {
        console.error("Error in getTargetHoursForDateRange:", err);
        return 18.0;
    }
};

/**
 * Retrieves all configured fiscal year targets.
 */
export const getAllTargetSettings = async () => {
    const currentYear = new Date().getFullYear();
    const res = await query(
        `SELECT fiscal_year AS "fiscalYear", target_hours AS "targetHours", effective_from AS "effectiveFrom", updated_at AS "updatedAt"
     FROM talent_target_settings 
     ORDER BY fiscal_year ASC;`
    );

    return res.rows.map((row) => ({
        ...row,
        targetHours: parseFloat(row.targetHours),
        isLocked: row.fiscalYear < currentYear,
    }));
};

/**
 * Creates or updates target hours for current or future fiscal years.
 * Rejects retroactive edits to past closed years.
 */
export const upsertTargetSetting = async ({ fiscalYear, targetHours, effectiveFrom, userId }) => {
    const currentYear = new Date().getFullYear();
    const year = parseInt(fiscalYear, 10);
    const hours = parseFloat(targetHours);

    if (isNaN(year) || isNaN(hours) || hours <= 0) {
        throw new Error("Invalid fiscal year or target hours provided.");
    }

    // NON-RETROACTIVE AUDIT LOCK
    if (year < currentYear) {
        throw new Error(
            `Historical fiscal year ${year} is closed and locked. Modifying historical targets is prohibited to preserve past achievement records.`
        );
    }

    const effectiveDate = effectiveFrom || `${year}-01-01`;

    const sql = `
    INSERT INTO talent_target_settings (fiscal_year, target_hours, effective_from, created_by, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (fiscal_year) DO UPDATE SET
      target_hours = EXCLUDED.target_hours,
      effective_from = EXCLUDED.effective_from,
      created_by = EXCLUDED.created_by,
      updated_at = NOW()
    RETURNING fiscal_year AS "fiscalYear", target_hours AS "targetHours", effective_from AS "effectiveFrom", updated_at AS "updatedAt";
  `;

    const res = await query(sql, [year, hours, effectiveDate, userId || null]);
    return {
        ...res.rows[0],
        targetHours: parseFloat(res.rows[0].targetHours),
        isLocked: false,
    };
};