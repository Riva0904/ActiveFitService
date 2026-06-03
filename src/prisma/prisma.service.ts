import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { applyAuditLogMiddleware } from '../common/middleware/audit-log.middleware';

// Models that support soft-delete via deletedAt field
const SOFT_DELETE_MODELS = new Set([
  'user', 'member', 'trainer', 'staff',
  'membershipPlan', 'memberSubscription',
  'workoutPlan', 'dietPlan', 'attendance',
  'payment', 'supplement',
]);

const SOFT_DELETE_ACTIONS = new Set(['findFirst', 'findMany', 'findUnique', 'count', 'aggregate']);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    this.registerSoftDeleteMiddleware();
    applyAuditLogMiddleware(this);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Middleware that automatically appends `deletedAt: null` to every read
   * operation on soft-deletable models. This makes it impossible to accidentally
   * return deleted records without explicitly opting out.
   *
   * To query deleted records intentionally, pass `where: { deletedAt: { not: null } }`.
   */
  private registerSoftDeleteMiddleware() {
    this.$use(async (params, next) => {
      const modelKey = params.model ? params.model.charAt(0).toLowerCase() + params.model.slice(1) : '';

      if (SOFT_DELETE_MODELS.has(modelKey) && SOFT_DELETE_ACTIONS.has(params.action)) {
        const where = params.args?.where ?? {};

        // Only inject if caller hasn't set an explicit deletedAt filter
        if (where.deletedAt === undefined) {
          params.args = { ...params.args, where: { ...where, deletedAt: null } };
        }
      }

      return next(params);
    });
  }
}
