# 🚀 Start Here - E-commerce Platform

Welcome to your Kubernetes Multi-Tenant E-commerce Platform!

## What is this?

A production-ready platform that lets you:
- **Spin up new WooCommerce stores on-demand** with a single click
- **Fully isolated stores** - each gets its own WordPress + MySQL deployment
- **Works anywhere** - local (Kind/k3d/Minikube) or production (k3s/EKS/GKE/AKS)
- **Helm-based** - easy configuration management
- **Web UI** - beautiful React dashboard to manage everything

## 📋 What You Need

- **Docker** - To build images
- **kubectl** - To interact with Kubernetes
- **Helm 3** - To deploy the platform
- **One of:** Kind, k3d, or Minikube (for local) OR k3s/managed K8s (for production)

## ⚡ Quickest Start (5 minutes)

```bash
# Make scripts executable
chmod +x *.sh

# Run the automated installer
./quick-start.sh

# Wait for it to finish, then:
kubectl port-forward -n ecommerce-platform svc/dashboard 3000:80

# Open http://localhost:3000
```

That's it! You now have a working platform.

## 📁 What's Included

```
├── README.md              ← Overview and features
├── QUICKREF.md           ← Quick reference guide
├── quick-start.sh        ← Automated setup script
├── build-images.sh       ← Build Docker images
├── verify.sh            ← Verify installation
├── Makefile             ← Convenience commands
├── helm/                ← Helm charts
│   └── platform/        
│       ├── values.yaml          ← Default config
│       ├── values-local.yaml    ← Local settings
│       └── values-prod.yaml     ← Production settings
├── dashboard/           ← React frontend code
├── orchestrator/        ← Node.js backend code
└── docs/
    ├── SETUP.md         ← Detailed setup guide
    └── ARCHITECTURE.md  ← Technical architecture
```

## 🎯 Recommended Reading Order

1. **This file** (START_HERE.md) - You are here!
2. **QUICKREF.md** - Quick commands and troubleshooting
3. **README.md** - Full overview
4. **docs/SETUP.md** - Detailed setup for different environments
5. **docs/ARCHITECTURE.md** - Deep dive into the technical architecture

## 🛠️ Using the Makefile (Recommended)

```bash
# Complete setup (builds images, creates cluster, installs)
make setup-local

# Access dashboard
make port-forward

# Check status
make status

# View logs
make logs-dashboard
make logs-orchestrator

# Clean everything
make clean
```

## 🎮 Testing the Platform

Once the dashboard is running:

1. **Create a store:**
   - Click the floating "+" button
   - Enter a name like "mystore"
   - Click Create

2. **Wait for it to become Ready** (2-3 minutes)

3. **Access your store:**
   ```bash
   echo "127.0.0.1 mystore.local" | sudo tee -a /etc/hosts
   ```
   Then visit: http://mystore.local

4. **Complete WordPress setup:**
   - Choose language
   - Set admin credentials
   - Install WooCommerce
   - Add a product
   - Test checkout with "Cash on Delivery"

## 🌍 Environments

### Local Development
- Uses `values-local.yaml`
- Lower resource limits
- `.local` domains
- No TLS

### Production
- Uses `values-prod.yaml`
- Higher resource limits
- Real domains
- TLS with cert-manager

## 🔧 Configuration

All configuration is in Helm values files:

- **Domain:** Change `global.domain` in values.yaml
- **Resources:** Adjust under `storeDefaults`
- **Passwords:** CHANGE `mysql.password` and `mysql.rootPassword` in production!

## 🚨 Important Notes

### For Production:
1. **Change all default passwords** in `values-prod.yaml`
2. **Set up TLS** with cert-manager (instructions in SETUP.md)
3. **Use proper storage class** for your cloud provider
4. **Set your actual domain** in `global.domain`

### For Local:
1. **Add stores to /etc/hosts** manually: `127.0.0.1 storename.local`
2. **Port forwarding required** to access dashboard
3. **Resources are minimal** - may be slow on machines with <8GB RAM

## 📊 What Happens When You Create a Store?

1. Dashboard sends API request to Orchestrator
2. Orchestrator creates Kubernetes resources:
   - 2 PersistentVolumeClaims (WordPress + MySQL data)
   - 2 Services (WordPress + MySQL)
   - 2 Deployments (WordPress + MySQL pods)
   - 1 Ingress (external access)
3. Kubernetes schedules the pods
4. WordPress connects to MySQL
5. Status changes to "Ready"
6. You can access the store!

## 🆘 Troubleshooting

**Pods not starting?**
```bash
kubectl get pods -n ecommerce-platform
kubectl describe pod -n ecommerce-platform <pod-name>
kubectl logs -n ecommerce-platform <pod-name>
```

**Images not found?**
```bash
./build-images.sh
kind load docker-image ecommerce-dashboard:latest --name ecommerce-platform
kind load docker-image ecommerce-orchestrator:latest --name ecommerce-platform
```

**Store not accessible?**
```bash
# Check ingress
kubectl get ingress -n ecommerce-stores

# Add to hosts file
echo "127.0.0.1 yourstore.local" | sudo tee -a /etc/hosts
```

See **QUICKREF.md** for more troubleshooting.

## 🎓 Next Steps

Once you have the platform running:

1. **Explore the code** - See how it works
2. **Customize values** - Adjust to your needs
3. **Add features** - See CONTRIBUTING.md
4. **Deploy to production** - Follow docs/SETUP.md production guide
5. **Scale it** - Add more stores, increase resources

## 📚 Documentation

- **QUICKREF.md** - Quick commands and common tasks
- **README.md** - Project overview and features
- **docs/SETUP.md** - Step-by-step setup for all environments
- **docs/ARCHITECTURE.md** - Technical deep dive
- **CONTRIBUTING.md** - How to contribute

## 💡 Key Features

✅ **On-demand store provisioning** - Create stores instantly via UI
✅ **Full isolation** - Each store has dedicated resources
✅ **Auto-scaling ready** - Deploy anywhere from laptop to cloud
✅ **Production-tested** - Real Kubernetes best practices
✅ **Well-documented** - Every component explained
✅ **Open source** - MIT licensed, customize freely

## 🤝 Getting Help

- Read the docs (start with QUICKREF.md)
- Check troubleshooting section
- Run `./verify.sh` to diagnose issues
- Review logs: `make logs-dashboard` or `make logs-orchestrator`

## ⭐ What Makes This Special?

Unlike typical e-commerce platforms:
- **Multi-tenant by design** - Not an afterthought
- **Kubernetes-native** - Leverages K8s primitives
- **Portable** - Same code, local to production
- **Developer-friendly** - Easy to understand and extend
- **Complete** - Dashboard, backend, stores all included

---

## Ready to Start?

```bash
./quick-start.sh
```

Enjoy your new e-commerce platform! 🎉
