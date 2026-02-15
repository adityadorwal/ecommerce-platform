# Architecture Documentation

## Overview

The E-commerce Platform is a Kubernetes-native multi-tenant system designed to provision and manage isolated WooCommerce stores on-demand. It follows cloud-native principles and leverages Kubernetes primitives for scalability, resilience, and portability.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Layer                           │
│  ┌──────────────┐                    ┌──────────────┐       │
│  │   Browser    │                    │Store Customers│       │
│  └──────┬───────┘                    └──────┬───────┘       │
│         │                                    │               │
└─────────┼────────────────────────────────────┼───────────────┘
          │                                    │
          │                                    │
┌─────────▼────────────────────────────────────▼───────────────┐
│                    Ingress Layer (NGINX)                      │
│  ┌──────────────────────┐    ┌──────────────────────┐       │
│  │ dashboard.local      │    │ store1.local         │       │
│  └──────────┬───────────┘    └──────────┬───────────┘       │
└─────────────┼──────────────────────────┼─────────────────────┘
              │                          │
┌─────────────▼──────────────────────────▼─────────────────────┐
│              Kubernetes Services Layer                        │
│  ┌──────────▼───────────┐    ┌──────────▼───────────┐       │
│  │ Dashboard Service    │    │ WordPress Service    │       │
│  └──────────┬───────────┘    └──────────┬───────────┘       │
└─────────────┼──────────────────────────┼─────────────────────┘
              │                          │
┌─────────────▼──────────────────────────▼─────────────────────┐
│                  Application Layer                            │
│  ┌──────────────────────┐    ┌──────────────────────┐       │
│  │  Dashboard (React)   │    │  WordPress Pod       │       │
│  │  ┌────────────────┐  │    │  ┌────────────────┐  │       │
│  │  │ React Frontend │  │    │  │  WooCommerce   │  │       │
│  │  └────────────────┘  │    │  └────────────────┘  │       │
│  └──────────────────────┘    └──────────┬───────────┘       │
│  ┌──────────────────────┐               │                   │
│  │ Orchestrator(Node.js)│               │                   │
│  │  ┌────────────────┐  │    ┌──────────▼───────────┐       │
│  │  │  K8s API Client│  │    │  MySQL Pod           │       │
│  │  │  REST API      │  │    │  ┌────────────────┐  │       │
│  │  └────────────────┘  │    │  │  Database      │  │       │
│  └──────────┬───────────┘    │  └────────────────┘  │       │
└─────────────┼──────────────────────────┬─────────────────────┘
              │                          │
┌─────────────▼──────────────────────────▼─────────────────────┐
│                  Persistence Layer                            │
│  ┌──────────────────────┐    ┌──────────────────────┐       │
│  │   Config (ConfigMap) │    │  PersistentVolume    │       │
│  └──────────────────────┘    └──────────────────────┘       │
└───────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Dashboard (Frontend)

**Technology:** React 18 + Material-UI

**Responsibilities:**
- Display list of all provisioned stores
- Show store status (Provisioning, Ready, Failed)
- Provide UI for creating new stores
- Provide UI for deleting stores
- Real-time status updates via polling

**Key Files:**
- `src/App.js` - Main application component
- `src/components/StoreList.js` - Store listing with status
- `src/components/CreateStoreDialog.js` - Store creation form
- `src/services/api.js` - API client

**Communication:**
- REST API calls to Orchestrator via HTTP
- Polls every 5 seconds for status updates

### 2. Orchestrator (Backend)

**Technology:** Node.js + Express + @kubernetes/client-node

**Responsibilities:**
- Expose REST API for store management
- Interact with Kubernetes API to create/delete resources
- Monitor store deployment status
- Apply Helm values to store configurations
- Validate store names and requests

**Key Files:**
- `src/server.js` - Express server setup
- `src/controllers/storeController.js` - HTTP request handlers
- `src/services/k8sService.js` - Kubernetes API interactions
- `src/utils/validators.js` - Input validation

**Kubernetes Permissions (RBAC):**
```yaml
Resources: namespaces, pods, services, deployments, 
           ingresses, pvcs, configmaps, secrets
Verbs: get, list, create, delete, update, patch, watch
```

**API Endpoints:**
- `GET /api/stores` - List all stores
- `POST /api/stores` - Create new store
- `GET /api/stores/:id` - Get store details
- `DELETE /api/stores/:id` - Delete store
- `GET /health` - Health check

### 3. Store Components (WooCommerce)

Each store consists of:

#### WordPress + WooCommerce Pod
- **Image:** wordpress:6.4-apache
- **Purpose:** Web server + PHP + WordPress + WooCommerce
- **Configuration:**
  - Database credentials via environment variables
  - Persistent volume for uploads and themes
  - Resource limits defined in Helm values

#### MySQL Pod
- **Image:** mysql:8.0
- **Purpose:** Dedicated database for the store
- **Configuration:**
  - Root and user passwords
  - Database name and user credentials
  - Persistent volume for data
  - Resource limits defined in Helm values

#### Services
- **WordPress Service:** ClusterIP on port 80
- **MySQL Service:** ClusterIP on port 3306

#### Ingress
- **Purpose:** External access to the store
- **Host:** `{storename}.{domain}`
- **Backend:** WordPress service
- **Annotations:** Configurable (proxy size, TLS, etc.)

#### Persistent Volumes
- **WordPress PVC:** Stores uploads, themes, plugins
- **MySQL PVC:** Stores database files
- **Storage Class:** Configurable (standard, gp2, etc.)

## Data Flow

### Store Creation Flow

```
1. User clicks "Create Store" in Dashboard
   ↓
2. Dashboard sends POST /api/stores {name: "mystore"}
   ↓
3. Orchestrator validates store name
   ↓
4. Orchestrator checks if store already exists
   ↓
5. Orchestrator creates Kubernetes resources:
   a. MySQL PVC
   b. WordPress PVC
   c. MySQL Service
   d. WordPress Service
   e. MySQL Deployment
   f. WordPress Deployment (waits 5s for MySQL)
   g. Ingress
   ↓
6. Orchestrator returns 201 Created with store metadata
   ↓
7. Dashboard shows "Provisioning" status
   ↓
8. Dashboard polls GET /api/stores every 5 seconds
   ↓
9. Orchestrator checks deployment readiness
   ↓
10. When all pods are ready, status becomes "Ready"
    ↓
11. User can access store at http://mystore.local
```

### Store Deletion Flow

```
1. User clicks delete button
   ↓
2. User confirms deletion
   ↓
3. Dashboard sends DELETE /api/stores/mystore
   ↓
4. Orchestrator deletes resources in order:
   a. Ingress
   b. Deployments
   c. Services
   d. PVCs
   ↓
5. Orchestrator returns 200 OK
   ↓
6. Dashboard removes store from list
```

## Kubernetes Resource Naming Convention

All resources follow this pattern:

- **Deployments:** `{storename}-{component}` (e.g., `mystore-wordpress`)
- **Services:** `{storename}-{component}` (e.g., `mystore-mysql`)
- **PVCs:** `{storename}-{component}-pvc` (e.g., `mystore-wordpress-pvc`)
- **Ingress:** `{storename}-ingress`

**Labels:**
```yaml
app: {storename}
component: {wordpress|mysql}
managed-by: ecommerce-platform
```

This labeling strategy enables:
- Easy identification of store resources
- Bulk operations using label selectors
- Cleanup on deletion

## Namespace Strategy

The platform uses two namespaces:

1. **ecommerce-platform** - Platform components
   - Dashboard deployment and service
   - Orchestrator deployment and service
   - ServiceAccount and RBAC resources

2. **ecommerce-stores** - All provisioned stores
   - Store deployments, services, ingresses
   - Isolated from platform components
   - Easier to monitor and manage

## Configuration Management

### Helm Values Hierarchy

```
values.yaml (defaults)
   ↓
values-local.yaml (local overrides)
   ↓
values-prod.yaml (production overrides)
```

**Key Configuration Points:**

1. **Global Settings:**
   - Domain (local vs production domain)
   - Storage class (standard, gp2, etc.)

2. **Resource Limits:**
   - Per-environment resource allocations
   - Configurable for cost optimization

3. **Store Defaults:**
   - WordPress and MySQL versions
   - Database credentials
   - Storage sizes
   - Ingress annotations

4. **TLS/HTTPS:**
   - Disabled in local
   - Enabled in production with cert-manager

### Environment Variables

**Dashboard:**
- `REACT_APP_API_URL` - Orchestrator API endpoint
- `PORT` - Server port

**Orchestrator:**
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port
- `STORE_NAMESPACE` - Namespace for stores
- `LOG_LEVEL` - Logging verbosity
- `HELM_VALUES` - Store configuration as YAML
- `GLOBAL_DOMAIN` - Base domain for stores
- `STORAGE_CLASS` - K8s storage class

## Security Considerations

### Current Implementation

1. **RBAC:** Orchestrator has cluster-wide permissions via ServiceAccount
2. **Namespace Isolation:** Stores in separate namespace
3. **Network Policies:** Not implemented (future enhancement)
4. **Secrets:** Database passwords in plain text (ConfigMap)

### Production Hardening (Recommended)

1. **Use Kubernetes Secrets:**
   ```bash
   kubectl create secret generic mysql-credentials \
     --from-literal=root-password=... \
     --from-literal=user-password=...
   ```

2. **Implement Network Policies:**
   - Restrict pod-to-pod communication
   - Only allow MySQL access from same-store WordPress pod

3. **Use External Secrets:**
   - Integration with AWS Secrets Manager
   - Azure Key Vault
   - HashiCorp Vault

4. **Enable Pod Security Standards:**
   ```yaml
   apiVersion: v1
   kind: Namespace
   metadata:
     name: ecommerce-stores
     labels:
       pod-security.kubernetes.io/enforce: baseline
   ```

5. **Resource Quotas per Store:**
   ```yaml
   apiVersion: v1
   kind: ResourceQuota
   metadata:
     name: store-quota
   spec:
     hard:
       requests.cpu: "2"
       requests.memory: 4Gi
       persistentvolumeclaims: "2"
   ```

## Scalability

### Current Limitations

- Single replica for Dashboard and Orchestrator
- No horizontal pod autoscaling
- Single MySQL instance per store (no replication)

### Scaling Strategies

1. **Platform Components:**
   - Increase `replicaCount` in values.yaml
   - Add load balancer for orchestrator
   - Implement caching layer

2. **Store Components:**
   - Use MySQL StatefulSet with replication
   - Implement WordPress caching (Redis/Memcached)
   - Use CDN for static assets

3. **Storage:**
   - Use NFS or cloud storage (EBS, GCE PD)
   - Implement backup/restore mechanisms

## Monitoring and Observability

### Recommended Additions

1. **Prometheus + Grafana:**
   - Monitor cluster and pod metrics
   - Track store provisioning time
   - Alert on failures

2. **Logging:**
   - ELK stack (Elasticsearch, Logstash, Kibana)
   - Loki + Grafana
   - CloudWatch/Stackdriver

3. **Tracing:**
   - Jaeger for distributed tracing
   - Track API request flows

## Future Enhancements

1. **Multiple Store Engines:**
   - Add MedusaJS support
   - Shopify alternative
   - Custom Node.js store

2. **Advanced Features:**
   - Automatic backups
   - Store cloning
   - Custom domains per store
   - SSL certificate automation
   - Resource usage metering/billing

3. **Developer Experience:**
   - CLI tool for store management
   - Terraform provider
   - GitOps integration (ArgoCD)

## Technology Stack Summary

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | React 18 + Material-UI | User interface |
| Backend | Node.js + Express | API server |
| K8s Client | @kubernetes/client-node | K8s API interaction |
| Store Engine | WordPress + WooCommerce | E-commerce functionality |
| Database | MySQL 8.0 | Data persistence |
| Ingress | NGINX | HTTP routing |
| Package Manager | Helm 3 | Application deployment |
| Container Runtime | Docker | Container execution |
| Orchestration | Kubernetes | Container orchestration |

## Testing Strategy

1. **Unit Tests:** Test API endpoints and validators
2. **Integration Tests:** Test K8s resource creation
3. **E2E Tests:** Full store creation → order flow
4. **Load Tests:** Multiple concurrent store creations
5. **Chaos Tests:** Pod failures, node failures

## Conclusion

This architecture provides a solid foundation for a multi-tenant e-commerce platform. It leverages Kubernetes for scalability and portability, uses Helm for configuration management, and follows cloud-native best practices. The modular design allows for easy extension to support additional store engines and features.
