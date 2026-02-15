# System Design & Tradeoffs

## Architecture Choice

### Why This Architecture?

**Core Decision: Kubernetes-Native with Namespace Isolation**

We chose a Kubernetes-native architecture where each store gets its own set of resources (Deployments, Services, PVCs) within a shared namespace (`ecommerce-stores`), rather than namespace-per-store or a shared multi-tenant database approach.

**Rationale:**
1. **Balance of Isolation vs Overhead**: Creating a namespace per store adds significant overhead (RBAC, NetworkPolicies per namespace). Our approach provides resource isolation through labels and separate deployments while keeping operational complexity manageable.

2. **Simplified Management**: Single namespace for all stores makes monitoring, logging, and resource quotas easier to manage at scale.

3. **Cost Efficiency**: Shared Kubernetes cluster means we don't waste resources on per-store control planes while still maintaining deployment isolation.

**Alternative Considered:**
- **Namespace-per-store**: Rejected due to increased complexity and resource overhead for small-to-medium deployments (10-100 stores)
- **Shared WordPress Multi-site**: Rejected because it doesn't provide true isolation and complicates resource limits
- **VM-per-store**: Rejected due to excessive overhead and slow provisioning times

### Component Architecture

**Orchestrator as Control Plane**
- Single source of truth for store operations
- Direct Kubernetes API interaction via official client library
- Stateless design allows horizontal scaling

**Dashboard as View Layer**
- React SPA for responsive UI
- Polling-based status updates (simple, reliable)
- Could be upgraded to WebSocket for real-time updates

**Store Pattern**
- Each store: 1 WordPress pod + 1 MySQL pod + dedicated PVCs
- Simple 1:1 relationship, easy to reason about
- MySQL as StatefulSet was considered but adds complexity for single-replica use case

---

## Idempotency & Failure Handling

### Idempotency Approach

**Current State: Partially Idempotent**

The system handles idempotency at these levels:

1. **Pre-Creation Check**
   ```javascript
   const existing = await k8sService.getStore(name);
   if (existing) {
     return res.status(409).json({ error: 'Store already exists' });
   }
   ```
   - Prevents duplicate store creation
   - Returns clear error if store name is taken

2. **Kubernetes-Level Idempotency**
   - Using `create` operations (not `apply`)
   - If resource exists, Kubernetes returns error
   - We catch and handle these errors

3. **Safe Retry Pattern**
   - Store creation can be retried by user
   - Failed resources are cleaned up via label selectors
   - No orphaned resources from partial failures

**Limitations:**
- If orchestrator crashes mid-provisioning, store is left in "Provisioning" state
- User must manually delete and recreate
- No automatic reconciliation loop

**Production Enhancement:**
Would implement a **reconciliation controller** (Kubernetes Operator pattern):
```
Every 30s:
  For each store in "Provisioning" status > 10 minutes:
    Check actual K8s resources
    If incomplete: mark Failed
    If complete: mark Ready
```

### Failure Handling

**Failure Scenarios & Responses:**

#### 1. Resource Creation Fails (e.g., PVC fails to bind)
```javascript
catch (error) {
  try {
    await this.deleteStore(storeName);  // Cleanup
  } catch (cleanupError) {
    console.error('Cleanup failed:', cleanupError);
  }
  throw error;
}
```
- **Action**: Automatic cleanup of all created resources
- **User Experience**: Error message, can retry
- **Guarantee**: No partial stores left behind

#### 2. MySQL Takes Too Long to Start
```javascript
await new Promise(resolve => setTimeout(resolve, 5000));
```
- **Current**: 5-second fixed wait
- **Issue**: May not be enough for slow storage
- **Production Fix**: Poll MySQL readiness probe instead of fixed wait

#### 3. Orchestrator Pod Crashes During Creation
- **Current State**: Store stuck in "Provisioning"
- **Mitigation**: User can delete via UI
- **Production**: Add reconciliation loop + timeout (10 min)

#### 4. Node Failure
- **WordPress/MySQL Pods**: Kubernetes reschedules automatically
- **PVCs**: Preserved, reattached on new node
- **Orchestrator**: Stateless, new pod takes over immediately

---

## Cleanup Guarantees

### Deletion Safety

**Label-Based Cleanup Strategy:**
```javascript
const labelSelector = `app=${storeName},managed-by=ecommerce-platform`;
```

All resources tagged with:
- `app: {storeName}` - Identifies which store
- `managed-by: ecommerce-platform` - Identifies as our resources

**Deletion Order (Reverse of Creation):**
1. Ingress (stop external traffic)
2. Deployments (terminate pods gracefully)
3. Services (remove network endpoints)
4. PVCs (delete data)

**Guarantees:**
✅ All store resources are deleted together
✅ Label selector ensures no missed resources
✅ Kubernetes handles graceful pod termination
✅ PVCs deleted = data removed (important for cleanup)

**Edge Cases:**
- ⚠️ If PVC is in "Terminating" state due to active mount: Waits for pod termination
- ⚠️ If manually created resources without labels: Not deleted (expected)

**Future Enhancement:**
- Add finalizers to ensure critical cleanup steps complete
- Backup PVCs before deletion (for data recovery)
- Soft delete with retention period

---

## Production Changes: Local → VPS

### What Changes via Helm Values?

#### 1. **Domain / Ingress**

**Local (`values-local.yaml`):**
```yaml
global:
  domain: "local"
ingress:
  className: "nginx"
  tls:
    enabled: false
```
- Stores accessible at: `storename.local`
- Requires `/etc/hosts` entries
- No TLS

**Production (`values-prod.yaml`):**
```yaml
global:
  domain: "yourdomain.com"
ingress:
  className: "nginx"
  tls:
    enabled: true
    issuer: "letsencrypt-prod"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
```
- Stores accessible at: `storename.yourdomain.com`
- Real DNS required
- Automatic TLS via cert-manager

#### 2. **Storage Class**

**Local:**
```yaml
global:
  storageClass: "standard"  # Kind/k3d default
```
- Uses local storage (hostPath or local-path-provisioner)
- Fast but non-persistent across cluster recreation

**Production:**
```yaml
global:
  storageClass: "gp3"  # AWS EBS
  # OR
  storageClass: "pd-ssd"  # GCP Persistent Disk
```
- Network-attached storage
- Persistent across node failures
- Backup-capable

#### 3. **Resource Limits**

**Local:**
```yaml
wordpress:
  resources:
    requests:
      memory: "256Mi"
      cpu: "100m"
    limits:
      memory: "512Mi"
      cpu: "500m"
mysql:
  resources:
    requests:
      memory: "512Mi"
      cpu: "100m"
```
- Conservative for laptop/desktop
- Allows multiple stores on limited resources

**Production:**
```yaml
wordpress:
  resources:
    requests:
      memory: "512Mi"
      cpu: "200m"
    limits:
      memory: "1Gi"
      cpu: "1000m"
mysql:
  resources:
    requests:
      memory: "1Gi"
      cpu: "250m"
```
- Higher limits for production traffic
- Better performance under load

#### 4. **Secrets Strategy**

**Local:**
```yaml
mysql:
  rootPassword: "changeme_root_password"  # ConfigMap/env vars
  password: "changeme_wp_password"
```
- Simple, stored in values file
- ⚠️ NOT secure, only for local testing

**Production Options:**

**Option A: Kubernetes Secrets**
```bash
kubectl create secret generic mysql-root \
  --from-literal=password=$(openssl rand -base64 32)
```
Then reference in Helm:
```yaml
mysql:
  existingSecret: "mysql-root"
```

**Option B: External Secrets Operator**
```yaml
externalSecrets:
  enabled: true
  backend: "aws-secrets-manager"
  secretName: "prod/ecommerce/mysql"
```

**Option C: Sealed Secrets**
- Encrypt secrets at rest in Git
- Decrypt only in-cluster

#### 5. **Replica Counts**

**Local:**
```yaml
dashboard:
  replicaCount: 1
orchestrator:
  replicaCount: 1
```

**Production:**
```yaml
dashboard:
  replicaCount: 2
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 5
orchestrator:
  replicaCount: 2
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
```

#### 6. **Monitoring & Logging**

**Production Additions:**
```yaml
monitoring:
  enabled: true
  prometheus:
    enabled: true
  grafana:
    enabled: true
logging:
  enabled: true
  loki:
    enabled: true
```

---

## Upgrade / Rollback with Helm

### Upgrade Strategy

**Scenario: Update WordPress version**

1. **Update values file:**
```yaml
wordpress:
  image:
    tag: "6.5-apache"  # was 6.4-apache
```

2. **Perform upgrade:**
```bash
helm upgrade ecommerce-platform ./helm/platform \
  -f ./helm/platform/values-prod.yaml \
  --namespace ecommerce-platform
```

3. **What happens:**
   - Platform components update (orchestrator, dashboard)
   - **Existing stores**: Unchanged (not retroactive)
   - **New stores**: Use new WordPress version

### Store Updates

**Current Limitation**: Existing stores don't auto-update.

**Manual Update Process:**
```bash
kubectl set image deployment/mystore-wordpress \
  wordpress=wordpress:6.5-apache \
  -n ecommerce-stores
```

**Future Enhancement**: Add "Update Store" API endpoint:
```javascript
POST /api/stores/{id}/update
{
  "wordpressVersion": "6.5",
  "strategy": "rolling"  // or "recreate"
}
```

### Rollback

**Rollback Helm release:**
```bash
helm rollback ecommerce-platform 1  # revision number
```

**Guarantees:**
- Platform components revert to previous version
- Existing stores continue running
- Values file rolled back

**What's NOT rolled back:**
- Store data (PVCs unchanged)
- Already-created stores
- Kubernetes secrets

---

## Scaling & Performance

### Current Bottlenecks

1. **Orchestrator is Single Point**: Only 1 replica can safely create stores (no distributed locking)
2. **MySQL is Single Replica**: No HA, no replication
3. **Storage is Node-Local**: In local setup, PVCs tied to specific node

### Horizontal Scaling Plan

**Platform Components:**
```yaml
# Can scale immediately
orchestrator:
  replicaCount: 3

dashboard:
  replicaCount: 5
```

**Store Components (Future):**
- MySQL as StatefulSet with replica pods
- WordPress as Deployment with 3+ replicas
- Shared storage (NFS/EFS) or database replication

### Concurrency Handling

**Current:** Sequential store creation (one at a time)

**Improvement Needed:** Add queue:
```javascript
// Bull queue with Redis backend
const storeQueue = new Bull('store-creation');

storeQueue.process(async (job) => {
  await k8sService.createStore(job.data.storeName);
});
```

Benefits:
- Handle 10+ concurrent requests
- Retry failed creations
- Rate limiting built-in

---

## Security Considerations

### Current Security Posture

**Implemented:**
✅ RBAC with dedicated ServiceAccount for orchestrator
✅ Namespace isolation between platform and stores
✅ Resource limits to prevent resource exhaustion
✅ Input validation (store names)
✅ No hardcoded secrets in code

**Missing (Production Required):**
❌ NetworkPolicies (pods can talk to any pod)
❌ Pod Security Standards (containers run as root)
❌ Secrets encryption at rest
❌ TLS between components
❌ Rate limiting on API endpoints

### Production Hardening Checklist

1. **Enable Pod Security Standards:**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ecommerce-stores
  labels:
    pod-security.kubernetes.io/enforce: restricted
```

2. **Add NetworkPolicies:**
```yaml
# Allow WordPress → MySQL only within same store
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-wordpress-to-mysql
spec:
  podSelector:
    matchLabels:
      component: mysql
  ingress:
  - from:
    - podSelector:
        matchLabels:
          component: wordpress
```

3. **Run containers as non-root:**
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000
```

4. **Enable audit logging:**
```yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
- level: RequestResponse
  verbs: ["create", "delete"]
  resources:
  - group: ""
    resources: ["deployments", "services"]
```

---

## Trade-offs Summary

| Decision | Benefit | Trade-off | Mitigation |
|----------|---------|-----------|------------|
| Single namespace for stores | Simple management | Less isolation | ResourceQuotas + labels |
| Polling for status | Simple, reliable | Not real-time | 5s interval acceptable |
| No reconciliation loop | Faster to build | Manual intervention needed | Document recovery steps |
| Fixed MySQL wait time | Simple | May fail on slow storage | Add in production |
| Label-based cleanup | Reliable, atomic | Must trust labels | Validate in tests |
| Values-based config | Portable | Secrets in values file | External secrets for prod |

---

## Future Roadmap

**Phase 1 (Current):** ✅ Basic store provisioning
**Phase 2:** Reconciliation loop, better error handling
**Phase 3:** MedusaJS support, multiple engines
**Phase 4:** Auto-scaling, HA MySQL, metrics
**Phase 5:** Multi-region, CDN integration, billing

This architecture provides a **solid MVP** that can evolve into a **production-grade platform** through iterative improvements while maintaining the core design principles.
