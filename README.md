# Maison Bistro

Restaurant management backend model foundation for MongoDB.

## Backend setup

```powershell
cd "backend"
npm install
Copy-Item .env.example .env
npm run dev
```

Set `MONGODB_URI` in `.env` to a local or hosted MongoDB instance. MongoDB creates the database and collections when the first document is inserted. Models are re-exported from `backend/src/models/index.js`.

The model layer covers users and role accounts, menu, orders and billing, reservations and tables, attendance and performance, inventory and purchases, expenses, salaries, kitchen/delivery/cleaning workflows, notifications, complaints, coupons, settings and activity logs.

## API routes

The API is mounted under `/api/v1`:

- `/auth` - customer registration, login and current user
- `/users` - admin/manager staff account management
- `/menu` - categories, food items, reviews and coupons
- `/restaurant` - floors, tables and restaurant settings
- `/billing` - orders, invoices and payments
- `/reservations` - reservation CRUD
- `/staff` - attendance, performance, salary, kitchen, delivery and cleaning workflows
- `/inventory` - inventory, stock movements, purchases and expenses
- `/support` - notifications, complaints and activity logs

Most resources support `GET`, `POST`, `GET /:id`, `PATCH /:id` and `DELETE /:id`. List endpoints support `page`, `limit`, `search` and resource-specific filters. Set `JWT_SECRET` in `.env` before using authentication.

Menu management actions are available at `/api/v1/menu/manage/categories` and `/api/v1/menu/manage/items`. Add, edit and delete operations require an authenticated `admin`, `owner` or `manager` account. The frontend management component is shared so it can be mounted in the manager panel later without duplicating menu logic.

Food item pricing uses `regularPrice`/`offerPrice` as base prices plus optional `sizePricing` adjustments. Dietary options include vegetarian, vegan, spicy, gluten-free and meat lovers. When `dietary` includes `spicy`, admins can configure spicy-level add-ons (`25_percent`, `50_percent`, `75_percent`, `super_duper_naga`). Orders store the selected size and add-ons on each order item.

## Admin panel

The admin panel is available at `http://localhost:5173/admin/login`. It supports admin/owner login, a protected dashboard, recent order statistics, revenue/expense/profit totals, table occupancy, and management views for floors, tables, orders, reservations, staff, menu, inventory, finance, analytics and settings.

Create the first admin account after configuring MongoDB:

```powershell
cd "backend"
$env:ADMIN_NAME="Restaurant Admin"
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="use-a-strong-password"
npm run create-admin
```

The backend must be running for login and dashboard data:

```powershell
npm run dev
```

Frontend environment setup:

```powershell
cd "../frontend"
npm install
Copy-Item .env.example .env
npm run dev
```

The frontend reads the backend URL from `VITE_API_URL`. Vite only exposes variables prefixed with `VITE_`; do not put passwords or private secrets in frontend environment files.

Staff profile pictures, menu item images and category images are selected from the admin's computer using the file picker. The backend accepts PNG, JPEG and WebP images up to 5 MB and stores them under `backend/uploads/profiles` or `backend/uploads/menu`; no image URL is used in the admin forms.

Waiters can sign in at `http://localhost:5173/waiter/login`. The duty dashboard loads active menu categories and items, lets a waiter click items into a current order, select an available table, add guest details, adjust quantities and submit a dine-in order. The waiter API is protected by the `waiter` role at `/api/v1/waiter`; submitted orders receive an order number, configured tax/service charge, the logged-in waiter as `createdBy`, and mark the selected table as occupied.

The waiter duty dashboard also supports dine-in, takeaway and walk-in orders, menu search, size pricing, configured spicy-level add-ons, variant-aware cart quantities, active-order status progression, cancellation, table-status overview, refresh and automatic table release when an order is completed or cancelled. The **My work** panel provides today's and monthly attendance history with approval/rejection details, check-in/check-out, salary history and confirmation/dispute actions, notifications, profile fields plus profile-picture upload, and password change. Waiter orders can be opened by ID and all waiter attendance, salary, password and order actions are recorded in the activity log.

Kitchen staff can sign in at `http://localhost:5173/kitchen/login`. Kitchen orders move through `pending → accepted → processing → ready → served → completed`, while cashiers can sign in at `http://localhost:5173/cashier/login`; the cashier desk includes daily revenue/bill summaries, served-order search, full or partial payments, invoice generation and print/reprint tracking, transaction/activity history, attendance check-in/out, salary confirmation/dispute reporting, notifications, profile editing and password changes. A partially paid order remains open until its remaining balance is received; a fully paid order becomes `paid`/`completed`. Delivery and cleaner workflows are not enabled in this phase.

Chef / kitchen staff can sign in at `http://localhost:5173/kitchen/login`. Their dashboard auto-refreshes live orders every minute, supports pending → accepted → processing → ready → served → completed lifecycle actions, kitchen priority changes, unavailable-ingredient/preparation issue reporting, order history search, daily item/order/preparation metrics, attendance, salary confirmation/disputes, notifications and password changes. Each kitchen transition stores the responsible staff member and timestamp.

Admin analytics is available at `/admin/analytics` with daily revenue, order, expense, profit and top-selling-product reporting. Admin staff management includes pending attendance approval/rejection with notifications; admin orders can be opened for full item details and cancelled with a reason. New waiter orders notify active chef accounts.

Admin floor management is available at `/admin/floors`. Floors can contain named sections, and tables are created, edited, status-managed and deleted inside their floor card; there is no separate Tables menu in the admin sidebar. Floor deletion is blocked while tables still belong to that floor.

Admin settings are managed at `/admin/settings`. The page supports restaurant contact details, currency, timezone, tax and service-charge percentages, opening-hours JSON, reservation slots and capacity, enabled order types, printer width, online-order visibility and maintenance mode. The settings API uses `GET /api/v1/admin/settings/current` and `PUT /api/v1/admin/settings/current`.

Customers can register or sign in at `/customer/register` and `/customer/login`. The customer dashboard provides order totals/history, status tracking, cancellation and reorder, reservation history, saved delivery addresses, profile/profile-picture updates, password changes and notifications. Customer APIs also support guest checkout, registered online orders, reservations, coupon validation, completed-order reviews, complaints and account deactivation. Guest orders retain name, phone and delivery address and appear in admin order resources.

Inventory management is available at `/admin/inventory`. Admins can create, edit and archive inventory entries, filter low-stock items, record stock-in/stock-out/adjustment movements, record purchases (which automatically increase stock and create a stock movement), and record expenses. Inventory APIs are available under `/api/v1/admin/inventory`.
### Online order confirmation

Online and guest Cash on Delivery orders first enter the cashier's **Online calls** queue. The cashier calls the customer and approves the order before it becomes visible to kitchen staff. Rejected orders are cancelled with the cashier's reason; registered customers receive an in-app notification for either decision.

Approved online orders enter the delivery dashboard after kitchen staff marks them served. Delivery staff accepts the order, marks pickup and delivery, records cash collection, then hands the cash to the cashier. The cashier records receipt and payment; only then does the order become paid and completed.