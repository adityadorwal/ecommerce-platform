const k8sService = require('../services/k8sService');
const { validateStoreName } = require('../utils/validators');

// Simple in-memory rate limiting
const rateLimitMap = new Map();
const MAX_STORES_PER_IP = 5;
const MAX_STORES_PER_HOUR = 3;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function getRateLimitKey(req) {
  // Use X-Forwarded-For if behind proxy, otherwise use remoteAddress
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const userLimit = rateLimitMap.get(ip) || { stores: [], totalStores: 0 };
  
  // Clean up old entries (outside 1-hour window)
  userLimit.stores = userLimit.stores.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
  
  // Check hourly limit
  if (userLimit.stores.length >= MAX_STORES_PER_HOUR) {
    return {
      allowed: false,
      error: `Rate limit exceeded: Maximum ${MAX_STORES_PER_HOUR} stores per hour`,
      retryAfter: Math.ceil((RATE_LIMIT_WINDOW - (now - userLimit.stores[0])) / 1000)
    };
  }
  
  // Check total stores limit
  if (userLimit.totalStores >= MAX_STORES_PER_IP) {
    return {
      allowed: false,
      error: `Quota exceeded: Maximum ${MAX_STORES_PER_IP} stores per user`,
      total: userLimit.totalStores
    };
  }
  
  return { allowed: true };
}

function recordStoreCreation(ip) {
  const now = Date.now();
  const userLimit = rateLimitMap.get(ip) || { stores: [], totalStores: 0 };
  
  userLimit.stores.push(now);
  userLimit.totalStores += 1;
  
  rateLimitMap.set(ip, userLimit);
}

function recordStoreDeletion(ip) {
  const userLimit = rateLimitMap.get(ip);
  if (userLimit && userLimit.totalStores > 0) {
    userLimit.totalStores -= 1;
    rateLimitMap.set(ip, userLimit);
  }
}

class StoreController {
  async listStores(req, res, next) {
    try {
      const stores = await k8sService.listStores();
      res.json(stores);
    } catch (error) {
      next(error);
    }
  }

  async getStore(req, res, next) {
    try {
      const { storeId } = req.params;
      const store = await k8sService.getStore(storeId);
      
      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }
      
      res.json(store);
    } catch (error) {
      next(error);
    }
  }

  async createStore(req, res, next) {
    try {
      const { name, type = 'woocommerce' } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Store name is required' });
      }

      // Rate limiting check
      const clientIp = getRateLimitKey(req);
      const rateCheck = checkRateLimit(clientIp);
      
      if (!rateCheck.allowed) {
        const response = { 
          error: rateCheck.error,
          message: 'Too many stores created. Please try again later or contact support.'
        };
        if (rateCheck.retryAfter) {
          response.retryAfter = rateCheck.retryAfter;
          res.setHeader('Retry-After', rateCheck.retryAfter);
        }
        return res.status(429).json(response);
      }

      // Check if MedusaJS (not yet implemented)
      if (type === 'medusa') {
        return res.status(501).json({ 
          error: 'MedusaJS support is coming soon!',
          message: 'Currently only WooCommerce stores are supported. MedusaJS implementation will follow the same architecture pattern.',
          supportedTypes: ['woocommerce']
        });
      }

      if (type !== 'woocommerce') {
        return res.status(400).json({ 
          error: 'Invalid store type',
          supportedTypes: ['woocommerce', 'medusa (coming soon)']
        });
      }

      const validation = validateStoreName(name);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // Check if store already exists
      const existing = await k8sService.getStore(name);
      if (existing) {
        return res.status(409).json({ error: 'Store already exists' });
      }

      console.log(`Creating ${type} store: ${name} for IP: ${clientIp}`);
      const store = await k8sService.createStore(name, type);
      
      // Record successful creation for rate limiting
      recordStoreCreation(clientIp);
      
      res.status(201).json({
        id: name,
        name: name,
        type: type,
        status: 'Provisioning',
        url: store.url,
        adminUrl: store.adminUrl,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error creating store:', error);
      next(error);
    }
  }

  async deleteStore(req, res, next) {
    try {
      const { storeId } = req.params;

      // Check if store exists
      const existing = await k8sService.getStore(storeId);
      if (!existing) {
        return res.status(404).json({ error: 'Store not found' });
      }

      const clientIp = getRateLimitKey(req);
      console.log(`Deleting store: ${storeId} by IP: ${clientIp}`);
      await k8sService.deleteStore(storeId);
      
      // Update rate limit counter (reduce total stores count)
      recordStoreDeletion(clientIp);
      
      res.json({ success: true, message: 'Store deleted successfully' });
    } catch (error) {
      console.error('Error deleting store:', error);
      next(error);
    }
  }
}

module.exports = new StoreController();
