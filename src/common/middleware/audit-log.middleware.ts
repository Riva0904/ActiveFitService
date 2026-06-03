import { PrismaClient } from '@prisma/client';
import { Logger } from '@nestjs/common';

const logger = new Logger('AuditLogMiddleware');

/**
 * Prisma middleware that automatically writes an AuditLog entry for every
 * create, update, or delete on the specified models. Attach to PrismaClient
 * by calling `applyAuditLogMiddleware(prisma)` after instantiation.
 *
 * The gymId and userId must be inferable from the record — operations on models
 * without a gymId field are skipped.
 */

const AUDITED_MODELS = new Set([
  'Member', 'MemberSubscription', 'Payment', 'User',
  'MembershipPlan', 'WorkoutPlan', 'DietPlan',
  'Trainer', 'Staff', 'PtSession',
]);

const WRITE_ACTIONS = new Set(['create', 'update', 'delete', 'updateMany', 'deleteMany']);

export function applyAuditLogMiddleware(prisma: PrismaClient) {
  prisma.$use(async (params, next) => {
    if (!AUDITED_MODELS.has(params.model ?? '') || !WRITE_ACTIONS.has(params.action)) {
      return next(params);
    }

    const result = await next(params);

    // Fire-and-forget — audit failure must not break the main operation
    setImmediate(async () => {
      try {
        const gymId = result?.gymId ?? params.args?.data?.gymId ?? params.args?.where?.gymId;
        if (!gymId) return; // skip models without gym context

        await (prisma as any).auditLog.create({
          data: {
            gymId,
            action: `${params.model?.toUpperCase()}_${params.action.toUpperCase()}`,
            entity: params.model,
            entityId: result?.id ?? params.args?.where?.id ?? 'bulk',
            newValues: params.action === 'delete' ? null : (result ?? params.args?.data),
            oldValues: null,
          },
        });
      } catch (err) {
        logger.warn(`AuditLog write failed for ${params.model}.${params.action}: ${err.message}`);
      }
    });

    return result;
  });
}
