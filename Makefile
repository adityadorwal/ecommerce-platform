.PHONY: help install uninstall status logs clean build-images kind-create kind-delete test

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

kind-create: ## Create Kind cluster
	kind create cluster --name ecommerce-platform --config=- <<EOF
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
	  - containerPort: 443
	    hostPort: 443
	EOF
	@echo "Installing NGINX Ingress..."
	kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
	kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=90s

kind-delete: ## Delete Kind cluster
	kind delete cluster --name ecommerce-platform

install: ## Install platform (local)
	helm install ecommerce-platform ./helm/platform \
		-f ./helm/platform/values-local.yaml \
		--create-namespace \
		--namespace ecommerce-platform
	@echo "Waiting for pods to be ready..."
	kubectl wait --namespace ecommerce-platform --for=condition=ready pod --all --timeout=300s || true
	@echo ""
	@echo "Platform installed! Access the dashboard:"
	@echo "  kubectl port-forward -n ecommerce-platform svc/dashboard 3000:80"
	@echo "  Then open http://localhost:3000"

install-prod: ## Install platform (production)
	helm install ecommerce-platform ./helm/platform \
		-f ./helm/platform/values-prod.yaml \
		--create-namespace \
		--namespace ecommerce-platform

upgrade: ## Upgrade platform (local)
	helm upgrade ecommerce-platform ./helm/platform \
		-f ./helm/platform/values-local.yaml \
		--namespace ecommerce-platform

upgrade-prod: ## Upgrade platform (production)
	helm upgrade ecommerce-platform ./helm/platform \
		-f ./helm/platform/values-prod.yaml \
		--namespace ecommerce-platform

uninstall: ## Uninstall platform
	helm uninstall ecommerce-platform --namespace ecommerce-platform || true
	kubectl delete namespace ecommerce-platform ecommerce-stores || true

status: ## Show platform status
	@echo "=== Platform Pods ==="
	kubectl get pods -n ecommerce-platform
	@echo ""
	@echo "=== Store Pods ==="
	kubectl get pods -n ecommerce-stores
	@echo ""
	@echo "=== Stores (Ingresses) ==="
	kubectl get ingress -n ecommerce-stores

logs-dashboard: ## Show dashboard logs
	kubectl logs -n ecommerce-platform -l app=dashboard --tail=100 -f

logs-orchestrator: ## Show orchestrator logs
	kubectl logs -n ecommerce-platform -l app=orchestrator --tail=100 -f

port-forward: ## Port forward to dashboard
	@echo "Forwarding dashboard to http://localhost:3000"
	kubectl port-forward -n ecommerce-platform svc/dashboard 3000:80

build-dashboard: ## Build dashboard Docker image
	cd dashboard && docker build -t ecommerce-dashboard:latest .

build-orchestrator: ## Build orchestrator Docker image
	cd orchestrator && docker build -t ecommerce-orchestrator:latest .

build-images: build-dashboard build-orchestrator ## Build all Docker images

test: ## Run basic tests
	@echo "Testing API health..."
	@kubectl port-forward -n ecommerce-platform svc/orchestrator 4000:80 > /dev/null 2>&1 & \
	sleep 2 && \
	curl -s http://localhost:4000/health || echo "API not responding" && \
	pkill -f "port-forward.*orchestrator"

clean: uninstall ## Clean everything
	@echo "Cleaning up..."

setup-local: kind-create build-images ## Complete local setup (create cluster + install)
	@echo "Loading images into Kind..."
	kind load docker-image ecommerce-dashboard:latest --name ecommerce-platform
	kind load docker-image ecommerce-orchestrator:latest --name ecommerce-platform
	@$(MAKE) install
	@echo ""
	@echo "✅ Setup complete!"
	@echo ""
	@echo "Next steps:"
	@echo "1. Run: make port-forward"
	@echo "2. Open http://localhost:3000"
	@echo "3. Create a test store"
	@echo "4. Add to /etc/hosts: 127.0.0.1 your-store-name.local"
	@echo "5. Visit http://your-store-name.local"
