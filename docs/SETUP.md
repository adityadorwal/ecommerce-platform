# Setup Guide

This guide walks you through setting up the E-commerce Platform on both local and production environments.

## Prerequisites

### Required Tools
- **Docker** (20.10+)
- **kubectl** (1.24+)
- **Helm** (3.8+)
- **One of the following Kubernetes distributions:**
  - Kind (Recommended for local development)
  - k3d
  - Minikube
  - k3s (for production VPS)

### System Requirements
- **Local Development:**
  - 8GB RAM minimum
  - 20GB free disk space
  - 4 CPU cores recommended

- **Production:**
  - VPS with 4GB+ RAM
  - 50GB+ storage
  - Public IP address
  - Domain name configured

## Local Setup (Kind)

### 1. Install Prerequisites

```bash
# Install Kind (on macOS)
brew install kind

# Or on Linux
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind

# Verify installation
kind version
```

### 2. Create Kubernetes Cluster

```bash
# Create cluster with ingress support
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

# Verify cluster
kubectl cluster-info
kubectl get nodes
```

### 3. Install NGINX Ingress Controller

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# Wait for it to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s
```

### 4. Install the Platform

```bash
# Navigate to project directory
cd k8s-ecommerce-platform

# Install using Helm
helm install ecommerce-platform ./helm/platform \
  -f ./helm/platform/values-local.yaml \
  --create-namespace \
  --namespace ecommerce-platform

# Watch the pods come up
kubectl get pods -n ecommerce-platform -w
```

### 5. Access the Dashboard

**Option A: Port Forward**
```bash
kubectl port-forward -n ecommerce-platform svc/dashboard 3000:80
# Open http://localhost:3000
```

**Option B: Local DNS (Recommended)**
```bash
# Add to /etc/hosts
echo "127.0.0.1 dashboard.local" | sudo tee -a /etc/hosts

# Access at http://dashboard.local
```

### 6. Test Store Creation

1. Open dashboard at http://localhost:3000 or http://dashboard.local
2. Click the floating "+" button
3. Enter a store name (e.g., "test-store")
4. Wait for status to change to "Ready" (2-3 minutes)
5. Add store domain to /etc/hosts:
   ```bash
   echo "127.0.0.1 test-store.local" | sudo tee -a /etc/hosts
   ```
6. Open http://test-store.local
7. Complete WordPress setup wizard

## Local Setup (k3d)

### 1. Install k3d

```bash
# On macOS
brew install k3d

# On Linux
wget -q -O - https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash
```

### 2. Create Cluster

```bash
k3d cluster create ecommerce-platform \
  --api-port 6550 \
  --servers 1 \
  --agents 2 \
  --port 80:80@loadbalancer \
  --port 443:443@loadbalancer

kubectl cluster-info
```

### 3. Continue from Step 3 of Kind Setup

Follow steps 3-6 from the Kind setup above.

## Production Setup (k3s on VPS)

### Prerequisites
- Ubuntu 20.04+ VPS
- Root or sudo access
- Domain name pointing to VPS IP
- Minimum 4GB RAM, 2 CPU cores

### 1. Install k3s

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Install k3s
curl -sfL https://get.k3s.io | sh -

# Verify
kubectl get nodes
```

### 2. Install Helm

```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### 3. Configure DNS

Point your domain to your VPS IP:
```
Type  Name                    Value
A     dashboard.yourdomain.com    YOUR_VPS_IP
A     *.yourdomain.com            YOUR_VPS_IP
```

### 4. Update Production Values

Edit `helm/platform/values-prod.yaml`:

```yaml
global:
  domain: "yourdomain.com"  # Your actual domain
  storageClass: "local-path"  # k3s default

dashboard:
  ingress:
    host: "dashboard.yourdomain.com"
    tls:
      enabled: true  # Enable after setting up cert-manager

storeDefaults:
  mysql:
    rootPassword: ""  # Generate strong password
    password: ""      # Generate strong password
  ingress:
    tls:
      enabled: true  # Enable after setting up cert-manager
```

### 5. Install cert-manager (for HTTPS)

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --namespace cert-manager \
  --for=condition=ready pod \
  --all \
  --timeout=90s

# Create Let's Encrypt issuer
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

### 6. Deploy the Platform

```bash
# Copy project to VPS
scp -r k8s-ecommerce-platform root@your-vps-ip:/root/

# SSH into VPS
ssh root@your-vps-ip
cd k8s-ecommerce-platform

# Install
helm install ecommerce-platform ./helm/platform \
  -f ./helm/platform/values-prod.yaml \
  --create-namespace \
  --namespace ecommerce-platform

# Watch deployment
kubectl get pods -n ecommerce-platform -w
```

### 7. Access Your Platform

Visit https://dashboard.yourdomain.com

## Building Custom Docker Images

If you want to build and use your own images:

```bash
# Set your registry
REGISTRY="your-dockerhub-username"

# Build dashboard
cd dashboard
docker build -t $REGISTRY/ecommerce-dashboard:latest .
docker push $REGISTRY/ecommerce-dashboard:latest

# Build orchestrator
cd ../orchestrator
docker build -t $REGISTRY/ecommerce-orchestrator:latest .
docker push $REGISTRY/ecommerce-orchestrator:latest

# Update values.yaml
# dashboard.image.repository: your-dockerhub-username/ecommerce-dashboard
# orchestrator.image.repository: your-dockerhub-username/ecommerce-orchestrator
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n ecommerce-platform

# View pod logs
kubectl logs -n ecommerce-platform <pod-name>

# Describe pod for events
kubectl describe pod -n ecommerce-platform <pod-name>
```

### Store Not Accessible

```bash
# Check ingress
kubectl get ingress -n ecommerce-stores

# Check ingress controller logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller

# Verify /etc/hosts entry
cat /etc/hosts | grep local
```

### Storage Issues

```bash
# Check PVCs
kubectl get pvc -n ecommerce-stores

# Check storage class
kubectl get storageclass
```

### Dashboard Not Loading

```bash
# Check dashboard logs
kubectl logs -n ecommerce-platform deployment/dashboard

# Check orchestrator logs
kubectl logs -n ecommerce-platform deployment/orchestrator

# Verify service
kubectl get svc -n ecommerce-platform
```

## Cleanup

### Delete a Single Store
Use the dashboard UI or:
```bash
kubectl delete all,pvc,ingress -n ecommerce-stores -l app=store-name
```

### Uninstall Platform
```bash
helm uninstall ecommerce-platform -n ecommerce-platform
kubectl delete namespace ecommerce-platform ecommerce-stores
```

### Delete Cluster
```bash
# Kind
kind delete cluster --name ecommerce-platform

# k3d
k3d cluster delete ecommerce-platform

# k3s (on VPS)
/usr/local/bin/k3s-uninstall.sh
```

## Next Steps

- [Architecture Documentation](ARCHITECTURE.md)
- [Testing Guide](#testing-e2e-flow)
- [Security Hardening](#security-best-practices)
