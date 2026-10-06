import "server-only";

import {
  ORDER_STATUS_PAYMENT_PENDING,
  ORDER_STATUS_PAYMENT_PROCESSED,
} from "@/lib/db/defaults";
import { prisma } from "@/lib/db/prisma";
import { OrderServiceError } from "@/lib/order/errors";
import {
  asNonNegativeInt,
  asOptionalEventDate,
  asOptionalTime,
  asRequiredString,
  parseAddress,
  parseClientTableDetails,
  parseContact,
  parseOrderDetails,
  parseUploads,
  type AddressInput,
  type ClientTableDetailsInput,
  type ContactInput,
  type OrderDetailsInput,
  type OrderUploadInput,
} from "@/lib/order/orderFields";
import { copyPackageItemsToOrder } from "@/lib/order/orderService";

export type PublicOrderInput = {
  packageId: string;
  contact: ContactInput;
  address: AddressInput;
  guestCount: number;
  eventDate: Date;
  eventStartTime: Date;
  eventEndTime: Date;
  quote: number;
  details: OrderDetailsInput;
  clientTableDetails: ClientTableDetailsInput | null;
  uploads: OrderUploadInput[];
};

function required<T>(value: T | null, field: string): T {
  if (value === null) {
    throw new OrderServiceError("Bad Request", `${field} is required`);
  }
  return value;
}

/**
 * Customer-site intake body. Pricing rules live on the customer site; `quote`
 * (cents) is stored as sent.
 */
export function parsePublicOrderInput(
  body: Record<string, unknown>,
): PublicOrderInput {
  return {
    packageId: asRequiredString(body.packageId, "packageId"),
    contact: parseContact(body.contact),
    address: parseAddress(body.address),
    guestCount: asNonNegativeInt(body.guestCount, "guestCount"),
    eventDate: required(asOptionalEventDate(body.eventDate), "eventDate"),
    eventStartTime: required(
      asOptionalTime(body.eventStartTime, "eventStartTime"),
      "eventStartTime",
    ),
    eventEndTime: required(
      asOptionalTime(body.eventEndTime, "eventEndTime"),
      "eventEndTime",
    ),
    quote: asNonNegativeInt(body.quote, "quote"),
    details: parseOrderDetails(body.details, { requireWindows: true }),
    clientTableDetails:
      body.clientTableDetails === undefined || body.clientTableDetails === null
        ? null
        : parseClientTableDetails(body.clientTableDetails),
    uploads: parseUploads(body.uploads),
  };
}

export async function createPublicOrder(
  organizationId: string,
  input: PublicOrderInput,
) {
  const status = await prisma.orderStatus.findUnique({
    where: { code: ORDER_STATUS_PAYMENT_PENDING },
  });
  if (!status) {
    throw new OrderServiceError(
      "ORDER_STATUS_MISSING",
      "PAYMENT_PENDING status is not seeded",
      500,
    );
  }

  return prisma.$transaction(async (tx) => {
    const contact = await tx.contact.create({
      data: { organizationId, ...input.contact },
    });
    const address = await tx.address.create({
      data: { organizationId, ...input.address },
    });
    const order = await tx.eventOrder.create({
      data: {
        organizationId,
        name: `${input.contact.firstName} ${input.contact.lastName} · ${input.eventDate
          .toISOString()
          .slice(0, 10)}`,
        eventDate: input.eventDate,
        eventStartTime: input.eventStartTime,
        eventEndTime: input.eventEndTime,
        guestCount: input.guestCount,
        quote: input.quote,
        statusId: status.id,
        contactId: contact.id,
        addressId: address.id,
      },
    });
    await tx.orderDetails.create({
      data: { organizationId, orderId: order.id, ...input.details },
    });
    if (input.clientTableDetails) {
      await tx.clientTableDetails.create({
        data: { organizationId, orderId: order.id, ...input.clientTableDetails },
      });
    }
    if (input.uploads.length > 0) {
      await tx.orderUpload.createMany({
        data: input.uploads.map((upload) => ({
          organizationId,
          orderId: order.id,
          ...upload,
        })),
      });
    }
    await copyPackageItemsToOrder(
      tx,
      organizationId,
      order.id,
      input.packageId,
      1,
    );

    return {
      id: order.id,
      status: ORDER_STATUS_PAYMENT_PENDING,
      quote: order.quote,
    };
  });
}

/**
 * Stripe-confirmed payment. Only PAYMENT_PENDING advances; repeats and other
 * statuses are no-ops so webhook retries stay safe.
 */
export async function markOrderPaymentProcessed(
  organizationId: string,
  orderId: string,
  stripeCheckoutSessionId: string,
): Promise<{ updated: boolean }> {
  const [pending, processed] = await Promise.all([
    prisma.orderStatus.findUnique({
      where: { code: ORDER_STATUS_PAYMENT_PENDING },
    }),
    prisma.orderStatus.findUnique({
      where: { code: ORDER_STATUS_PAYMENT_PROCESSED },
    }),
  ]);
  if (!pending || !processed) {
    throw new OrderServiceError(
      "ORDER_STATUS_MISSING",
      "Payment statuses are not seeded",
      500,
    );
  }

  const result = await prisma.eventOrder.updateMany({
    where: { id: orderId, organizationId, statusId: pending.id },
    data: { statusId: processed.id, stripeCheckoutSessionId },
  });
  return { updated: result.count > 0 };
}
