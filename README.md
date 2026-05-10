<h1 align="center">🌱 AgroSignal</h1>

<p align="center">
  <strong>Parametric Agricultural Insurance, Powered by Network Intelligence.</strong><br />
  Built with Next.js 14, FastAPI, Leaflet, and CAMARA Network APIs.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/FastAPI-Backend-009688?style=for-the-badge&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-Styling-38B2AC?style=for-the-badge&logo=tailwind-css" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Leaflet-Maps-199900?style=for-the-badge&logo=leaflet" alt="Leaflet" />
</p>

---

## Overview

**AgroSignal** is a full-stack parametric insurance platform that uses mobile network Quality of Data (QoD) signals and real-time Open-Meteo weather intelligence to detect agricultural stress events — and trigger instant mobile money payouts to farmers automatically, with zero paperwork and zero manual claims.

Field agents walk farm boundaries using GPS geofencing. Insurers configure parametric policies with automated trigger thresholds. When drought or flood conditions are detected, the payout engine activates and disburses funds to affected farmers in minutes — not weeks.

---

## Role-Based Dashboards

AgroSignal is a multi-role platform. Each role gets a dedicated, scoped dashboard:

| Role                      | Route                   | Access                                                                |
| ------------------------- | ----------------------- | --------------------------------------------------------------------- |
| **Super Admin / Manager** | `/dashboard`            | Full platform overview, attendance, exports                           |
| **Field Agent**           | `/dashboard/fieldagent` | Farm boundary walk, GPS geofencing via Leaflet                        |
| **Insurer**               | `/dashboard/insurer`    | Policy management, QoD signals, weather monitoring, payout simulation |
| **School Admin**          | `/dashboard/school`     | Farmer registry, registration, farm map                               |

---

## Key Features

### 🗺️ Farm Boundary Walk (Field Agent)

- GPS-powered geofence capture via CAMARA Location API
- Field agent walks the farm perimeter — boundary points logged in real time
- Leaflet map renders the captured polygon with accepted / flagged / rejected point markers
- Walk session management: start, capture points, close walk, view area (acres) and perimeter (km)
- Past geofence history per farmer with polygon replay

### 🛡️ Parametric Insurance Engine (Insurer)

- Create and manage insurance policies with configurable trigger rules
- QoD signal anomaly detection — flags crop stress events from network quality drops
- Open-Meteo weather integration — drought index and flood risk scored on 0–1 scale
- Animated payout simulation engine — 8-step automated process: trigger → policy check → eligibility → corroboration → calculation → compliance → mobile money disbursement → audit trail
- Coverage map with per-district weather markers

### 👨‍🌾 Farmer Registry (School/Admin Dashboard)

- Register farmers via `POST /farmers` with MSISDN, crop, district, and GPS coordinates
- Full farmer list with Leaflet map showing all farm locations
- Crop distribution analytics with progress bars
- Jitter algorithm handles duplicate GPS coordinates gracefully

### 🔐 Authentication

- JWT-based authentication against the AgroSignal API
- Role-scoped session stored in `localStorage` with expiry enforcement
- Each role routes to its dedicated dashboard on login
- Separate API endpoints for Hygiene Quest roles vs AgroSignal roles

---

## Project Structure

```
app/
├── dashboard/
│   ├── page.tsx              # Main dashboard (superadmin / manager)
│   ├── attendance/           # Attendance analysis
│   ├── sales/                # Hygiene Quest sales
│   ├── export-requests/      # Export request management
│   ├── my-requests/          # Field worker requests
│   ├── fieldagent/           # 🗺️ Farm boundary walk dashboard
│   ├── insurer/              # 🛡️ Insurer policy & payout dashboard
│   └── school/               # 👨‍🌾 Farmer registry & map
├── layout.tsx
└── page.tsx                  # Login entry point

components/
├── dashboard-sidebar.tsx     # Role-aware navigation sidebar
├── dashboard-header.tsx      # Top header with user info
└── ui/                       # shadcn/ui component library

hooks/
└── use-session.ts            # JWT session management hook

lib/
├── session.ts                # Session helpers (get, clear, refresh)
├── api.ts                    # API fetch utilities
└── types.ts                  # Shared TypeScript interfaces
```

---

## Tech Stack

| Purpose            | Stack / Library                                                             |
| ------------------ | --------------------------------------------------------------------------- |
| Frontend Framework | [Next.js 14](https://nextjs.org/) (App Router)                              |
| Styling            | [Tailwind CSS](https://tailwindcss.com/)                                    |
| UI Components      | [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) |
| Maps               | [Leaflet](https://leafletjs.com/) (dynamic import, SSR-safe)                |
| Charts             | `recharts`                                                                  |
| Icons              | [Lucide React](https://lucide.dev/)                                         |
| Auth               | JWT — custom `useSession` hook                                              |
| Backend API        | [FastAPI](https://fastapi.tiangolo.com/) — `https://chris.fastapicloud.dev` |
| Weather Data       | [Open-Meteo](https://open-meteo.com/) via AgroSignal API                    |
| Network Signals    | CAMARA QoD APIs                                                             |
| Mobile Money       | MTN MoMo / Airtel Money (simulated)                                         |
| Language           | TypeScript                                                                  |
| Package Manager    | pnpm                                                                        |

---

## Environment Variables

Create a `.env.local` file in the project root:

```env

NEXT_PUBLIC_AGROSIGNAL_URL=https://chris.fastapicloud.dev
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm dev

# Build for production
npm build
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## Login Roles

Select your role at the login screen. Each role authenticates against the appropriate API and is redirected to its dashboard.

| Role          | Label        | API           | Redirects to            |
| ------------- | ------------ | ------------- | ----------------------- |
| `fieldworker` | Field Agent  | AgroSignal    | `/dashboard/fieldagent` |
| `insurer`     | Insurer      | AgroSignal    | `/dashboard/insurer`    |
| `schooladmin` | School Admin | Hygiene Quest | `/dashboard/school`     |
| `manager`     | Manager      | AgroSignal    | `/dashboard`            |
| `superadmin`  | Super Admin  | AgroSignal    | `/dashboard`            |

---

## Payout Simulation

The insurer dashboard includes a full animated payout simulation engine. Click **Simulate Payout** on any weather alert or QoD anomaly to watch the engine step through:

1. Event Trigger Received
2. Policy Lookup & Validation
3. Farmer Eligibility Check
4. Data Corroboration (QoD + Weather)
5. Payout Amount Calculation
6. Compliance & Fraud Check
7. Mobile Money Disbursement
8. Audit Trail Written

Each step runs with realistic timing and displays the outcome. A transaction reference, farmer count, and total disbursement amount are shown on completion.

> This is a simulation. In production, real payments would be disbursed via MTN MoMo / Airtel Money rails.

---

## Why AgroSignal

- **85%** of Sub-Saharan African farmers have no insurance
- **$7B+** in annual crop losses from weather events
- Traditional claims take **6–8 weeks** — AgroSignal pays in **minutes**
- CAMARA APIs make network-grade location data accessible to third-party apps for the first time
- EU Deforestation Regulation (EUDR) creates immediate demand for GPS-verified farm boundary data

---

<p align="center">Built for smallholder farmers across Sub-Saharan Africa 🌍</p>
