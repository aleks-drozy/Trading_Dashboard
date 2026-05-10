# Trading Dashboard

Full-stack trading analytics dashboard for reviewing strategy performance, market data, and research workflows.

Live app: [tradingdashboard-one.vercel.app](https://tradingdashboard-one.vercel.app)

## Overview

Trading Dashboard brings the frontend, backend, schemas, tests, and deployment configuration for a trading research application into one repository. The project is designed as a portfolio-grade example of building a technical product around data-heavy workflows.

## What It Shows

- Full-stack application structure with frontend and backend code
- TypeScript-first interface work with reusable components
- Python-backed analysis and data-processing support
- Test setup for validating application behaviour
- Deployment-ready configuration for hosted environments

## Tech Stack

- TypeScript
- Next.js
- Python
- Node.js
- Vitest
- Vercel

## Repository Structure

```text
app/          Next.js app routes and pages
components/   Reusable UI components
backend/      Backend service code
frontend/     Frontend-specific application code
lib/          Shared utilities
schemas/      Shared data schemas
tests/        Test coverage
public/       Static assets
```

## Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality Checks

```bash
npm test
npm run lint
```
