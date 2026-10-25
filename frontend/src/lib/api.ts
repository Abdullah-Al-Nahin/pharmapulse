import axios from 'axios';

const defaultBaseURL = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3001/api'
  : 'https://pharmapulse-backend-wjf5.onrender.com/api';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || defaultBaseURL,
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

// Users & Staff Directory
export const userApi = {
  getUsers: async () => {
    const res = await api.get('/users');
    return res.data;
  },
  createUser: async (data: any) => {
    const res = await api.post('/users', data);
    return res.data;
  },
  updateUser: async (id: string, data: any) => {
    const res = await api.put(`/users/${id}`, data);
    return res.data;
  },
  deleteUser: async (id: string) => {
    const res = await api.delete(`/users/${id}`);
    return res.data;
  },
  getRoles: async () => {
    const res = await api.get('/users/roles');
    return res.data;
  },
};

// Branches
export const branchApi = {
  getBranches: async () => {
    const res = await api.get('/branches');
    return res.data;
  },
  createBranch: async (data: any) => {
    const res = await api.post('/branches', data);
    return res.data;
  },
  updateBranch: async (id: string, data: any) => {
    const res = await api.put(`/branches/${id}`, data);
    return res.data;
  },
  deleteBranch: async (id: string) => {
    const res = await api.delete(`/branches/${id}`);
    return res.data;
  },
};

// Customers & Dues
export const customerApi = {
  getCustomers: async (params?: any) => {
    const res = await api.get('/customers', { params });
    return res.data;
  },
  createCustomer: async (data: any) => {
    const res = await api.post('/customers', data);
    return res.data;
  },
  updateCustomer: async (id: string, data: any) => {
    const res = await api.put(`/customers/${id}`, data);
    return res.data;
  },
};

// Stock Adjustments
export const adjustmentApi = {
  getAdjustments: async () => {
    const res = await api.get('/adjustments');
    return res.data;
  },
  createAdjustment: async (data: any) => {
    const res = await api.post('/adjustments', data);
    return res.data;
  },
};

// Stock Transfers
export const transferApi = {
  getTransfers: async () => {
    const res = await api.get('/transfers');
    return res.data;
  },
  createTransfer: async (data: any) => {
    const res = await api.post('/transfers', data);
    return res.data;
  },
};

export default api;

