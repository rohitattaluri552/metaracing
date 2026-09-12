# MetaRacing

A full-stack web application for booking sim-racing and FPV drone racing experiences. Built with React + Vite on the frontend and Express.js on the backend, using SQLite for storage and MQTT for real-time device communication.

---

## Prerequisites

Make sure the following are installed on your machine:

- [Node.js](https://nodejs.org/) v18 or higher
- npm (comes with Node.js)

---

## Getting Started (Development)

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd metaracing
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the project root. The app runs without one, but you can customize these values:

```env
PORT=5000
MQTT_BROKER=mqtt://192.168.0.193:1883
```

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Port the server listens on |
| `MQTT_BROKER` | `mqtt://192.168.0.193:1883` | Address of your MQTT broker (for device comms) |

### 4. Set up the database

The app uses SQLite. The database file is created automatically at `data/metaracing.db` on first run. To apply the schema:

```bash
npm run db:push
```

### 5. Start the development server

```bash
npm run dev
```

This starts the Express backend and Vite dev server together. Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## Project Structure

```
metaracing/
├── client/               # React frontend (Vite)
│   ├── public/           # Static assets (copied as-is to build output)
│   ├── src/
│   │   ├── pages/        # Route-level page components
│   │   ├── components/   # Reusable UI components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── contexts/     # React context providers
│   │   └── lib/          # Utility functions
├── server/               # Express backend
│   ├── index.ts          # Entry point, HTTP server setup
│   ├── routes.ts         # API route definitions
│   ├── storage.ts        # Database access layer (SQLite via Drizzle)
│   ├── mqtt.ts           # MQTT broker integration
│   └── vite.ts           # Vite dev middleware (dev only)
├── shared/               # Code shared between client and server
│   └── schema.ts         # Drizzle ORM schema + Zod types
├── data/                 # SQLite database (auto-created)
├── script/
│   └── build.ts          # Production build script
└── vite.config.ts        # Vite configuration
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server (frontend + backend) |
| `npm run build` | Build both client and server for production |
| `npm run start` | Run the production build |
| `npm run check` | Run TypeScript type checking |
| `npm run db:push` | Push schema changes to the SQLite database |

---

## Building for Production

```bash
npm run build
```

This produces:
- `dist/public/` — compiled frontend (static files)
- `dist/index.cjs` — compiled Express server

Then start the production server:

```bash
npm run start
```

The server serves both the API (`/api/*`) and the frontend from port `5000`.

---

## Deploying to Netlify (Frontend Only)

> **Note:** Netlify is a static host. Only the frontend can be deployed here. The Express backend and MQTT integration must be hosted separately (e.g. [Railway](https://railway.app), [Render](https://render.com), or [Fly.io](https://fly.io)).

| Netlify Setting | Value |
|---|---|
| Build command | `npx vite build` |
| Publish directory | `dist/public` |

The `client/public/_redirects` file is already included to handle client-side routing:

```
/* /index.html 200
```

---

## Pages & Routes

| Route | Description |
|---|---|
| `/` | Home / landing page |
| `/login` | Customer login |
| `/register` | New customer registration |
| `/dashboard` | Customer dashboard |
| `/profile` | Customer profile |
| `/book` | Book a racing session |
| `/admin/login` | Admin login |
| `/admin/dashboard` | Admin dashboard (manage bookings & schedule) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript |
| Styling | Tailwind CSS, shadcn/ui, Radix UI |
| Routing | Wouter |
| State / Data | TanStack Query |
| Backend | Express.js (Node.js) |
| Database | SQLite via Drizzle ORM |
| Real-time | MQTT (device integration) |
| Validation | Zod |
