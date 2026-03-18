#!/bin/sh
# This script builds and deploys the Monize backend and frontend locally using Docker Compose.

set -e

cd ~/projects/monize
echo "Building and starting containers..."
docker compose -f docker-compose.prod.yml up -d --build

echo "Done. Frontend available at http://localhost:3000"
