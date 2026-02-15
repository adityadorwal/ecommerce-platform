# Quick Reference Guide

## TL;DR - Get Started in 5 Minutes

```bash
# 1. Extract the zip file
unzip k8s-ecommerce-platform.zip
cd k8s-ecommerce-platform

# 2. Run the automated setup (requires: kind, kubectl, helm, docker)
./quick-start.sh

# 3. Access the dashboard
kubectl port-forward -n ecommerce-platform svc/dashboard 3000:80
# Open http://localhost:3000

# 4. Create a store via the UI, then add to /etc/hosts
echo "127.0.0.1 mystore.local" | sudo tee -a /etc/hosts

# 5. Visit your store
# http://mystore.local
```

## Using Makefile

```bash
# Complete setup
make setup-local

# Port forward to dashboard
make port-forward

# View status
make status

# View logs
make logs-dashboard
make logs-orchestrator

# Cleanup
make clean
```

## Manual Steps

### Build Images

```bash
./build-images.sh
```

### Create Cluster (Kind)

```bash
kind create cluster --name ecommerce-platform
```

### Install Ingress

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
```

### Load Images (Kind)

```bash
kind load docker-image ecommerce-dashboard:latest --name ecommerce-platform
kind load docker-image ecommerce-orchestrator:latest --name ecommerce-platform
```

### Install Platform

```bash
helm install ecommerce-platform ./helm/platform \
  -f ./helm/platform/values-local.yaml \
  --create-namespace \
  --namespace ecommerce-platform
```

## Common Commands

### Check Status

```bash
kubectl get pods -n ecommerce-platform
kubectl get pods -n ecommerce-stores
kubectl get ingress -n ecommerce-stores
```

### View Logs

```bash
kubectl logs -n ecommerce-platform -l app=dashboard --tail=100 -f
kubectl logs -n ecommerce-platform -l app=orchestrator --tail=100 -f
```

### Access Services

```bash
# Dashboard
kubectl port-forward -n ecommerce-platform svc/dashboard 3000:80

# Orchestrator API
kubectl port-forward -n ecommerce-platform svc/orchestrator 4000:80
```

### List Stores

```bash
kubectl get all -n ecommerce-stores
```

### Delete a Store

Use the UI or:

```bash
kubectl delete all,pvc,ingress -n ecommerce-stores -l app=store-name
```

## Troubleshooting

### Pods Not Starting

```bash
kubectl describe pod -n ecommerce-platform <pod-name>
kubectl logs -n ecommerce-platform <pod-name>
```

### Images Not Found

Make sure you built and loaded them:

```bash
./build-images.sh
kind load docker-image ecommerce-dashboard:latest --name ecommerce-platform
kind load docker-image ecommerce-orchestrator:latest --name ecommerce-platform
```

### Store Not Accessible

1. Check ingress: `kubectl get ingress -n ecommerce-stores`
2. Add to /etc/hosts: `echo "127.0.0.1 storename.local" | sudo tee -a /etc/hosts`
3. Check ingress controller logs:
   ```bash
   kubectl logs -n ingress-nginx deployment/ingress-nginx-controller
   ```

### API Not Responding

```bash
# Check orchestrator
kubectl get pods -n ecommerce-platform -l app=orchestrator

# Check logs
kubectl logs -n ecommerce-platform -l app=orchestrator

# Test API directly
kubectl port-forward -n ecommerce-platform svc/orchestrator 4000:80
curl http://localhost:4000/health
```

## Configuration

### Local vs Production

- **Local:** `values-local.yaml` - Lower resources, .local domain
- **Production:** `values-prod.yaml` - Higher resources, real domain, TLS

### Environment Variables

Edit in `helm/platform/values.yaml`:

- `global.domain` - Base domain for stores
- `global.storageClass` - Kubernetes storage class
- `storeDefaults.mysql.password` - MySQL password (change in production!)

## Project Structure

```
k8s-ecommerce-platform/
├── helm/platform/          # Main Helm chart
│   ├── values.yaml        # Default configuration
│   ├── values-local.yaml  # Local overrides
│   ├── values-prod.yaml   # Production overrides
│   └── templates/         # Kubernetes manifests
├── dashboard/             # React frontend
├── orchestrator/          # Node.js backend
├── docs/                  # Documentation
│   ├── SETUP.md          # Detailed setup guide
│   └── ARCHITECTURE.md   # Technical details
├── quick-start.sh        # Automated setup script
├── build-images.sh       # Build Docker images
├── verify.sh            # Verify installation
└── Makefile             # Convenience commands
```

## Next Steps

1. Read [docs/SETUP.md](docs/SETUP.md) for detailed instructions
2. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for technical details
3. Test E2E flow: Create store → Add product → Complete order
4. Customize values.yaml for your needs
5. Deploy to production with values-prod.yaml

## Support

- Issues: Open a GitHub issue
- Questions: See docs/ folder
- Contributing: See CONTRIBUTING.md
