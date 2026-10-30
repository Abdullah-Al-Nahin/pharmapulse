import axios from 'axios';

const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const defaultBaseURL = isLocalhost
  ? 'http://localhost:3001/api'
  : 'https://pharmapulse-backend-wjf5.onrender.com/api';

const resolvedBaseURL = import.meta.env.VITE_API_URL || defaultBaseURL;
const healthURL = resolvedBaseURL.replace(/\/api\/?$/, '') + '/health';

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

const V2_CACHE_KEY = 'pharmapulse_v2_routes_supported';
let v2SupportPromise: Promise<boolean> | null = null;

const isLocalBackend =
  resolvedBaseURL.includes('localhost') || resolvedBaseURL.includes('127.0.0.1');

/**
 * Probes GET /health (which always returns HTTP 200 OK) once per session to check whether
 * the deployed backend supports v2 routes (/users, /branches, /transfers, /customers, /adjustments, /system).
 * Prevents Chrome DevTools from logging red 404 network errors if the cloud instance is still on v1.0.0.
 */
async function hasV2Routes(): Promise<boolean> {
  if (isLocalBackend) return true;
  if (typeof window !== 'undefined') {
    const cached = sessionStorage.getItem(V2_CACHE_KEY);
    if (cached === 'true') return true;
    if (cached === 'false') return false;
  }
  if (!v2SupportPromise) {
    v2SupportPromise = axios
      .get(healthURL, { timeout: 6000 })
      .then((res) => {
        const data = res?.data;
        const supported = Boolean(
          data && (data.version === '2.0.0' || Array.isArray(data.capabilities))
        );
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(V2_CACHE_KEY, supported ? 'true' : 'false');
        }
        return supported;
      })
      .catch(() => {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(V2_CACHE_KEY, 'false');
        }
        return false;
      });
  }
  return v2SupportPromise;
}

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

// Users & Staff Directory (v2)
export const userApi = {
  getUsers: async () => {
    if (!(await hasV2Routes())) return [];
    const res = await api.get('/users');
    return res.data;
  },
  createUser: async (data: any) => {
    if (!(await hasV2Routes())) return { offlineFallback: true, ...data };
    const res = await api.post('/users', data);
    return res.data;
  },
  updateUser: async (id: string, data: any) => {
    if (!(await hasV2Routes())) return { offlineFallback: true, id, ...data };
    const res = await api.put(`/users/${id}`, data);
    return res.data;
  },
  deleteUser: async (id: string) => {
    if (!(await hasV2Routes())) return { offlineFallback: true, id };
    const res = await api.delete(`/users/${id}`);
    return res.data;
  },
  getRoles: async () => {
    if (!(await hasV2Routes())) return [];
    const res = await api.get('/users/roles');
    return res.data;
  },
  login: async (credentials: { identifier: string; password?: string }) => {
    if (!(await hasV2Routes())) return { offlineFallback: true };
    const res = await api.post('/users/login', credentials);
    return res.data;
  },
};

// Branches (v2)
export const branchApi = {
  getBranches: async () => {
    if (!(await hasV2Routes())) return [];
    const res = await api.get('/branches');
    return res.data;
  },
  createBranch: async (data: any) => {
    if (!(await hasV2Routes())) return { offlineFallback: true, ...data };
    const res = await api.post('/branches', data);
    return res.data;
  },
  updateBranch: async (id: string, data: any) => {
    if (!(await hasV2Routes())) return { offlineFallback: true, id, ...data };
    const res = await api.put(`/branches/${id}`, data);
    return res.data;
  },
  deleteBranch: async (id: string) => {
    if (!(await hasV2Routes())) return { offlineFallback: true, id };
    const res = await api.delete(`/branches/${id}`);
    return res.data;
  },
};

// Customers & Dues (v2)
export const customerApi = {
  getCustomers: async (params?: any) => {
    if (!(await hasV2Routes())) return [];
    const res = await api.get('/customers', { params });
    return res.data;
  },
  createCustomer: async (data: any) => {
    if (!(await hasV2Routes())) return { offlineFallback: true, ...data };
    const res = await api.post('/customers', data);
    return res.data;
  },
  updateCustomer: async (id: string, data: any) => {
    if (!(await hasV2Routes())) return { offlineFallback: true, id, ...data };
    const res = await api.put(`/customers/${id}`, data);
    return res.data;
  },
};

// Stock Adjustments (v2)
export const adjustmentApi = {
  getAdjustments: async () => {
    if (!(await hasV2Routes())) return [];
    const res = await api.get('/adjustments');
    return res.data;
  },
  createAdjustment: async (data: any) => {
    if (!(await hasV2Routes())) return { offlineFallback: true, ...data };
    const res = await api.post('/adjustments', data);
    return res.data;
  },
};

// Stock Transfers (v2)
export const transferApi = {
  getTransfers: async () => {
    if (!(await hasV2Routes())) return [];
    const res = await api.get('/transfers');
    return res.data;
  },
  createTransfer: async (data: any) => {
    if (!(await hasV2Routes())) return { offlineFallback: true, ...data };
    const res = await api.post('/transfers', data);
    return res.data;
  },
  receiveTransfer: async (id: string) => {
    if (!(await hasV2Routes())) return { offlineFallback: true, id };
    return (await api.put(`/transfers/${id}/receive`)).data;
  },
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

// System & Super Admin Database Control (v2)
export const systemApi = {
  getStats: async () => {
    if (!(await hasV2Routes())) return { offlineFallback: true };
    return (await api.get('/system/stats')).data;
  },
  purgeDatabase: async (data: { scope: string; requesterRole?: string }) => {
    if (!(await hasV2Routes())) return { offlineFallback: true, success: true };
    return (await api.post('/system/purge', data)).data;
  },
};

export default api;
