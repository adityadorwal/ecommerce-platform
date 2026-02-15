const express = require('express');
const cors = require('cors');
const storeController = require('./controllers/storeController');
const k8sService = require('./services/k8sService');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API Routes
app.get('/api/stores', storeController.listStores);
app.post('/api/stores', storeController.createStore);
app.delete('/api/stores/:storeId', storeController.deleteStore);
app.get('/api/stores/:storeId', storeController.getStore);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Initialize Kubernetes client and start server
async function start() {
  try {
    await k8sService.initialize();
    console.log('Kubernetes client initialized');
    
    app.listen(PORT, () => {
      console.log(`Orchestrator running on port ${PORT}`);
      console.log(`Store namespace: ${process.env.STORE_NAMESPACE || 'ecommerce-stores'}`);
    });
  } catch (error) {
    console.error('Failed to start orchestrator:', error);
    process.exit(1);
  }
}

start();
