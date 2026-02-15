# 🎥 DEMO VIDEO SCRIPT - READ THIS EXACTLY

## ⏱️ Total Time: 12-15 minutes

---

## 🎬 SECTION 1: INTRODUCTION (1 minute)

**[Show your face or just screen - your choice]**

"Hi, I'm [Your Name], and today I'm demoing my Kubernetes Multi-Tenant E-commerce Platform for the Urumi SDE Internship assessment.

This platform allows users to spin up fully isolated WooCommerce stores on-demand using Kubernetes. I'll walk you through the architecture, show a live demo, and explain how it's production-ready.

Let's start with the architecture."

---

## 🎬 SECTION 2: ARCHITECTURE & COMPONENTS (3 minutes)

**[Screen: Open docs/ARCHITECTURE.md or draw diagram]**

"The system has three main layers:

**First, the User Layer:**
- React dashboard for store management
- End users who shop on the stores

**Second, the Control Plane:**
- Node.js Orchestrator that talks to the Kubernetes API
- It creates and manages all store resources
- NGINX Ingress Controller for routing traffic

**Third, the Store Layer:**
- Each store gets its own WordPress and MySQL pods
- Dedicated Persistent Volume Claims for data
- Isolated via Kubernetes labels and separate deployments

**[Click through the code structure]**

The code is organized into:
- `dashboard/` - React frontend with Material-UI
- `orchestrator/` - Node.js backend using the official Kubernetes client library
- `helm/platform/` - Helm charts for deployment
  - values-local.yaml for local development
  - values-prod.yaml for production

**Key Design Decisions:**

1. **Why not namespace-per-store?** Too much overhead. We use a single namespace with label-based isolation.

2. **Why WordPress + MySQL separately?** Each component can scale independently and fail independently.

3. **Why Helm?** Makes it portable - same charts work locally and in production, just different values.

Alright, let's see it in action."

---

## 🎬 SECTION 3: LIVE DEMO - END-TO-END (6 minutes)

### Part A: Setup & Deploy (2 min)

**[Screen: Terminal]**

"I'm starting with a fresh Kind cluster. Let me show you how easy deployment is.

```bash
# Show you have Kind installed
kind version

# Create cluster
kind create cluster --name demo-ecommerce

# Show cluster is ready
kubectl cluster-info
kubectl get nodes
```

Now I'll build and load the Docker images:

```bash
# Build images
./build-images.sh

# Load into Kind
kind load docker-image ecommerce-dashboard:latest --name demo-ecommerce
kind load docker-image ecommerce-orchestrator:latest --name demo-ecommerce
```

Install NGINX Ingress:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# Wait for it
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s
```

Now deploy our platform:

```bash
helm install ecommerce-platform ./helm/platform \
  -f ./helm/platform/values-local.yaml \
  --create-namespace \
  --namespace ecommerce-platform

# Show everything starting
kubectl get pods -n ecommerce-platform
```

Let me port-forward the dashboard:

```bash
kubectl port-forward -n ecommerce-platform svc/dashboard 3000:80
```

Opening http://localhost:3000..."

### Part B: Create Store (2 min)

**[Screen: Browser showing dashboard]**

"Here's the dashboard. You can see it's clean and shows no stores yet.

I'll create a new store called 'electronics'. 

**[Click the + button]**

Notice I have two options here: WooCommerce and MedusaJS. MedusaJS is coming soon - the architecture supports it, but for this demo I've fully implemented WooCommerce.

**[Select WooCommerce, type 'electronics', click Create]**

The store is now being created. Behind the scenes, the orchestrator is:
1. Creating 2 PersistentVolumeClaims
2. Creating 2 Services
3. Creating MySQL Deployment
4. Waiting for MySQL to be ready
5. Creating WordPress Deployment
6. Creating Ingress

**[Show terminal with kubectl commands]**

```bash
kubectl get all -n ecommerce-stores -l app=electronics
```

You can see all the resources being created. The MySQL pod is starting, WordPress is waiting.

The status in the dashboard says 'Provisioning'. It's polling the API every 5 seconds to check readiness.

**[Wait ~30-60 seconds]**

There we go - status changed to 'Ready'. The store is now accessible."

### Part C: Place Order (2 min)

**[Screen: Terminal]**

"To access the store locally, I need to add it to my hosts file:

```bash
echo '127.0.0.1 electronics.local' | sudo tee -a /etc/hosts
```

**[Screen: Browser]**

Opening http://electronics.local in a new tab...

**[First time, WordPress setup wizard appears]**

WordPress setup wizard. I'll fill this in quickly:
- Site Title: Electronics Store
- Username: admin
- Password: [any password]
- Email: [any email]

**[Click Install WordPress]**

WordPress installed! Now I need to install WooCommerce.

**[Go to Plugins → Add New → Search 'WooCommerce']**

Installing WooCommerce... **[This might take 30-60 seconds]**

Setup wizard for WooCommerce:
- Store Address: [fill in]
- Industry: Electronics
- Skip extra features for now

**[Once setup complete, go to Products → Add New]**

Let me add a quick product:
- Name: Wireless Headphones
- Price: $99.99
- Publish

**[Visit Store/Shop page]**

Here's our storefront. I can add this product to cart...

**[Add to cart, go to checkout]**

At checkout, I'll use Cash on Delivery which is enabled by default:
- First Name: Test
- Last Name: User
- Address: [fill in]
- City: [any city]
- Email: test@example.com

**[Place Order]**

Order placed! 

**[Go to WooCommerce → Orders in admin]**

And here's the order in the admin panel. **This proves the end-to-end flow works.**

Let me go back to the dashboard."

---

## 🎬 SECTION 4: ISOLATION & RESOURCES (2 minutes)

**[Screen: Terminal]**

"Let me show you how stores are isolated.

```bash
# Show namespace isolation
kubectl get ns

# Two namespaces: ecommerce-platform and ecommerce-stores
```

**[Show resources]**

```bash
# All stores live in ecommerce-stores namespace
kubectl get pods -n ecommerce-stores

# Each store has labels
kubectl get pods -n ecommerce-stores -l app=electronics --show-labels
```

Notice the labels: `app=electronics` and `managed-by=ecommerce-platform`. This is how we track and manage resources.

**[Show resource limits]**

```bash
kubectl describe pod electronics-wordpress-xxx -n ecommerce-stores | grep -A 5 "Limits"
```

Each pod has:
- CPU requests and limits
- Memory requests and limits
- Readiness and Liveness probes

This prevents one store from consuming all cluster resources.

**[Show PVCs]**

```bash
kubectl get pvc -n ecommerce-stores
```

Each store gets dedicated storage that persists even if pods restart.

**Idempotency:** If I try to create 'electronics' again...

**[Go to dashboard, try creating 'electronics' again]**

You'll see an error: 'Store already exists'. The system checks before creating.

**Failure Handling:** If something fails during provisioning, all resources are automatically cleaned up. No orphaned resources."

---

## 🎬 SECTION 5: SECURITY POSTURE (2 minutes)

**[Screen: Terminal or doc]**

"Let's talk security.

**What's Implemented:**

1. **RBAC:** The orchestrator runs with a ServiceAccount that has limited permissions:

```bash
kubectl get serviceaccount -n ecommerce-platform
kubectl describe serviceaccount orchestrator -n ecommerce-platform
```

Only has permissions for: deployments, services, ingresses, PVCs in specific namespaces.

2. **Namespace Isolation:** Platform components are separate from stores.

3. **Resource Limits:** Every pod has CPU and memory limits to prevent DoS.

4. **Input Validation:** Store names are validated - only lowercase alphanumeric and hyphens.

5. **Rate Limiting:** Built-in abuse prevention:
   - Max 3 stores per hour per IP
   - Max 5 total stores per IP
   - Returns 429 error with retry-after header

6. **No Hardcoded Secrets:** All sensitive data comes from environment variables or Helm values.

7. **Health Checks:** Every pod has readiness and liveness probes so Kubernetes can detect and restart unhealthy containers.

**What's Exposed:**
- Dashboard: Internal to cluster (accessed via port-forward or internal ingress)
- Store fronts: Public via Ingress
- MySQL: ClusterIP only, not accessible from outside

**Production Additions Needed:**
- NetworkPolicies to restrict pod-to-pod communication
- Containers running as non-root user
- Secrets encrypted at rest with KMS
- TLS for ingress (already configured in values-prod.yaml with cert-manager)

The architecture follows principle of least privilege."

---

## 🎬 SECTION 6: HORIZONTAL SCALING (1 minute)

**[Screen: Show Helm values or explain]**

"Currently we run single replicas, but horizontal scaling is straightforward:

**Dashboard and Orchestrator:**
These are stateless and can scale immediately:

```yaml
dashboard:
  replicaCount: 3
orchestrator:
  replicaCount: 3
```

Just change the values and helm upgrade.

**Provisioning Throughput:**
Currently sequential. To handle concurrent store creation, I'd add a job queue:
- Use Bull with Redis backend
- Process N stores in parallel
- Automatic retry on failure

**Store Components:**
- WordPress: Can scale to multiple replicas with shared storage (NFS/EFS)
- MySQL: Would need to move to StatefulSet with replication for HA

**Constraints:**
- MySQL is stateful - needs careful handling
- PVCs are tied to availability zones in cloud
- Would use cloud-managed databases (RDS, Cloud SQL) in production

The platform itself scales easily. Individual stores would need more work for high traffic."

---

## 🎬 SECTION 7: ABUSE PREVENTION (1 minute)

**[Screen: Show code or explain]**

"I've implemented several abuse prevention mechanisms:

**Rate Limiting:**
- In-memory tracking of store creation by IP address
- Max 3 stores per hour
- Max 5 total stores per user
- Returns HTTP 429 with Retry-After header

**Resource Quotas (Planned):**
Would add Kubernetes ResourceQuota per namespace:
```yaml
hard:
  requests.cpu: "10"
  requests.memory: "20Gi"
  persistentvolumeclaims: "10"
```

**Provisioning Timeouts:**
Stores that stay in 'Provisioning' for more than 10 minutes should be marked as Failed. This is documented in the tradeoffs document but not yet implemented.

**Audit Trail:**
All store creation and deletion is logged with IP addresses:
```
Creating woocommerce store: electronics for IP: 127.0.0.1
Deleting store: electronics by IP: 127.0.0.1
```

**Future Enhancements:**
- Per-user authentication and quotas
- Storage size limits per store
- CPU/memory limits per user
- Automatic cleanup of unused stores
- Cost tracking and billing integration"

---

## 🎬 SECTION 8: LOCAL-TO-VPS PRODUCTION (2 minutes)

**[Screen: Show values files]**

"The same Helm charts work in production. Here's what changes:

**[Open values-local.yaml and values-prod.yaml side by side]**

**Domain:**
- Local: `.local` (requires /etc/hosts)
- Prod: `yourdomain.com` (real DNS)

**Ingress:**
- Local: No TLS
- Prod: TLS enabled with cert-manager and Let's Encrypt

```yaml
ingress:
  tls:
    enabled: true
    issuer: "letsencrypt-prod"
```

**Storage Class:**
- Local: `standard` (local storage)
- Prod: `gp3` on AWS or `pd-ssd` on GCP (network storage)

**Resources:**
- Local: 256Mi RAM, 100m CPU
- Prod: 1Gi RAM, 500m CPU

**Secrets:**
- Local: In values file (NOT secure, just for testing)
- Prod: Kubernetes Secrets or external secret manager (AWS Secrets Manager, Vault)

**Replica Counts:**
- Local: 1 replica each
- Prod: 2-3 replicas with autoscaling

**To deploy on VPS with k3s:**

```bash
# Install k3s
curl -sfL https://get.k3s.io | sh -

# Install cert-manager for TLS
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.12.0/cert-manager.yaml

# Deploy platform
helm install ecommerce-platform ./helm/platform \
  -f ./helm/platform/values-prod.yaml \
  --namespace ecommerce-platform \
  --create-namespace

# Point DNS A records
# *.yourdomain.com → VPS IP address
```

**Upgrade/Rollback:**

Upgrade to new version:
```bash
helm upgrade ecommerce-platform ./helm/platform \
  -f ./helm/platform/values-prod.yaml
```

Rollback if something breaks:
```bash
helm rollback ecommerce-platform 1
```

Helm tracks all releases and makes rollback safe."

---

## 🎬 SECTION 9: CLEANUP & CONCLUSION (1 minute)

**[Screen: Dashboard]**

"Let me quickly show deletion works cleanly.

**[Click delete on the store, confirm]**

Deleting... **[Shows terminal]**

```bash
kubectl get all -n ecommerce-stores -l app=electronics
```

All resources are being terminated. **[Wait a few seconds]**

```bash
kubectl get all -n ecommerce-stores -l app=electronics
```

No resources left. Clean deletion confirmed.

---

**Summary:**

I've built a production-ready Kubernetes platform that:
✅ Provisions WooCommerce stores on-demand
✅ Full end-to-end order placement works
✅ Uses Helm for portable deployment
✅ Has proper isolation, resource limits, and health checks
✅ Includes rate limiting and abuse prevention
✅ Works locally and in production with just config changes
✅ Architecture supports adding MedusaJS easily

**What makes this production-ready:**
- Proper error handling with cleanup
- Health probes for reliability
- RBAC for security
- Resource limits for stability
- Helm for operability
- Comprehensive documentation

**GitHub repo:** [say your repo URL]

**All code, docs, and this demo are included.**

Thank you!"

---

## 📝 RECORDING TIPS:

1. **Practice once** - Do a dry run before recording
2. **Don't worry about perfection** - Minor mistakes are OK
3. **Show your work** - They want to see you know what you built
4. **Be confident** - You understand the code now
5. **Keep it under 15 minutes** - They have many videos to watch

## ✅ CHECKLIST BEFORE RECORDING:

- [ ] Clean up /etc/hosts file
- [ ] Delete any existing Kind clusters
- [ ] Have all terminal commands ready in a file to copy-paste
- [ ] Browser tabs ready (dashboard, store)
- [ ] Screen recording software tested
- [ ] Audio working (test microphone)
- [ ] Practice the script once

## 🎬 RECOMMENDED RECORDING SOFTWARE:

- **Mac:** QuickTime or OBS Studio
- **Windows:** OBS Studio or Xbox Game Bar
- **Linux:** OBS Studio or SimpleScreenRecorder

## 📤 WHERE TO UPLOAD:

1. **YouTube** (Unlisted) - Best quality, easy sharing
2. **Google Drive** - Simple, accessible
3. **Loom** - Professional, easy to use

**Make sure the link is PUBLIC/ACCESSIBLE** before submitting!

Good luck! You've got this! 🚀
