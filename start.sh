#!/bin/bash

# A simple script to run both the FastAPI backend and Next.js frontend concurrently.

echo "========================================="
echo "🚀 Starting TenantBase Project Management"
echo "========================================="

# 1. Start the Backend
echo "-> Starting FastAPI Backend..."
cd backend
# Activate the virtual environment if it exists
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# 2. Start the Frontend
echo "-> Starting Next.js Frontend..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo "========================================="
echo "✅ Both services are starting up!"
echo "📡 Backend API: http://localhost:8000"
echo "🖥️  Frontend UI: http://localhost:3000"
echo "🛑 Press Ctrl+C to stop both services."
echo "========================================="

# Trap Ctrl+C (SIGINT) to cleanly kill both background processes
trap "echo -e '\nStopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM

# Wait indefinitely for background processes
wait $BACKEND_PID $FRONTEND_PID
