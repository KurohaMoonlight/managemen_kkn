# Sistem Management KKN

This project contains a separated Express (backend) and Vue 3 (frontend) application structure.

## Project Structure

```text
sistem_management_kkn/
├── backend/            # Express.js REST API
│   ├── .env            # Environment configuration
│   ├── server.js       # Main server entrypoint
│   └── package.json    # Backend dependencies
├── frontend/           # Vue 3 Vite application
│   ├── src/            # Vue components and main files
│   ├── vite.config.js  # Vite settings with proxy to backend
│   └── package.json    # Frontend dependencies
├── package.json        # Root package.json to orchestrate scripts
└── README.md           # Documentation
```

## Getting Started

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed (v16.x or newer recommended).

### 2. Installation
Install all dependencies (both for root, backend, and frontend) by running:
```bash
npm install
npm run install-all
```

### 3. Development
Start both the Express backend and Vite Vue frontend development servers simultaneously:
```bash
npm run dev
```

The Express API will run on `http://localhost:5000` and the Vue App will run on `http://localhost:5173`.
All API requests from Vue made to `/api` will be proxied automatically to the Express server.




