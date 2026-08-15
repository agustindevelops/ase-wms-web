import "server-only";

import type {
  Organization,
  OrganizationMembership,
  Role,
  User,
  Warehouse,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type ProvisionedSession = {
  user: User;
  organization: Organization;
  role: Role;
  membership: OrganizationMembership;
  warehouses: Pick<Warehouse, "id" | "name">[];
  organizationId: string;
};

export type SessionJson = {
  user: {
    id: string;
    firebaseUid: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  role: {
    code: string;
    name: string;
  };
  warehouses: {
    id: string;
    name: string;
  }[];
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
      membership: {
        include: { organization: true, role: true },
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

  const membership = user.membership;
  if (!membership) {
    throw new SessionLookupError(
      "NO_MEMBERSHIP",
      "No organization membership for this user",
      403,
    );
  }

  const warehouses = await prisma.warehouse.findMany({
    where: { organizationId: membership.organizationId },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  return {
    user,
    organization: membership.organization,
    role: membership.role,
    membership,
    warehouses,
    organizationId: membership.organizationId,
  };
}

export function toSessionJson(session: {
  user: User;
  organization: Organization;
  role: Role;
  warehouses: Pick<Warehouse, "id" | "name">[];
}): SessionJson {
  return {
    user: {
      id: session.user.id,
      firebaseUid: session.user.firebaseUid,
      email: session.user.email,
      createdAt: session.user.createdAt,
      updatedAt: session.user.updatedAt,
    },
    organization: {
      id: session.organization.id,
      name: session.organization.name,
      slug: session.organization.slug,
    },
    role: {
      code: session.role.code,
      name: session.role.name,
    },
    warehouses: session.warehouses.map((warehouse) => ({
      id: warehouse.id,
      name: warehouse.name,
    })),
  };
}
