import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getStores = async () => {
  try {
    const response = await api.get('/stores');
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch stores');
  }
};

export const createStore = async (storeName, storeType = 'woocommerce') => {
  try {
    const response = await api.post('/stores', { name: storeName, type: storeType });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to create store');
  }
};

export const deleteStore = async (storeId) => {
  try {
    const response = await api.delete(`/stores/${storeId}`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to delete store');
  }
};

export default api;
