const k8s = require('@kubernetes/client-node');
const yaml = require('js-yaml');

class K8sService {
  constructor() {
    this.kc = new k8s.KubeConfig();
    this.namespace = process.env.STORE_NAMESPACE || 'ecommerce-stores';
    this.globalDomain = process.env.GLOBAL_DOMAIN || 'local';
    this.storageClass = process.env.STORAGE_CLASS || 'standard';
  }

  async initialize() {
    // Load Kubernetes config (in-cluster when running in K8s)
    try {
      this.kc.loadFromCluster();
      console.log('Loaded in-cluster Kubernetes config');
    } catch (e) {
      // Fallback to default config for local development
      this.kc.loadFromDefault();
      console.log('Loaded default Kubernetes config');
    }

    this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api);
    this.networkingApi = this.kc.makeApiClient(k8s.NetworkingV1Api);

    // Parse Helm values from environment
    try {
      const helmValuesStr = process.env.HELM_VALUES || '{}';
      this.helmValues = yaml.load(helmValuesStr);
    } catch (e) {
      console.warn('Failed to parse HELM_VALUES, using defaults:', e.message);
      this.helmValues = {};
    }
  }

  getStoreConfig(storeName) {
    return {
      wordpress: this.helmValues.wordpress || {
        image: { repository: 'wordpress', tag: '6.4-apache' },
        resources: {
          requests: { memory: '256Mi', cpu: '100m' },
          limits: { memory: '512Mi', cpu: '500m' }
        },
        storage: { size: '5Gi' }
      },
      mysql: this.helmValues.mysql || {
        image: { repository: 'mysql', tag: '8.0' },
        rootPassword: 'changeme_root_password',
        database: 'wordpress',
        user: 'wordpress',
        password: 'changeme_wp_password',
        resources: {
          requests: { memory: '512Mi', cpu: '100m' },
          limits: { memory: '1Gi', cpu: '500m' }
        },
        storage: { size: '10Gi' }
      },
      ingress: this.helmValues.ingress || {
        className: 'nginx',
        annotations: { 'nginx.ingress.kubernetes.io/proxy-body-size': '64m' },
        tls: { enabled: false }
      }
    };
  }

  async createMySQLDeployment(storeName, config) {
    const deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: `${storeName}-mysql`,
        namespace: this.namespace,
        labels: {
          app: storeName,
          component: 'mysql',
          'managed-by': 'ecommerce-platform'
        }
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: storeName,
            component: 'mysql'
          }
        },
        template: {
          metadata: {
            labels: {
              app: storeName,
              component: 'mysql'
            }
          },
          spec: {
            containers: [{
              name: 'mysql',
              image: `${config.mysql.image.repository}:${config.mysql.image.tag}`,
              env: [
                { name: 'MYSQL_ROOT_PASSWORD', value: config.mysql.rootPassword },
                { name: 'MYSQL_DATABASE', value: config.mysql.database },
                { name: 'MYSQL_USER', value: config.mysql.user },
                { name: 'MYSQL_PASSWORD', value: config.mysql.password }
              ],
              ports: [{ containerPort: 3306, name: 'mysql' }],
              volumeMounts: [{
                name: 'mysql-data',
                mountPath: '/var/lib/mysql'
              }],
              resources: config.mysql.resources,
              livenessProbe: {
                exec: {
                  command: ['sh', '-c', 'mysqladmin ping -h localhost']
                },
                initialDelaySeconds: 120,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 5
              },
              readinessProbe: {
                exec: {
                  command: ['sh', '-c', 'mysqladmin ping -h localhost']
                },
                initialDelaySeconds: 90,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 5
              }
            }],
            volumes: [{
              name: 'mysql-data',
              persistentVolumeClaim: {
                claimName: `${storeName}-mysql-pvc`
              }
            }]
          }
        }
      }
    };

    return await this.appsApi.createNamespacedDeployment(this.namespace, deployment);
  }

  async createWordPressDeployment(storeName, config) {
    const deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: `${storeName}-wordpress`,
        namespace: this.namespace,
        labels: {
          app: storeName,
          component: 'wordpress',
          'managed-by': 'ecommerce-platform'
        }
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: storeName,
            component: 'wordpress'
          }
        },
        template: {
          metadata: {
            labels: {
              app: storeName,
              component: 'wordpress'
            }
          },
          spec: {
            containers: [{
              name: 'wordpress',
              image: `${config.wordpress.image.repository}:${config.wordpress.image.tag}`,
              env: [
                { name: 'WORDPRESS_DB_HOST', value: `${storeName}-mysql` },
                { name: 'WORDPRESS_DB_USER', value: config.mysql.user },
                { name: 'WORDPRESS_DB_PASSWORD', value: config.mysql.password },
                { name: 'WORDPRESS_DB_NAME', value: config.mysql.database }
              ],
              ports: [{ containerPort: 80, name: 'http' }],
              volumeMounts: [{
                name: 'wordpress-data',
                mountPath: '/var/www/html'
              }],
              resources: config.wordpress.resources,
              livenessProbe: {
                httpGet: {
                  path: '/',
                  port: 80
                },
                initialDelaySeconds: 120,
                periodSeconds: 10,
                timeoutSeconds: 5,
                failureThreshold: 5
              },
              readinessProbe: {
                httpGet: {
                  path: '/',
                  port: 80
                },
                initialDelaySeconds: 90,
                periodSeconds: 10,
                timeoutSeconds: 5,
                successThreshold: 1,
                failureThreshold: 5
              }
            }],
            volumes: [{
              name: 'wordpress-data',
              persistentVolumeClaim: {
                claimName: `${storeName}-wordpress-pvc`
              }
            }]
          }
        }
      }
    };

    return await this.appsApi.createNamespacedDeployment(this.namespace, deployment);
  }

  async createService(storeName, component, port) {
    const service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: `${storeName}-${component}`,
        namespace: this.namespace,
        labels: {
          app: storeName,
          component: component,
          'managed-by': 'ecommerce-platform'
        }
      },
      spec: {
        type: 'ClusterIP',
        ports: [{
          port: port,
          targetPort: port,
          protocol: 'TCP'
        }],
        selector: {
          app: storeName,
          component: component
        }
      }
    };

    return await this.k8sApi.createNamespacedService(this.namespace, service);
  }

  async createPVC(storeName, component, size) {
    const pvc = {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: {
        name: `${storeName}-${component}-pvc`,
        namespace: this.namespace,
        labels: {
          app: storeName,
          component: component,
          'managed-by': 'ecommerce-platform'
        }
      },
      spec: {
        accessModes: ['ReadWriteOnce'],
        storageClassName: this.storageClass,
        resources: {
          requests: {
            storage: size
          }
        }
      }
    };

    return await this.k8sApi.createNamespacedPersistentVolumeClaim(this.namespace, pvc);
  }

  async createIngress(storeName, config) {
    const host = `${storeName}.${this.globalDomain}`;
    
    const ingress = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: `${storeName}-ingress`,
        namespace: this.namespace,
        labels: {
          app: storeName,
          'managed-by': 'ecommerce-platform'
        },
        annotations: config.ingress.annotations || {}
      },
      spec: {
        ingressClassName: config.ingress.className,
        rules: [{
          host: host,
          http: {
            paths: [{
              path: '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: `${storeName}-wordpress`,
                  port: { number: 80 }
                }
              }
            }]
          }
        }]
      }
    };

    if (config.ingress.tls?.enabled) {
      ingress.spec.tls = [{
        hosts: [host],
        secretName: `${storeName}-tls`
      }];
    }

    return await this.networkingApi.createNamespacedIngress(this.namespace, ingress);
  }

  async createStore(storeName, storeType = 'woocommerce') {
    const config = this.getStoreConfig(storeName);

    try {
      // Create PVCs first
      await this.createPVC(storeName, 'mysql', config.mysql.storage.size);
      await this.createPVC(storeName, 'wordpress', config.wordpress.storage.size);

      // Create Services
      await this.createService(storeName, 'mysql', 3306);
      await this.createService(storeName, 'wordpress', 80);

      // Create Deployments
      await this.createMySQLDeployment(storeName, config);
      
      // Wait a bit for MySQL to initialize
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      await this.createWordPressDeployment(storeName, config);

      // Create Ingress
      await this.createIngress(storeName, config);

      return {
        name: storeName,
        type: storeType,
        url: `http://${storeName}.${this.globalDomain}`,
        adminUrl: `http://${storeName}.${this.globalDomain}/wp-admin`
      };
    } catch (error) {
      // Cleanup on failure
      try {
        await this.deleteStore(storeName);
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError);
      }
      throw error;
    }
  }

  async deleteStore(storeName) {
    const labelSelector = `app=${storeName},managed-by=ecommerce-platform`;

    try {
      // Delete in reverse order
      await this.networkingApi.deleteCollectionNamespacedIngress(
        this.namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        labelSelector
      );

      await this.appsApi.deleteCollectionNamespacedDeployment(
        this.namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        labelSelector
      );

      await this.k8sApi.deleteCollectionNamespacedService(
        this.namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        labelSelector
      );

      await this.k8sApi.deleteCollectionNamespacedPersistentVolumeClaim(
        this.namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        labelSelector
      );

      return { success: true };
    } catch (error) {
      console.error('Error deleting store:', error);
      throw error;
    }
  }

  async listStores() {
    try {
      const labelSelector = 'managed-by=ecommerce-platform,component=wordpress';
      const deployments = await this.appsApi.listNamespacedDeployment(
        this.namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        labelSelector
      );

      const stores = await Promise.all(deployments.body.items.map(async (deployment) => {
        const storeName = deployment.metadata.labels.app;
        const status = this.getDeploymentStatus(deployment);

        return {
          id: storeName,
          name: storeName,
          status: status,
          url: `http://${storeName}.${this.globalDomain}`,
          adminUrl: `http://${storeName}.${this.globalDomain}/wp-admin`,
          createdAt: deployment.metadata.creationTimestamp
        };
      }));

      return stores;
    } catch (error) {
      console.error('Error listing stores:', error);
      return [];
    }
  }

  getDeploymentStatus(deployment) {
    const availableReplicas = deployment.status.availableReplicas || 0;
    const desiredReplicas = deployment.spec.replicas || 0;

    if (availableReplicas === desiredReplicas && desiredReplicas > 0) {
      return 'Ready';
    } else if (deployment.status.conditions) {
      const failedCondition = deployment.status.conditions.find(
        c => c.type === 'Available' && c.status === 'False'
      );
      if (failedCondition) {
        return 'Failed';
      }
    }
    return 'Provisioning';
  }

  async getStore(storeName) {
    try {
      const deployment = await this.appsApi.readNamespacedDeployment(
        `${storeName}-wordpress`,
        this.namespace
      );

      return {
        id: storeName,
        name: storeName,
        status: this.getDeploymentStatus(deployment.body),
        url: `http://${storeName}.${this.globalDomain}`,
        adminUrl: `http://${storeName}.${this.globalDomain}/wp-admin`,
        createdAt: deployment.body.metadata.creationTimestamp
      };
    } catch (error) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }
}

module.exports = new K8sService();
