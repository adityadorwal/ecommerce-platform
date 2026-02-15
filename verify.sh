#!/bin/bash

echo "================================================"
echo "Platform Verification Script"
echo "================================================"
echo ""

# Check if cluster exists
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Kubernetes cluster not accessible"
    echo "Please create a cluster first with: kind create cluster --name ecommerce-platform"
    exit 1
fi

echo "✅ Kubernetes cluster accessible"
echo ""

# Check if platform namespace exists
if kubectl get namespace ecommerce-platform &> /dev/null; then
    echo "✅ Platform namespace exists"
else
    echo "❌ Platform namespace not found"
    echo "Please install the platform first"
    exit 1
fi

echo ""
echo "Checking platform components..."
echo ""

# Check dashboard
DASHBOARD_READY=$(kubectl get pods -n ecommerce-platform -l app=dashboard -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}' 2>/dev/null)
if [ "$DASHBOARD_READY" == "True" ]; then
    echo "✅ Dashboard is running"
else
    echo "⚠️  Dashboard is not ready yet"
fi

# Check orchestrator
ORCH_READY=$(kubectl get pods -n ecommerce-platform -l app=orchestrator -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}' 2>/dev/null)
if [ "$ORCH_READY" == "True" ]; then
    echo "✅ Orchestrator is running"
else
    echo "⚠️  Orchestrator is not ready yet"
fi

echo ""
echo "Checking services..."
echo ""

# Check dashboard service
if kubectl get svc dashboard -n ecommerce-platform &> /dev/null; then
    echo "✅ Dashboard service exists"
else
    echo "❌ Dashboard service not found"
fi

# Check orchestrator service
if kubectl get svc orchestrator -n ecommerce-platform &> /dev/null; then
    echo "✅ Orchestrator service exists"
else
    echo "❌ Orchestrator service not found"
fi

echo ""
echo "Checking ingress..."
echo ""

# Check ingress
if kubectl get ingress -n ecommerce-platform &> /dev/null; then
    echo "✅ Ingress exists"
    kubectl get ingress -n ecommerce-platform
else
    echo "❌ Ingress not found"
fi

echo ""
echo "Checking store namespace..."
echo ""

if kubectl get namespace ecommerce-stores &> /dev/null; then
    echo "✅ Store namespace exists"
    
    STORE_COUNT=$(kubectl get deployments -n ecommerce-stores --no-headers 2>/dev/null | wc -l)
    echo "   Stores deployed: $((STORE_COUNT / 2))"  # Divide by 2 (wordpress + mysql)
else
    echo "❌ Store namespace not found"
fi

echo ""
echo "================================================"
echo "Health Check"
echo "================================================"
echo ""

# Try to check orchestrator health
echo "Testing orchestrator API..."
kubectl port-forward -n ecommerce-platform svc/orchestrator 14000:80 > /dev/null 2>&1 &
PORT_FORWARD_PID=$!
sleep 3

HEALTH=$(curl -s http://localhost:14000/health 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Orchestrator API is healthy"
    echo "   Response: $HEALTH"
else
    echo "⚠️  Could not reach orchestrator API"
fi

kill $PORT_FORWARD_PID 2>/dev/null

echo ""
echo "================================================"
echo "Summary"
echo "================================================"
echo ""
echo "To access the dashboard:"
echo "  kubectl port-forward -n ecommerce-platform svc/dashboard 3000:80"
echo "  Then open http://localhost:3000"
echo ""
echo "To view logs:"
echo "  kubectl logs -n ecommerce-platform -l app=dashboard"
echo "  kubectl logs -n ecommerce-platform -l app=orchestrator"
echo ""
echo "To list stores:"
echo "  kubectl get all -n ecommerce-stores"
echo ""
