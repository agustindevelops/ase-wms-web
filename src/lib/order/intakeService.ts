import "server-only";

import {
  BOOKING_FORM_YOUR_TABLES,
  ORDER_STATUS_PAYMENT_PENDING,
  ORDER_STATUS_PAYMENT_PROCESSED,
} from "@/lib/db/defaults";
import { prisma } from "@/lib/db/prisma";
import {
  calculateAtHomeExperienceQuote,
  isOutsideServiceArea,
  type AccessType,
} from "@/lib/order/atHomeExperience";
import { OrderServiceError } from "@/lib/order/errors";
import { assertEventDateOpen } from "@/lib/order/eventDatesBooked";
import { formatTime } from "@/lib/order/orderFields";
import { copyPackageItemsToOrder } from "@/lib/order/orderService";
import type { PublicOrderInput } from "@/lib/order/publicOrder";
import { assertYourTablesPayload } from "@/lib/order/publicOrder/parseHelpers";
import { isCheckoutSessionPaid } from "@/lib/payment/stripeCheckout";

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
  await assertEventDateOpen(organizationId, input.eventDate);

  const variant = await prisma.packageVariant.findFirst({
    where: {
      id: input.variantId,
      packageId: input.packageId,
      organizationId,
    },
    include: {
      package: { select: { basePriceCents: true } },
      forms: { include: { form: { select: { code: true } } } },
    },
  });
  if (!variant) {
    throw new OrderServiceError(
      "VARIANT_NOT_FOUND",
      "Style variant was not found for this package",
      404,
    );
  }

  const formCodes = variant.forms.map((row) => row.form.code);
  const requiresYourTables = formCodes.includes(BOOKING_FORM_YOUR_TABLES);
  assertYourTablesPayload(
    requiresYourTables,
    input.clientTableDetails,
    input.uploads,
  );

  const quote = calculateAtHomeExperienceQuote({
    guestCount: input.guestCount,
    basePriceCents: variant.package.basePriceCents + variant.priceCents,
    accessType: input.details.accessType as AccessType,
    isLateNightPickup: input.pickupOption === "LATE_NIGHT",
    isOutsideServiceArea: isOutsideServiceArea(input.address),
  });
  const experienceLabel = `${variant.name} · ${input.guestCount} guests`;

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
        quote: quote.quotedTotalCents,
        statusId: status.id,
        contactId: contact.id,
        addressId: address.id,
        packageVariantId: variant.id,
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
    const pkg = await copyPackageItemsToOrder(
      tx,
      organizationId,
      order.id,
      input.packageId,
      1,
    );

    return {
      id: order.id,
      status: ORDER_STATUS_PAYMENT_PENDING,
      quote: quote.quotedTotalCents,
      packageName: pkg.name,
      packageSlug: pkg.slug,
      experienceLabel,
    };
  });
}

export async function attachCheckoutSession(
  organizationId: string,
  orderId: string,
  stripeCheckoutSessionId: string,
) {
  await prisma.eventOrder.update({
    where: { id_organizationId: { id: orderId, organizationId } },
    data: { stripeCheckoutSessionId },
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

/** Customer-safe booking summary for the booked page. No email, phone, notes, or uploads. */
export type PublicBooking = {
  reference: string;
  paid: boolean;
  packageName: string | null;
  firstName: string | null;
  /** YYYY-MM-DD at the event location. */
  eventDate: string | null;
  /** HH:mm wall-clock at the event location. */
  eventStartTime: string | null;
  eventEndTime: string | null;
  guestCount: number | null;
  totalCents: number | null;
  setupStartsAt: string | null;
  setupEndsAt: string | null;
  pickupStartsAt: string | null;
  pickupEndsAt: string | null;
  address: {
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    zipcode: string | null;
  } | null;
};

/**
 * Looks up a public booking by its Stripe Checkout Session id. While the order
 * is still PAYMENT_PENDING, asks Stripe directly so the booked page can show a
 * paid booking before the webhook lands.
 */
export async function getPublicBookingBySession(
  organizationId: string,
  stripeCheckoutSessionId: string,
): Promise<PublicBooking | null> {
  const order = await prisma.eventOrder.findFirst({
    where: { organizationId, stripeCheckoutSessionId },
    include: {
      status: { select: { code: true } },
      package: { select: { name: true } },
      contact: { select: { firstName: true } },
      address: true,
      details: {
        select: {
          setupStartsAt: true,
          setupEndsAt: true,
          pickupStartsAt: true,
          pickupEndsAt: true,
        },
      },
    },
  });
  if (!order) return null;

  let paid = order.status.code !== ORDER_STATUS_PAYMENT_PENDING;
  if (!paid) {
    try {
      if (await isCheckoutSessionPaid(stripeCheckoutSessionId)) {
        await markOrderPaymentProcessed(
          organizationId,
          order.id,
          stripeCheckoutSessionId,
        );
        paid = true;
      }
    } catch (error) {
      console.error("[stripe] could not confirm session", order.id, error);
    }
  }

  const iso = (value: Date | null | undefined) => value?.toISOString() ?? null;
  return {
    reference: order.id,
    paid,
    packageName: order.package?.name ?? null,
    firstName: order.contact?.firstName ?? null,
    eventDate: order.eventDate?.toISOString().slice(0, 10) ?? null,
    eventStartTime: formatTime(order.eventStartTime),
    eventEndTime: formatTime(order.eventEndTime),
    guestCount: order.guestCount,
    totalCents: order.quote,
    setupStartsAt: iso(order.details?.setupStartsAt),
    setupEndsAt: iso(order.details?.setupEndsAt),
    pickupStartsAt: iso(order.details?.pickupStartsAt),
    pickupEndsAt: iso(order.details?.pickupEndsAt),
    address: order.address
      ? {
          addressLine1: order.address.addressLine1,
          addressLine2: order.address.addressLine2,
          city: order.address.city,
          state: order.address.state,
          zipcode: order.address.zipcode,
        }
      : null,
  };
}
