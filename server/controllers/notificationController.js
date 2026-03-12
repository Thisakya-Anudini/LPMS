import { query } from '../db.js';
import { sendError } from '../utils/http.js';

const resolvePrincipalId = async (user) => {
  if (user.authSource !== 'MOCK_LEARNER') {
    return user.id;
  }

  if (!user.employeeNo) {
    return null;
  }

  const result = await query(
    `
      SELECT principal_id
      FROM employees
      WHERE employee_number = $1
      LIMIT 1
    `,
    [String(user.employeeNo).trim()]
  );

  return result.rows[0]?.principal_id || null;
};

export const getMyNotifications = async (req, res) => {
  const principalId = await resolvePrincipalId(req.user);
  if (!principalId) {
    return res.status(200).json({ notifications: [] });
  }

  const result = await query(
    `
      SELECT id, title, message, type, is_read, created_at
      FROM notifications
      WHERE principal_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `,
    [principalId]
  );

  return res.status(200).json({ notifications: result.rows });
};

export const markNotificationAsRead = async (req, res) => {
  const principalId = await resolvePrincipalId(req.user);
  if (!principalId) {
    return sendError(res, 404, 'NOT_FOUND', 'Notification not found.');
  }

  const { id } = req.params;
  const result = await query(
    `
      UPDATE notifications
      SET is_read = TRUE
      WHERE id = $1
        AND principal_id = $2
      RETURNING id, is_read
    `,
    [id, principalId]
  );

  if (result.rowCount === 0) {
    return sendError(res, 404, 'NOT_FOUND', 'Notification not found.');
  }

  return res.status(200).json({ notification: result.rows[0] });
};

export const markAllNotificationsAsRead = async (req, res) => {
  const principalId = await resolvePrincipalId(req.user);
  if (!principalId) {
    return res.status(200).json({ success: true, updatedCount: 0 });
  }

  const result = await query(
    `
      UPDATE notifications
      SET is_read = TRUE
      WHERE principal_id = $1
        AND is_read = FALSE
    `,
    [principalId]
  );

  return res.status(200).json({ success: true, updatedCount: result.rowCount });
};

