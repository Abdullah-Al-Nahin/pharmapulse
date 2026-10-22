import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
});

// Medicines
export const inventoryApi = {
  getMedicines: async (params?: any) => {
    const res = await api.get('/medicines', { params });
    return res.data;
  },
  getMedicineById: async (id: string) => {
    const res = await api.get(`/medicines/${id}`);
    return res.data;
  },
  createMedicine: async (data: any) => {
    const res = await api.post('/medicines', data);
    return res.data;
  },
  updateMedicine: async (id: string, data: any) => {
    const res = await api.put(`/medicines/${id}`, data);
    return res.data;
  },
  getInventorySummary: async () => {
    const res = await api.get('/medicines/summary');
    return res.data;
  },
  getCategories: async () => {
    const res = await api.get('/medicines/categories');
    return res.data;
  },
  getManufacturers: async () => {
    const res = await api.get('/medicines/manufacturers');
    return res.data;
  },
};

// Batches
export const batchApi = {
  getBatches: async (params?: any) => {
    const res = await api.get('/batches', { params });
    return res.data;
  },
  getBatchesForMedicine: async (productId: string) => {
    const res = await api.get(`/batches/medicine/${productId}`);
    return res.data;
  },
  getFefoCandidate: async (productId: string) => {
    const res = await api.get(`/batches/fefo/${productId}`);
    return res.data;
  },
  createBatch: async (data: any) => {
    const res = await api.post('/batches', data);
    return res.data;
  },
  updateBatch: async (id: string, data: any) => {
    const res = await api.put(`/batches/${id}`, data);
    return res.data;
  },
  quarantineBatch: async (id: string, reason: string) => {
    const res = await api.post(`/batches/${id}/quarantine`, { reason });
    return res.data;
  },
  getExpiringBatches: async (days: number = 90) => {
    const res = await api.get('/batches/expiring', { params: { days } });
    return res.data;
  },
};

// Suppliers
export const supplierApi = {
  getSuppliers: async () => {
    const res = await api.get('/suppliers');
    return res.data;
  },
  getSupplierById: async (id: string) => {
    const res = await api.get(`/suppliers/${id}`);
    return res.data;
  },
  createSupplier: async (data: any) => {
    const res = await api.post('/suppliers', data);
    return res.data;
  },
  updateSupplier: async (id: string, data: any) => {
    const res = await api.put(`/suppliers/${id}`, data);
    return res.data;
  },
};

export default api;
