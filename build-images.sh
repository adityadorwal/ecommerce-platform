#!/bin/bash

set -e

echo "================================================"
echo "Building Docker Images"
echo "================================================"
echo ""

# Build Dashboard
echo "Building dashboard image..."
cd dashboard
docker build -t ecommerce-dashboard:latest .
echo "✅ Dashboard image built"
cd ..

echo ""

# Build Orchestrator
echo "Building orchestrator image..."
cd orchestrator
docker build -t ecommerce-orchestrator:latest .
echo "✅ Orchestrator image built"
cd ..

echo ""
echo "================================================"
echo "✅ All images built successfully!"
echo "================================================"
echo ""
echo "For Kind clusters, load images with:"
echo "  kind load docker-image ecommerce-dashboard:latest --name ecommerce-platform"
echo "  kind load docker-image ecommerce-orchestrator:latest --name ecommerce-platform"
echo ""
echo "For remote registries, tag and push:"
echo "  docker tag ecommerce-dashboard:latest your-registry/ecommerce-dashboard:latest"
echo "  docker push your-registry/ecommerce-dashboard:latest"
echo "  docker tag ecommerce-orchestrator:latest your-registry/ecommerce-orchestrator:latest"
echo "  docker push your-registry/ecommerce-orchestrator:latest"
echo ""
