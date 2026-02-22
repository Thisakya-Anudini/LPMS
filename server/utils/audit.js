import { query } from '../db.js';

export const logAudit = async ({
  actorPrincipalId,
  action,
  resourceType,
  resourceId = null,
  metadata = {}
}) => {
  await query(
    `
      INSERT INTO audit_logs (actor_principal_id, action, resource_type, resource_id, metadata)
      VALUES ($1, $2, $3, $4, $5::jsonb)
    `,
    [actorPrincipalId, action, resourceType, resourceId, JSON.stringify(metadata)]
  );
};
