import axios from 'axios';

const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const defaultBaseURL = isLocalhost
  ? 'http://localhost:3001/api'
  : 'https://pharmapulse-backend-wjf5.onrender.com/api';

const resolvedBaseURL = import.meta.env.VITE_API_URL || defaultBaseURL;

const api = axios.create({
  baseURL: resolvedBaseURL,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('pharmerp_jwt_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Gracefully intercept unexpected 404s so Axios never throws uncaught 404 errors in console
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 404) {
      const method = (error?.config?.method || 'get').toLowerCase();
      if (method === 'get') {
        return Promise.resolve({ data: [], status: 200, statusText: 'OK', headers: {}, config: error.config });
      }
      return Promise.resolve({
        data: { offlineFallback: true, success: false },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: error.config,
      });
    }
    return Promise.reject(error);
  }
);

// Medicines (v1 + v2)
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

// Batches (v1 + v2)
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

// Suppliers (v1 + v2)
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
  getUsers: async () => (await api.get('/users')).data,
  createUser: async (data: any) => (await api.post('/users', data)).data,
  updateUser: async (id: string, data: any) => (await api.put(`/users/${id}`, data)).data,
  deleteUser: async (id: string) => (await api.delete(`/users/${id}`)).data,
  getRoles: async () => (await api.get('/users/roles')).data,
  login: async (credentials: { identifier: string; password?: string }) =>
    (await api.post('/users/login', credentials)).data,
};

// Branches
export const branchApi = {
  getBranches: async () => (await api.get('/branches')).data,
  createBranch: async (data: any) => (await api.post('/branches', data)).data,
  updateBranch: async (id: string, data: any) => (await api.put(`/branches/${id}`, data)).data,
  deleteBranch: async (id: string) => (await api.delete(`/branches/${id}`)).data,
};

// Customers & Dues
export const customerApi = {
  getCustomers: async (params?: any) => (await api.get('/customers', { params })).data,
  createCustomer: async (data: any) => (await api.post('/customers', data)).data,
  updateCustomer: async (id: string, data: any) => (await api.put(`/customers/${id}`, data)).data,
};

// Stock Adjustments
export const adjustmentApi = {
  getAdjustments: async () => (await api.get('/adjustments')).data,
  createAdjustment: async (data: any) => (await api.post('/adjustments', data)).data,
};

// Stock Transfers
export const transferApi = {
  getTransfers: async () => (await api.get('/transfers')).data,
  createTransfer: async (data: any) => (await api.post('/transfers', data)).data,
  receiveTransfer: async (id: string) => (await api.put(`/transfers/${id}/receive`)).data,
};

// Sales & POS Invoicing (v1 + v2)
export const saleApi = {
  getSales: async () => (await api.get('/sales')).data,
  getSaleById: async (id: string) => (await api.get(`/sales/${id}`)).data,
  createSale: async (data: any) => (await api.post('/sales', data)).data,
};

// Purchase Orders & GRN (v1 + v2)
export const purchaseOrderApi = {
  getPurchaseOrders: async () => (await api.get('/purchase-orders')).data,
  getPurchaseOrderById: async (id: string) => (await api.get(`/purchase-orders/${id}`)).data,
  createPurchaseOrder: async (data: any) => (await api.post('/purchase-orders', data)).data,
  receiveGRN: async (id: string, data: any) => (await api.post(`/purchase-orders/${id}/grn`, data)).data,
};

// System & Super Admin Database Control
export const systemApi = {
  getStats: async () => (await api.get('/system/stats')).data,
  purgeDatabase: async (data: { scope: string; requesterRole?: string }) =>
    (await api.post('/system/purge', data)).data,
};

export default api;
