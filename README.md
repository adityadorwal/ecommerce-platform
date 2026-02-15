# Kubernetes Multi-Tenant E-commerce Platform

A production-ready platform for provisioning and managing multiple WooCommerce stores on Kubernetes.

## 🎯 Features

- **On-Demand Store Provisioning**: Spin up fully isolated WooCommerce stores with a single click
- **Multiple Store Types**: WooCommerce (fully implemented) + MedusaJS (coming soon, architecture ready)
- **Kubernetes-Native**: Built entirely on Kubernetes primitives using Helm charts
- **Environment Agnostic**: Works seamlessly on local (Kind/k3d/Minikube) and production (k3s/EKS/GKE) clusters
- **Full Isolation**: Each store gets its own WordPress + MySQL deployment with dedicated resources
- **Health Monitoring**: Readiness and liveness probes for all components
- **Abuse Prevention**: Built-in rate limiting (3 stores/hour, 5 stores/user max)
- **Web Dashboard**: React-based UI to manage all stores
- **REST API**: Backend orchestrator with Kubernetes API integration

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Browser                          │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────▼──────────┐
         │  Dashboard (React)   │
         │  - View stores       │
         │  - Create/Delete     │
         └───────────┬──────────┘
                     │ HTTP API
         ┌───────────▼──────────────┐
         │  Orchestrator (Node.js)  │
         │  - K8s API Client        │
         │  - Store Lifecycle Mgmt  │
         └───────────┬──────────────┘
                     │ Kubernetes API
    ┌────────────────▼────────────────────┐
    │        Kubernetes Cluster           │
    │  ┌─────────────────────────────┐   │
    │  │ Store 1                     │   │
    │  │ ├─ WordPress Pod            │   │
    │  │ ├─ MySQL Pod                │   │
    │  │ └─ Ingress (store1.local)   │   │
    │  └─────────────────────────────┘   │
    │  ┌─────────────────────────────┐   │
    │  │ Store 2                     │   │
    │  │ ├─ WordPress Pod            │   │
    │  │ ├─ MySQL Pod                │   │
    │  │ └─ Ingress (store2.local)   │   │
    │  └─────────────────────────────┘   │
    └─────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Docker
- kubectl
- Helm 3.x
- One of: Kind, k3d, or Minikube

### Local Deployment

```bash
# 1. Create a local Kubernetes cluster (using Kind as example)
kind create cluster --name ecommerce-platform

# 2. Build Docker images
./build-images.sh

# 3. Load images into Kind
kind load docker-image ecommerce-dashboard:latest --name ecommerce-platform
kind load docker-image ecommerce-orchestrator:latest --name ecommerce-platform

# 4. Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# 5. Wait for ingress controller to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s

# 6. Install the platform
helm install ecommerce-platform ./helm/platform \
  -f ./helm/platform/values-local.yaml \
  --create-namespace \
  --namespace ecommerce-platform

# 7. Wait for pods to be ready
kubectl wait --namespace ecommerce-platform \
  --for=condition=ready pod \
  --all \
  --timeout=300s

# 8. Access the dashboard
echo "Dashboard: http://localhost:3000"
kubectl port-forward -n ecommerce-platform svc/dashboard 3000:80
```

### Production Deployment

```bash
# 1. Update values-prod.yaml with your domain and settings

# 2. Install on production cluster
helm install ecommerce-platform ./helm/platform \
  -f ./helm/platform/values-prod.yaml \
  --create-namespace \
  --namespace ecommerce-platform

# 3. Configure DNS to point to your ingress controller
```

## 📚 Documentation

- [Setup Guide](docs/SETUP.md) - Detailed setup instructions
- [Architecture](docs/ARCHITECTURE.md) - Technical architecture details
- [Design & Tradeoffs](docs/DESIGN_AND_TRADEOFFS.md) - Architecture decisions and production considerations

## 🧪 Testing E2E Flow

1. Open dashboard at http://localhost:3000
2. Click "Create New Store"
3. Enter store name (e.g., "mystore")
4. Wait for status to change to "Ready"
5. Click on the store URL (e.g., http://mystore.local)
6. Add `/etc/hosts` entry: `127.0.0.1 mystore.local`
7. Complete WooCommerce setup wizard
8. Add a product and complete checkout with Cash on Delivery

## 🛠️ Development

### Building Custom Images

```bash
# Build dashboard
cd dashboard
docker build -t your-registry/ecommerce-dashboard:latest .

# Build orchestrator
cd orchestrator
docker build -t your-registry/ecommerce-orchestrator:latest .

# Update values.yaml with your image names
```

## 📦 Components

- **Dashboard**: React 18 + Material-UI
- **Orchestrator**: Node.js + Express + @kubernetes/client-node
- **Store Engine**: WordPress 6.4 + WooCommerce 8.x
- **Database**: MySQL 8.0 (per store)
- **Ingress**: NGINX Ingress Controller

## 🔒 Security Notes

- Change default passwords in production (values-prod.yaml)
- Enable TLS/SSL for production ingress
- Use secrets management (e.g., Sealed Secrets, External Secrets)
- Implement proper RBAC for orchestrator service account

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please read CONTRIBUTING.md first.
