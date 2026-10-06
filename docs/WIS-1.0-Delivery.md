# WIS 1.0 — Delivery Document

**Warehouse Inventory System**  
Aniah Social Events  
First client release · September 2026

This document describes everything delivered in version 1.0: the **web admin** (computer) and the **warehouse phone app**. They share one inventory, one set of orders, and one account.

---

## What this system is

WIS gives Aniah Social Events a single place to know:

- What the business owns
- How many units are available versus out on an event
- Where each item lives in the warehouse
- What is assigned to upcoming events
- What was picked up and returned
- What was reported missing or broken

The **phone app** is for work on the floor: photograph items, print QR labels, scan locations, and run same-day pickup and return.

The **web admin** is for work at a desk: complete item records, search the full catalog, create event orders, add items to those orders, and review issues.

Together they are the inventory foundation for a later customer-facing rental storefront. That storefront is **not** in this release.

---

## How the two products work together

| | Web admin | Warehouse app |
| --- | --- | --- |
| Who it is for | Owner / admin at a computer | Same people, walking the warehouse |
| Sign-in | Email and password | Same email and password |
| Inventory | Full catalog, detailed fields, photos, archive | Fast create / edit, photos, labels, locations |
| Orders | Create events, add lines, set status | Pick and return today’s events |
| Locations | Seen on each item | Built as a tree; labels printed on the floor |
| Issues | Full report list | Report from the floor or from an order |
| Printing | Not on web | NIIMBOT Bluetooth labels |

A change in one place shows up in the other. Photograph a chair on the phone and it appears in web inventory. Create an order on the web and it appears on Pickup for that event day.

---

## Accounts and access

- Sign in with the provisioned Aniah admin email.
- Access is organization-scoped. This release is **Admin only**. Staff-only pick/return accounts are deferred until there are employees who need them.
- Public self-serve signup is off. New people are provisioned, not created from the landing page.
- The app and web use the same Firebase account. After sign-in, the session loads the organization, role, and warehouse (Lemon Tree for this release).
- Sign out is available from the web profile menu and from the app profile menu.

---

## Home / Dashboard

Both products open on a dashboard so you can see the state of the warehouse without hunting.

### What you see

- **Total inventory** — sum of quantity owned
- **Upcoming events** — orders scheduled in the current month that have not been returned
- **Issues this month** — missing and broken reports
- **Last 24 hours** — how many inventory or order changes were recorded

Dates and “today” use **America/Chicago**.

### Activity

Every meaningful action is written to an activity log: item created or updated, QR attached or removed, location set or cleared, order created or updated, line added or removed, pick, return, issue reported, warehouse or location changes, photo uploaded.

- Web: three recent rows on the dashboard, **See all** for up to 100 from the last 24 hours
- App: the same preview on Home, **See all** for the full 24-hour feed

Each row shows who did it (initial and email), a short summary, and how long ago.

---

## Inventory catalog

This is the heart of the system. An item is a thing the business owns (for example, gold chiavari chairs), with photos, quantity, optional category and material, and optional warehouse location.

### Creating an item — phone

The floor workflow is built so you can catalog even when you do not know the final bin yet.

1. **Photos** — camera or gallery, more than one photo allowed
2. **Details** — name and quantity required; category and material optional dropdowns
3. **Create label** — print a QR now, or skip and print later. You cannot print until a NIIMBOT printer is connected. On a successful print the QR is saved. You can also replace a QR (the old label stops working).
4. **Add to warehouse** — scan a location QR, or skip if the item is not placed yet

You still have the picture, the record, and the ability to print a label later.

### Creating an item — web

From **Inventory → New item**:

- Choose warehouse
- At least one verified photo
- Name, quantity, category, material
- Description, pricing, purchase / replacement links
- Condition and disposition
- Notes

Web is where you finish the fields that are awkward to type on a phone.

### Editing

**Phone — Edit Inventory**

- Search by name or scan the item QR
- Update photos, name, quantity, category, material
- Reprint or replace the label
- Place the item if it still has no location

**Web — item page**

- Save the full record
- Add more photos
- See warehouse, location path, owned and available
- **Add to order** from the item page (pick an order and quantity)

### Search and filters (web)

The inventory list can be narrowed by:

- Text (name, warehouse, or location path)
- Warehouse
- Category
- Located / unlocated / a specific location
- Active, archived, or all

The table shows photo, name, warehouse, category, location, owned, and available.

### Archive and restore (web)

- Archive by setting disposition to **Sell** or **Discard**
- Restore by setting disposition back to **Business**
- Items can also land in **Missing** or **Broken** when issues drive owned quantity to zero
- The default list hides archived items

The phone does not archive or delete items. It edits, labels, and moves them.

### Categories, materials, and stock

Seeded rental categories include plates, cups, chairs, tables, and the rest of the event set.

Materials: plastic, ceramic, glass, metal, fabric, wood.

Each item has **owned** (what the business has) and **available** (what is not currently out on an event). Pickup lowers available. Return raises it. Issues lower owned (and warehouse available when the report is from the floor).

---

## Warehouse layout

The warehouse is a tree, not a flat list. Types go **Warehouse → Zone → Aisle → Rack → Shelf** (wall units are also supported).

### On the phone (Warehouse tab)

- Open the current warehouse (name and address)
- Tap a row to go one level deeper
- Hold a row to edit, print a label, link an existing QR, or delete
- Add a new unit at the current level
- Edit the warehouse name
- Connect the printer
- Print one location label or **print all labels** at that level
- Link a QR that is already printed if the location does not have one yet

### On the web

Location is visible on every item (path or “unlocated”). Binding and clearing locations is done on the phone by scanning, which is the intended floor workflow. The APIs that place and remove items are the same ones the app uses.

---

## Labels and QR codes

Two kinds of QR exist:

- **Item QR** — stuck on the physical piece (or its bin of identical pieces)
- **Location QR** — stuck on the aisle, rack, or shelf

### Printer (phone only)

- Connects to a **NIIMBOT** label printer over Bluetooth
- Header status: green connected, amber not connected yet, gray Bluetooth off, red error
- Item labels: QR plus the item name
- Location labels: QR plus the location name
- You can reprint, replace an item QR, print one location, or print a whole level
- Print is saved only after a successful print on create; skip is always available

Web can create and resolve QR records through the shared API. Physical printing stays on the phone.

---

## Orders and events

An order is an event the warehouse must fulfill: a name, an optional event date, a status, and lines (item + quantity requested).

### Statuses

Orders move in one direction:

**Paid → Picked up → Returned**

- **Paid** — booked; ready for pickup on the event day
- **Picked up** — stock has left for the event
- **Returned** — stock is back (or issues have been recorded)

### Creating and managing orders (web)

- **Orders** list with status filters
- **Create order** — name and optional event date; starts as Paid
- Order detail:
  - Edit name, event date, and status
  - Add catalog items as lines
  - Edit requested quantity
  - Remove a line (outstanding reserved quantity returns to available)
  - See requested, picked, returned, and issued quantities
  - Report missing or broken on a line

You can also add a line from an inventory item page.

Picked and returned counts are written by the phone during pickup and return, not typed on the web. The web can still change requested quantity and order header fields.

### Pickup (phone)

- **Pickup** tab shows **today’s** event orders only
- Green rows are already picked up; you can still open them to review
- Open an order, scan an item QR or tap a line, enter quantity
- Remaining lines stay at the top; finished lines drop down
- After pickup is complete, picks cannot be changed
- You can still report a problem on a line

### Return (phone)

- **Return** tab shows **today’s** event orders only
- Paid orders that have not been picked up stay visible but **cannot be opened** until pickup is done
- Green rows are fully returned; you can still open them
- Scan the item, enter quantity, then scan the **location QR** to put it away
- Report missing or broken on outstanding quantity

Pickup and return lists do not show other days. The web **Orders** page still shows the full history.

---

## Missing and broken

Two issue types: **Missing** and **Broken**.

### From the warehouse (not tied to an event)

- App: profile menu → **Report Issue** → search or scan → type, quantity, notes
- Shows how many are in the warehouse versus owned
- You can report up to owned quantity
- Web: same capability from an item via the API; the **Reports** page is where you review everything

This lowers owned and warehouse available.

### From an order

- App: on a pickup/return line after pickup, **Missing / Broken**
- Web: on the order detail, report on a line regardless of status (admin override)

Order issues lower **owned** only. They do not put available back as if the piece returned. If owned reaches zero, the item can be marked missing or broken.

### Reports page (web)

- Filter Missing / Broken
- Photo, date, item, type, quantity
- Source: the event order, or “Warehouse” if it was a floor report
- Notes and who reported it
- Links through to the item and the order

Dashboard **Issues this month** counts these records.

---

## Photos

- Upload from the phone (camera or library) or from web
- Stored privately (Cloudflare R2); the apps receive short-lived read URLs
- JPEG, PNG, and WebP
- New web items require at least one verified photo
- Phone create is built around photographing first
- Thumbnails appear in catalog lists, inventory tables, and reports

---

## Branding and daily use

Both products use Aniah’s look:

- Cream backgrounds, coral titles, brown body text
- Green for primary / complete actions
- Peach only for attention: errors, sign out, report issue, connect printer, archive / remove

The phone has:

- Bottom tabs: Home, Catalog, Warehouse, Pickup, Return
- Pull-to-refresh on every screen that loads data
- Profile menu (report issue and sign out) from Home, Catalog, Warehouse, Pickup, and Return
- Confirmations on destructive actions (delete a location, detach an item, replace a QR, print all labels)

---

## What each person does in a typical week

**Catalog a new piece on the floor**  
Photo → details → print label (or skip) → scan location (or skip) → later finish description and price on the web.

**Set up the warehouse**  
On the phone, add zones / aisles / racks / shelves, print location labels, stick them on, then place items by scanning.

**Book an event**  
On the web, create the order with the event date, add items and quantities from inventory.

**Event day**  
On the phone, open Pickup, scan what leaves, confirm quantities. Completed orders stay on the list in green.

**Return day**  
On the phone, open Return (only after pickup). Scan items back, confirm quantities, scan the location they go to. Report anything missing or broken.

**Desk review**  
On the web, check the dashboard, finish item records, archive sold or discarded pieces, and read the issues report.

---

## What this version does not include

These were out of scope for 1.0 and are not in the product:

- Customer storefront, renter accounts, or browsing
- Payments or checkout (orders enter the system already **Paid**)
- Creating or editing event orders from the phone
- Delivery routing
- Staff-only accounts (pick/return without admin)
- Multi-warehouse switching in the app (one warehouse for this release)
- Self-serve signup or password reset in the app
- Calendar / booking views
- Advanced analytics or accounting integrations
- Push notifications
- Offline mode
- Dark mode

The system is built so a later rental storefront can sit on the same catalog and quantities.

---

## Feature checklist

### Shared

- [x] One Aniah organization and admin account
- [x] Same sign-in on web and phone
- [x] Dashboard metrics and 24-hour activity
- [x] Item catalog with photos, quantity, category, material
- [x] Owned vs available stock
- [x] Item and location QR codes
- [x] Event orders with Paid → Picked up → Returned
- [x] Missing and broken issues
- [x] Activity audit of warehouse and order work

### Web admin

- [x] Dashboard, Orders, Inventory, Reports
- [x] Full inventory search and filters
- [x] New item and complete item record
- [x] Archive (sell / discard) and restore
- [x] Create and edit orders; add / remove lines
- [x] Add an item to an order from the item page
- [x] Issues report with source and reporter
- [x] Full activity list

### Warehouse app

- [x] Home dashboard and activity
- [x] Create item: photo → details → print or skip → place or skip
- [x] Edit inventory (search or scan)
- [x] Create / reprint / replace item labels
- [x] Add, move, and remove warehouse locations
- [x] Build the location tree; print one or all labels
- [x] Link an existing location QR
- [x] NIIMBOT Bluetooth printing with status in the header
- [x] Pickup today’s orders; completed stay visible
- [x] Return today’s orders after pickup; scan location on put-away
- [x] Report issue from profile or from an order line
- [x] Pull-to-refresh on data screens

---

## Products in this release

| Product | Name | Version |
| --- | --- | --- |
| Warehouse phone app | WIS | 1.0.0 |
| Web admin | WIS Admin | First production dashboard |

Both talk to the same WIS API and the same inventory database.
