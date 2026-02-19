# Kothrito Internal Audit Report

This document outlines the architectural, logical, and UI inconsistencies found entirely within the current implementation in `d:\Projects\kothrito`.

---

## 1. Global CSS vs Viewport Scrolling (Critical UI Bug)
**Inconsistency**:
The `app/globals.css` file enforces a strict `overflow: hidden` and `height: 100dvh` on the `body`. However, both the Rider Dashboard (`app/kothrito-rider/page.tsx`) and the Admin Dashboard (`app/admin-kothrito/page.tsx`) rely on scrolling (`min-h-screen`, `pb-24`) to display lists of available orders, history, and the fleet. 
**Impact**: If the lists get too long, they will be clipped, and the user will be unable to scroll down to view them.
**Suggested Fix**: Remove `overflow: hidden` and `height: 100dvh` from `body` in `globals.css` and move those utility classes specifically to the parent container `<main>` inside the Student App (`app/page.tsx`) which actually requires the fixed viewport map layout.

## 2. Dark Mode Implementation Gap
**Inconsistency**:
The Admin and Rider interfaces have dedicated Dark Mode toggles that inject a `.dark` class onto the root HTML element and persist via `localStorage`. However:
1. `tailwind.config.ts` does not have `darkMode: 'selector'` configured (necessary for standard class-based dark mode in Tailwind v4).
2. The primary Student Website (`app/page.tsx`) lacks dark mode integration completely, producing a fragmented app theme.
**Suggested Fix**: Add `darkMode: 'selector'` to `tailwind.config.ts` (or equivalent Tailwind v4 `@custom-variant`). Add a dark mode toggle and `dark:` utility classes to the student `page.tsx`.

## 3. Disconnected Service Pricing & Hardcoding (Business Logic Error)
**Inconsistency**:
The generic Student App UI advertises three services: Ride (₹20), Food (₹30), and Groceries (₹25). However:
1. When a student places an order, the `handleOrderSubmission` function hardcodes `serviceType: "ride"`, regardless of which button they actually clicked.
2. The pricing is fundamentally ignored by the backend logic. The `kothrito-rider/page.tsx` earnings calculation hardcodes a `20` rupee increment (`const amt = 20`) for every completed order. 
3. The Admin dashboard revenue calculation is identical (`docs.filter(d => d.status === 'completed').length * 20`).
**Suggested Fix**: 
- Pass the selected `serviceType` and `price` dynamically from the Student UI payload into the `orders` document upon creation.
- Update Rider earnings and Admin revenue logic to sum the actual `o.price` property of the document, rather than multiplying by 20.

## 4. Ride Acceptance Race Condition (Concurrency Bug)
**Inconsistency**:
In `kothrito-rider`, multiple drivers see the same active broadcast of pending orders. When a driver clicks "Accept Job", the client directly writes:
`updateDoc(doc(db, "orders", o.id), { status: "accepted", riderId: ... })`
If two drivers tap "Accept" at the exact same time, the last successful network request overwrites the document. Both drivers might briefly see "Ride Accepted" leading to confusion and two drivers arriving at the pickup.
**Suggested Fix**: Use a Firestore `runTransaction` to safely assert that `status === "pending"` before applying the update. If the order is already accepted by someone else, catch the error and alert the driver.

## 5. Security and Role Authorization
**Inconsistency**:
Roles are enforced purely via client-side logic:
- Admin is validated solely via `if (u.email === "acadityachandra@gmail.com")`.
- Rider access checks the `role === "rider"` string on their user document.
If Firebase Firestore Security Rules (`firestore.rules`) are not strictly configured in the backend console to match this exact logic, anyone with a valid Google login could theoretically query, modify, or delete the `orders` and `riders` collections directly via the API.
**Suggested Fix**: Ensure robust Firebase Security Rules exist server-side preventing unauthorized writes to the `orders` and `riders` collections.

## 6. Icon and Branding Hardcoding
**Inconsistency**:
All three interfaces load `<Image src="/logo.png" />`. If the project ever decides to swap the brand or inject dynamic names, it will require manual replacements across 3 distinctly isolated page files. 
**Suggested Fix**: Create a shared `<Header />` or `<Branding />` component in `/components` that centralizes the logo, app name, and global context (like the System Status toggle).
