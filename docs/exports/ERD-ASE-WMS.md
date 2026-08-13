# ERD - ASE WMS

**Status:** Draft for MVP Prisma implementation

## Links

* [Project Scope Statement - ASE WMS](https://agustindevelops.atlassian.net/wiki/spaces/ASE/pages/161775617)
* [User journey (Whimsical)](https://whimsical.com/agustin-develops/ase-WJGRSQb6T9TboVZ199jczu)
* Epic: [ASE-1 Warehouse Management Service](https://agustindevelops.atlassian.net/browse/ASE-1)

## Purpose

Relational data model for Aniah Social Events Warehouse Management System (mobile app + web admin). Identity is Firebase Auth; domain data is Prisma + SQL. Images use S3 with CloudFront via sign, PUT, verify.

## System context

\`\`\`
[ase-wms-app] --Firebase ID token--> Next.js API --> Prisma --> SQL
[ase-wms-web] --Firebase ID token--> Next.js API --> S3/CloudFront (presigned PUT + CDN read)
\`\`\`

* No NextAuth for MVP APIs; Bearer Authorization Firebase ID token.
* Prisma client and DATABASE_URL are server-only and never exposed as NEXT_PUBLIC_*.
* Authorization is scoped by warehouse membership, not by a global user role.
* Admin role only for MVP; Staff and finer-grained permissions are deferred.

## User journeys

### Admin web

Login -> View Orders / View Inventory -> Create Order -> Add Items; Edit Inventory can Add Items to Order.

### Main app

Login -> Main Menu -> Catalog | Pickup Order | Return Order | Manage Warehouse | Report Issue.

* **Catalog:** Take Photo -> Name -> QTY/Category -> Print QR -> Glue QR -> Scan Warehouse QR -> Done
* **Pickup:** Select order -> Scan Item x QTY loop until none left
* **Return:** Select order -> Scan Item x QTY -> Scan Warehouse Location and/or Report Issue (Missing/Broken) -> loop
* **Manage Warehouse:** View level N -> Click (drill N+1) | Add | Edit | Delete | Print Label
* **Report Issue (standalone):** Search/Scan item -> Missing / Broken

## Entity relationship diagram

\`\`\`mermaid
erDiagram

    USER {
        string id PK
        string firebaseUid
        string email
        datetime createdAt
        datetime updatedAt
    }

    ROLE {
        string id PK
        string code
        string name
        string description
    }

    ADDRESS {
        string id PK
        string addressLine1
        string addressLine2
        string city
        string state
        string zipcode
        string country
    }

    WAREHOUSE {
        string id PK
        string name
        string addressId FK
        datetime createdAt
        datetime updatedAt
    }

    WAREHOUSE_MEMBERSHIP {
        string id PK
        string warehouseId FK
        string userId FK
        string roleId FK
        datetime createdAt
        datetime updatedAt
    }

    LOCATION_UNIT_TYPE {
        string id PK
        string code
        string name
    }

    LOCATION_TYPE_RELATIONSHIP {
        string id PK
        string parentTypeId FK
        string childTypeId FK
    }

    LOCATION_UNIT {
        string id PK
        string warehouseId FK
        string parentLocationUnitId FK
        string locationUnitTypeId FK
        string name
        string label
        string qrCodeId FK
        datetime createdAt
        datetime updatedAt
    }

    ITEM_CATEGORY {
        string id PK
        string code
        string name
    }

    ITEM {
        string id PK
        string warehouseId FK
        string name
        int quantityOwned
        int quantityAvailable
        string categoryId FK
        string locationUnitId FK
        string qrCodeId FK
        string description
        string material
        decimal unitRentalPrice
        string purchaseLink
        decimal replacementCost
        string condition
        string disposition
        string notes
        datetime createdAt
        datetime updatedAt
    }

    FILE {
        string id PK
        string itemId FK
        string s3Key
        string contentType
        int byteSize
        string status
        datetime signatureExpiration
        string publicUrl
        int sortOrder
        datetime createdAt
        datetime updatedAt
    }

    QR_CODE_TYPE {
        string id PK
        int code
        string name
    }

    QR_CODE {
        string id PK
        string payload
        string typeId FK
        datetime createdAt
    }

    ORDER_STATUS {
        string id PK
        string code
        string name
    }

    EVENT_ORDER {
        string id PK
        string warehouseId FK
        string name
        date eventDate
        string statusId FK
        string createdByUserId FK
        datetime createdAt
        datetime updatedAt
    }

    ORDER_LINE {
        string id PK
        string orderId FK
        string itemId FK
        int qtyRequested
        int qtyPicked
        int qtyReturned
        datetime createdAt
        datetime updatedAt
    }

    ORDER_CHANGE_HISTORY {
        string id PK
        string orderId FK
        string changedByUserId FK
        string action
        string changeData
        datetime createdAt
    }

    ISSUE {
        string id PK
        string type
        string itemId FK
        string orderLineId FK
        int quantity
        string notes
        string createdByUserId FK
        datetime createdAt
        datetime updatedAt
    }

    ADDRESS ||--|| WAREHOUSE : has
    USER ||--o{ WAREHOUSE_MEMBERSHIP : memberships
    WAREHOUSE ||--o{ WAREHOUSE_MEMBERSHIP : members
    ROLE ||--o{ WAREHOUSE_MEMBERSHIP : assigns
    WAREHOUSE ||--o{ LOCATION_UNIT : contains
    WAREHOUSE ||--o{ ITEM : owns
    WAREHOUSE ||--o{ EVENT_ORDER : owns
    LOCATION_UNIT o|--o{ LOCATION_UNIT : contains
    LOCATION_UNIT_TYPE ||--o{ LOCATION_UNIT : types
    LOCATION_UNIT_TYPE ||--o{ LOCATION_TYPE_RELATIONSHIP : parent_type
    LOCATION_UNIT_TYPE ||--o{ LOCATION_TYPE_RELATIONSHIP : child_type
    ITEM_CATEGORY o|--o{ ITEM : classifies
    LOCATION_UNIT o|--o{ ITEM : stores
    ITEM ||--o{ FILE : has_images
    QR_CODE_TYPE ||--o{ QR_CODE : types
    QR_CODE o|--o| ITEM : identifies
    QR_CODE o|--o| LOCATION_UNIT : identifies
    ORDER_STATUS ||--o{ EVENT_ORDER : status
    USER ||--o{ EVENT_ORDER : creates
    EVENT_ORDER ||--o{ ORDER_LINE : contains
    ITEM ||--o{ ORDER_LINE : included_in
    EVENT_ORDER ||--o{ ORDER_CHANGE_HISTORY : history
    USER ||--o{ ORDER_CHANGE_HISTORY : changed_by
    ITEM ||--o{ ISSUE : has
    ORDER_LINE o|--o{ ISSUE : context
    USER ||--o{ ISSUE : reports
\`\`\`

## Lookup / reference seed tables

These tables should be seeded before core domain data. Names below use the updated table names from the ERD.

### ROLE

| Code | Name | Notes |
| --- | --- | --- |
| ADMIN | Admin | MVP warehouse administrator role. Assigned through WAREHOUSE_MEMBERSHIP, not USER. |

### ORDER_STATUS

| Code | Name | Notes |
| --- | --- | --- |
| PAYMENT_PENDING | Payment pending | Initial order/payment state. |
| PAID | Paid | Payment received. |
| SETUP_INPROGRESS | Setup in progress | Pickup-oriented fulfillment state. |
| SETUP_FULFILLED | Setup fulfilled | Pickup/setup completed. |
| TEARDOWN_STARTED | Teardown started | Return-oriented state. |
| COMPLETE | Complete | Order lifecycle finished. |

### LOCATION_UNIT_TYPE

| Code | Name |
| --- | --- |
| WAREHOUSE | Warehouse |
| ZONE | Zone |
| AISLE | Aisle |
| BAY | Bay |
| SHELF | Shelf |
| WALL | Wall |

### LOCATION_TYPE_RELATIONSHIP

Defines which LOCATION_UNIT_TYPE rows may parent which children. Seed the standard warehouse hierarchy below; add more rows later only when the physical warehouse model needs them.

| Parent type code | Child type code |
| --- | --- |
| WAREHOUSE | ZONE |
| ZONE | AISLE |
| AISLE | BAY |
| BAY | SHELF |
| BAY | WALL |

### QR_CODE_TYPE

| Code | Name | Meaning |
| --- | --- | --- |
| 0 | Item | QR_CODE identifies an ITEM. |
| 1 | Warehouse location unit | QR_CODE identifies a LOCATION_UNIT. |

### ITEM_CATEGORY

ITEM_CATEGORY is a lookup table for inventory classification. Seed known categories from the current inventory import or MVP starter data; each row should have a stable code and display name, for example CHAIR / Chair.

## Prisma implementation constraints

A couple of constraints to explicitly carry into the Prisma implementation even though Mermaid does not show them well:

\`\`\`text
USER.firebaseUid       UNIQUE
USER.email             UNIQUE

ROLE.code              UNIQUE
    ADMIN

WAREHOUSE_MEMBERSHIP
    UNIQUE(userId, warehouseId)

QR_CODE.payload        UNIQUE

ORDER_LINE
    UNIQUE(orderId, itemId)
\`\`\`

## Authorization model

The USER model now has a very specific responsibility:

\`\`\`text
USER
----------------------------
id              Internal DB ID
firebaseUid     Firebase Auth identity
email           Useful domain/account data
createdAt
updatedAt
\`\`\`

Authorization is completely separate:

\`\`\`text
WAREHOUSE_MEMBERSHIP
----------------------------
userId
warehouseId
roleId -> ADMIN
\`\`\`

This is significantly better than USER.role. A user is not inherently an admin of the entire system; they are an admin of a warehouse they have membership in. That gives us the right foundation for the long-term multi-warehouse model without adding much MVP complexity.

## Quantity invariants

1. **Pick:** increment qtyPicked; decrease ITEM.quantityAvailable by picked qty.
2. **Return:** increment qtyReturned; increase available only by returned qty.
3. **Missing / Broken:** record via ISSUE; reduce owned/available accordingly. Never auto-reset owned qty to pre-pick value.

## Image upload flow

1. POST /file/sign with Bearer token -> create FILE created + presigned PUT URL, about 10 minutes.
2. Client PUT bytes directly to S3, not through a Next.js body.
3. POST /file/verify -> HEAD + content-type/size/magic checks -> uploaded + CloudFront URL; on failure delete object + row.
4. Catalog / inventory attach item images only after verify success.

## Out of scope (Phase 2+)

Staff permissions, schedule/calendar view, automated overbooking, customer storefront/payments.
