import "server-only";

import type {
  Role,
  User,
  Warehouse,
  WarehouseMembership,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { WmsClaims } from "@/lib/auth/wmsClaims";

export type ProvisionedSession = {
  user: User;
  warehouse: Warehouse;
  role: Role;
  membership: WarehouseMembership;
  claims: WmsClaims;
};

export type SessionJson = {
  user: {
    id: string;
    firebaseUid: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
  };
  warehouse: {
    id: string;
    name: string;
  };
  role: {
    code: string;
    name: string;
  };
};

export class SessionLookupError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "SessionLookupError";
    this.code = code;
    this.status = status;
  }
}

export async function getProvisionedSession(
  firebaseUid: string,
): Promise<ProvisionedSession> {
  const user = await prisma.user.findUnique({
    where: { firebaseUid },
    include: {
      memberships: {
        include: { warehouse: true, role: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user) {
    throw new SessionLookupError(
      "USER_NOT_PROVISIONED",
      "User is not provisioned",
      401,
    );
  }

  const membership = user.memberships[0];
  if (!membership) {
    throw new SessionLookupError(
      "NO_MEMBERSHIP",
      "No warehouse membership for this user",
      403,
    );
  }

  const claims: WmsClaims = {};
  for (const row of user.memberships) {
    claims[row.warehouseId] = row.role.code;
  }

  return {
    user,
    warehouse: membership.warehouse,
    role: membership.role,
    membership,
    claims,
  };
}

export function toSessionJson(session: {
  user: User;
  warehouse: Warehouse;
  role: Role;
}): SessionJson {
  return {
    user: {
      id: session.user.id,
      firebaseUid: session.user.firebaseUid,
      email: session.user.email,
      createdAt: session.user.createdAt,
      updatedAt: session.user.updatedAt,
    },
    warehouse: {
      id: session.warehouse.id,
      name: session.warehouse.name,
    },
    role: {
      code: session.role.code,
      name: session.role.name,
    },
  };
}
