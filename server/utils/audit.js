import { query } from '../db.js';

const UUID_V4_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toNullableUuid = (value) => {
  if (!value) {
    return null;
  }
  const text = String(value).trim();
  return UUID_V4_LIKE.test(text) ? text : null;
};

export const logAudit = async ({
  actorPrincipalId,
  action,
  resourceType,
  resourceId = null,
  metadata = {}
}) => {
  try {
    await query(
      `
        INSERT INTO audit_logs (actor_principal_id, action, resource_type, resource_id, metadata)
        VALUES ($1, $2, $3, $4, $5::jsonb)
      `,
      [
        toNullableUuid(actorPrincipalId),
        action,
        resourceType,
        toNullableUuid(resourceId),
        JSON.stringify(metadata || {})
      ]
    );
  } catch (error) {
    // Audit should never break the primary request path.
    console.warn('Audit logging failed:', error?.message || error);
  }
};
