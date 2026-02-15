#!/bin/bash

set -e

echo "================================================"
echo "E-commerce Platform Quick Start"
echo "================================================"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

command -v docker >/dev/null 2>&1 || { echo "❌ Docker is not installed. Please install Docker first."; exit 1; }
echo "✅ Docker found"

command -v kubectl >/dev/null 2>&1 || { echo "❌ kubectl is not installed. Please install kubectl first."; exit 1; }
echo "✅ kubectl found"

command -v helm >/dev/null 2>&1 || { echo "❌ Helm is not installed. Please install Helm first."; exit 1; }
echo "✅ Helm found"

command -v kind >/dev/null 2>&1 || { echo "❌ Kind is not installed. Please install Kind first."; exit 1; }
echo "✅ Kind found"

echo ""
echo "All prerequisites satisfied!"
echo ""

# Build images
echo "Building Docker images..."
./build-images.sh

echo ""

# Create Kind cluster
echo "Creating Kind cluster..."
cat <<EOF | kind create cluster --name ecommerce-platform --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP
EOF

echo ""
echo "✅ Cluster created"
echo ""

# Install NGINX Ingress
echo "Installing NGINX Ingress Controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

echo "Waiting for Ingress Controller to be ready..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s

echo "✅ Ingress Controller ready"
echo ""

# Load images into Kind
echo "Loading images into Kind cluster..."
kind load docker-image ecommerce-dashboard:latest --name ecommerce-platform
kind load docker-image ecommerce-orchestrator:latest --name ecommerce-platform
echo "✅ Images loaded"
echo ""

# Install platform
echo "Installing E-commerce Platform..."
helm install ecommerce-platform ./helm/platform \
  -f ./helm/platform/values-local.yaml \
  --create-namespace \
  --namespace ecommerce-platform

echo ""
echo "Waiting for platform pods to be ready (this may take 2-3 minutes)..."
kubectl wait --namespace ecommerce-platform \
  --for=condition=ready pod \
  --all \
  --timeout=300s || true

echo ""
echo "================================================"
echo "🎉 Installation Complete!"
echo "================================================"
echo ""
echo "To access the dashboard:"
echo ""
echo "  1. Run this command in a new terminal:"
echo "     kubectl port-forward -n ecommerce-platform svc/dashboard 3000:80"
echo ""
echo "  2. Open your browser to: http://localhost:3000"
echo ""
echo "To create a store:"
echo ""
echo "  1. Click the '+' button in the dashboard"
echo "  2. Enter a store name (e.g., 'mystore')"
echo "  3. Wait for it to become 'Ready'"
echo "  4. Add to /etc/hosts:"
echo "     echo '127.0.0.1 mystore.local' | sudo tee -a /etc/hosts"
echo "  5. Visit: http://mystore.local"
echo ""
echo "For more information, see:"
echo "  - README.md"
echo "  - docs/SETUP.md"
echo "  - docs/ARCHITECTURE.md"
echo ""
echo "To view logs:"
echo "  kubectl logs -n ecommerce-platform -l app=dashboard"
echo "  kubectl logs -n ecommerce-platform -l app=orchestrator"
echo ""
echo "To uninstall:"
echo "  helm uninstall ecommerce-platform -n ecommerce-platform"
echo "  kind delete cluster --name ecommerce-platform"
echo ""
