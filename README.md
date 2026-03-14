# Guru Kirana Store

Modern neighborhood grocery website for **Guru Kirana Store**, built for easy product browsing, customer ordering, and admin management.

## Highlights

- Attractive grocery-focused landing page with brand identity
- Service messaging for nearby delivery within **15-20 km**
- Product catalog with search, filters, featured products, and cart
- Customer authentication for order placement
- Admin dashboard for product, pricing, stock, and order management
- Lightweight JSON-based local database for quick setup

## Proprietor

- **Mr. Kesri Nandan**

## Project Structure

- [`backend/`](backend)
- [`frontend/`](frontend)

## Tech Stack

### Frontend

- React + Vite
- Custom CSS for premium grocery UI

### Backend

- Node.js + Express
- JWT authentication
- `bcryptjs` password hashing
- File-based JSON persistence

## Admin Workflow

1. Open the website.
2. Go to the **Private Admin Access** section.
3. Login using the private owner credentials.
4. Open the admin dashboard to:
   - add new products
   - update price and stock
   - mark products as available or hidden
   - review customer orders
   - change order status

### Product Availability Rules

- If a product is marked **available** and stock is more than `0`, customers can order it.
- If stock becomes `0`, the product shows **Out of stock**.
- If admin unchecks availability in the dashboard, the product becomes **Hidden by admin** and customers cannot order it.

## Run Locally

### 1. Start backend

```bash
cd backend
npm install
copy .env.example .env
npm start
```

Backend runs on `http://localhost:4000`

### 2. Start frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

## Environment

Backend example env is available in [`backend/.env.example`](backend/.env.example).

## Local Marketing Ideas

Use this website link in:

- Google Business Profile
- WhatsApp status and neighborhood groups
- Instagram reels/stories for daily offers
- QR code on shop counter and carry bags
- Festival combo promotions and weekly essential packs

This project is designed to feel modern, simple, and business-ready for local grocery customers.
