# Kothrito: Hyperlocal Ride & Delivery Ecosystem

Kothrito is a modern, real-time hyperlocal platform designed to connect **Students** (users) with a fleet of **Riders** for Ride-Hailing, Food, and Grocery delivery. Built on an advanced serverless architecture, it provides an end-to-end operational suite including a dedicated Student PWA, a mobile-first Rider app, and an authoritative Admin Master Control Panel.

## 🏗 System Architecture

**Tech Stack:**
*   **Frontend Framework:** Next.js (React 18, App Router)
*   **Styling:** Tailwind CSS, `lucide-react` (iconography)
*   **Database & Auth:** Firebase (Firestore, Authentication)
*   **Maps & Routing:** Leaflet.js, OpenStreetMap (OSRM)
*   **Native Features:** `use-sound` (audio), `navigator.vibrate` (Haptic Engine)
*   **Hosting:** Vercel (Frontends) / Firebase (Backend)

The platform is strictly organized into three distinct operational layers based on URL routing. Each route carries its own independent authentication constraints to maximize security and minimize cross-role exposure.

---

## 👩‍🎓 1. Student Portal (`/`)

The primary consumer-facing application designed to operate as a fast, accessible Progressive Web App (PWA).

**Core Features:**
*   **Google Authentication:** One-click seamless login.
*   **Service Selection:** Users choose between Bike Rides, Food Delivery, and Grocery Delivery.
*   **Interactive Maps (`MapPicker`):** Leaflet integration allowing students to precisely drop pins for Pickup and Drop-off locations.
*   **Dynamic Distance Pricing:** Queries the public OSRM API to calculate exact road distances (in km) between pins. Price is generated instantly using the Admin's global metrics (`Base Fare`, `Per KM Rate`, `Surge`).
*   **Real-time Tracking:** The UI reacts instantly (via Firestore `onSnapshot`) when a Rider accepts a job, goes en-route, or completes the trip.
*   **Interactive Feedback:** Upon ride completion, an automatic slide-up modal requests a 1-5 Star rating and text review.
*   **Sensory Engine:** Features specialized Haptic ticks on selections, and a double-pulse vibration + chime sound upon successful order booking.

---

## 🏍 2. Rider Dashboard (`/kothrito-rider`)

A streamlined, mobile-optimized command center for the Kothrito Fleet. Riders must be pre-authorized by an Admin in Firestore before accessing this portal.

**Core Features:**
*   **Route Lockout:** Non-riders attempting to access this route receive a "Missing Fleet Privileges" alert.
*   **Duty Status Toggle:** "ON DUTY" / "OFF DUTY" state management.
*   **Job Pool:** Real-time visibility of all `pending` requests categorized by service type (Ride/Food/Grocery).
*   **Optimistic UI & Race-Condition Safety:** 
    *   Tapping "Accept Job" triggers an immediate `CLAIMING...` spinner.
    *   A secure Firestore `runTransaction` attempts to lock the order. If another rider clicks it mere milliseconds earlier, the transaction fails safely.
    *   **Audio/Haptic Alerts:** Successfully claiming the job triggers a positive chime/vibrate. Being beaten by another rider triggers an SOS error vibration and sad beep ("Too slow!").
*   **Active Run Mode:** Strips away unnecessary UI to purely focus on Student Name, precise map coordinates, a "Call" shortcut, and the terminal "Finish Ride" button.
*   **Income Tracking:** Calculates Revenue Today, Weekly Earnings, and Lifetime Total.
*   **Language Accessibility:** One-touch toggle to flip the entire interface between English and Hindi (`अ`).

---

## 👑 3. Master Control Panel (`/admin-kothrito`)

The central nervous system for platform operators. Completely isolated and hardcoded to the root administrator's email.

**Core Features:**
*   **Route Lockout:** Non-admins attempting to hit the Admin URL are met with an "Access Denied: Master Admin database privileges missing" fallback screen.
*   **Live Watchlist:** A permanent, auto-updating ledger tracking active vs. pending orders in real-time. Whenever a new order hits the system, the dashboard physically rings a bell and vibrates the admin's device.
*   **Global Pricing Overrides:** Modify the `Base Fare`, `Per KM Rate`, and `Surge Multiplier` live. Adjustments instantly affect all incoming Student calculations.
*   **Kill Switch:** A single red button to flip the platform completely OFF, preventing any new orders from being placed.
*   **Fleet Management:** View active drivers, force-toggle their online status, revoke access, or use the "New Rider" modal to immediately authorize a new email address into the fleet.
*   **Complete Database & Export:** View every historical transaction across the platform with a 1-click CSV Export functionality for accounting.
*   **Feedback Matrix:** Review submitted ratings and driver notes from students.

---

## 🗄 Firestore Database Schema

The platform requires no rigid schema initialization, but standardizes around four core collections:

### `users`
Tracks the consumer base.
*   `id` / `email` / `name` / `phone` / `createdAt`

### `riders`
Authorizes access to the Rider App.
*   `id` (Email string) / `name` / `email` / `phone` / `role` ("rider" | "inactive") / `riderStatus` (Boolean) / `createdAt`

### `settings` -> `global` (Document)
Controls algorithmic math calculations.
*   `baseFare` (Number) / `perKmRate` (Number) / `surgeMultiplier` (Float) / `isServiceActive` (Boolean)

### `orders`
The highest traffic collection, acting as the state machine for the entire platform flow.
*   **Primary States:** `pending` -> `accepted` -> `completed` -> (Wait for Review) -> `rated` (True)
*   **Fields:** `status`, `serviceType`, `pickup` (Coordinates/Address), `drop` (Coordinates/Address), `distance`, `price`, `userId`, `userName`, `userPhone`, `riderId`, `riderName`, `riderPhone`, `createdAt`, `rating` (Number), `review` (String).

---

## 🚀 Development Setup

1.  **Clone & Install:**
    ```bash
    git clone https://github.com/acaditya10/Kothrito.git
    cd Kothrito
    npm install
    ```
2.  **Environment Variables (`.env.local`):**
    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
    ```
3.  **Run Development Server:**
    ```bash
    npm run dev
    ```
4.  **Admin Initialization:**
    To use the Admin Dashboard for the first time, log in via `/admin-kothrito`. Ensure your Google email matches the `ADMIN_EMAIL` hardcoded inside `admin-kothrito/page.tsx`.
