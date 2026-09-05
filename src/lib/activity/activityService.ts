import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type {
  UserActivityAction,
  UserActivityEntityType,
} from "@/lib/db/defaults";

export type RecordUserActivityInput = {
  organizationId: string;
  actorUserId: string;
  action: UserActivityAction;
  entityType: UserActivityEntityType;
  entityId?: string | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
};

/**
 * Persist a user-driven write for the dashboard activity feed.
 * Fire-and-forget safe: failures are logged, never thrown to callers.
 */
export async function recordUserActivity(
  input: RecordUserActivityInput,
): Promise<void> {
  try {
    await prisma.userActivity.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        metadata: input.metadata ?? undefined,
      },
    });
  } catch (error) {
    console.error("[userActivity] failed to record", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      error,
    });
  }
}
