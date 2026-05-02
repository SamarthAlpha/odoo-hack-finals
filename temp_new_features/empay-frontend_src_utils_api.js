


const API_BASE = '/api';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('empay_token') || ''}`,
});

const request = async (method, endpoint, data = null, headers = {}) => {
  const isForm = data instanceof FormData;
  const opts = { 
    method, 
    headers: {
      ...getHeaders(),
      ...headers 
    }
  };
  
  // If it's FormData, let the browser set the Content-Type (with boundary)
  if (isForm) {
    Object.keys(opts.headers).forEach(k => {
      if (k.toLowerCase() === 'content-type') delete opts.headers[k];
    });
  } else if (data) {
    const hasContentType = Object.keys(opts.headers).some(k => k.toLowerCase() === 'content-type');
    if (!hasContentType) opts.headers['Content-Type'] = 'application/json';
  }

  if (data) opts.body = isForm ? data : JSON.stringify(data);
  const res = await fetch(`${API_BASE}${endpoint}`, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Request failed');
  // Auto-unwrap {success, data} envelope — return .data if exists, else raw json
  return json && json.data !== undefined ? json.data : json;
};

export const api = {
  get: (ep, h) => request('GET', ep, null, h),
  post: (ep, d, h) => request('POST', ep, d, h),
  put: (ep, d, h) => request('PUT', ep, d, h),
  delete: (ep, h) => request('DELETE', ep, null, h),
};

export default api;


