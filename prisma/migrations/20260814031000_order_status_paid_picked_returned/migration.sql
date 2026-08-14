-- Collapse order statuses to PAID, PICKED_UP, RETURNED.

INSERT INTO "OrderStatus" ("id", "code", "name")
VALUES
  ('os_paid', 'PAID', 'Paid'),
  ('os_picked_up', 'PICKED_UP', 'Picked up'),
  ('os_returned', 'RETURNED', 'Returned')
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name";

UPDATE "EventOrder" AS o
SET "statusId" = (SELECT "id" FROM "OrderStatus" WHERE "code" = 'PAID')
FROM "OrderStatus" AS s
WHERE o."statusId" = s."id"
  AND s."code" IN ('PAYMENT_PENDING', 'SETUP_INPROGRESS');

UPDATE "EventOrder" AS o
SET "statusId" = (SELECT "id" FROM "OrderStatus" WHERE "code" = 'PICKED_UP')
FROM "OrderStatus" AS s
WHERE o."statusId" = s."id"
  AND s."code" IN ('SETUP_FULFILLED', 'TEARDOWN_STARTED');

UPDATE "EventOrder" AS o
SET "statusId" = (SELECT "id" FROM "OrderStatus" WHERE "code" = 'RETURNED')
FROM "OrderStatus" AS s
WHERE o."statusId" = s."id"
  AND s."code" = 'COMPLETE';

DELETE FROM "OrderStatus"
WHERE "code" IN (
  'PAYMENT_PENDING',
  'SETUP_INPROGRESS',
  'SETUP_FULFILLED',
  'TEARDOWN_STARTED',
  'COMPLETE'
);
