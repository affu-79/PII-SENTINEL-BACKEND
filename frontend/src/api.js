/**
 * API client for PII Sentinel backend.
 */
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const API_KEY = process.env.REACT_APP_API_KEY;

if (!API_KEY) {
  console.error('REACT_APP_API_KEY is not set in environment variables!');
  throw new Error('API key is required. Please set REACT_APP_API_KEY in your .env file.');
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,  // 2 minute timeout for large batch operations
  headers: {
    'X-API-KEY': API_KEY,
    'Content-Type': 'application/json'
  }
});

// Log API configuration (without exposing key)
if (process.env.NODE_ENV === 'development') {
  console.log('API Base URL:', API_BASE_URL);
  console.log('API Key configured:', API_KEY ? '✓ Set' : '✗ Not Set');
}

export const createBatch = async (name, username = null, userId = null) => {
  const payload = { name };
  if (username) {
    payload.username = username;
  }
  if (userId) {
    payload.user_id = userId;
  }
  const response = await api.post('/api/create-batch', payload);
  return response.data;
};

export const uploadFiles = async (batchId, files) => {
  console.log('🚀 uploadFiles called with:', { batchId, fileCount: files.length });

  // Get user_id from localStorage
  let userId = 'default';
  const userInfo = localStorage.getItem('userInfo');
  if (userInfo) {
    try {
      const userData = JSON.parse(userInfo);
      userId = userData.email || userData.username || userData.mobile || 'default';
      console.log('✓ User found:', userId);
    } catch (e) {
      console.error('Error parsing user info:', e);
    }
  }

  if (userId === 'default') {
    console.warn('⚠️  User not authenticated, using default');
  }

  // Create FormData and append files
  const formData = new FormData();
  console.log('📝 Creating FormData with', files.length, 'files');
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`  File ${i + 1}:`, {
      name: file.name,
      size: file.size,
      type: file.type
    });
    formData.append('files[]', file);
  }

  const uploadUrl = `${API_BASE_URL}/api/upload?batch_id=${batchId}&user_id=${userId}`;
  console.log('📤 Upload URL:', uploadUrl);
  console.log('📤 FormData size:', formData.toString());

  try {
    console.log('📡 Sending fetch request...');
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': API_KEY
        // CRITICAL: DO NOT set Content-Type - browser MUST set it with boundary
      },
      body: formData
    });

    console.log('📥 Response received');
    console.log('📥 Status:', response.status, response.statusText);
    console.log('📥 Headers:', {
      'content-type': response.headers.get('content-type'),
      'content-length': response.headers.get('content-length')
    });

    const responseText = await response.text();
    console.log('📥 Response body length:', responseText.length);
    console.log('📥 Response body (first 500 chars):', responseText.substring(0, 500));

    if (!response.ok) {
      console.error('❌ Upload failed with status', response.status);
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      } catch (parseErr) {
        throw new Error(`Upload failed with status ${response.status}: ${responseText.substring(0, 200)}`);
      }
    }

    console.log('✅ Upload successful!');
    return JSON.parse(responseText);
  } catch (error) {
    console.error('❌ Upload error:', error);
    throw error;
  }
};

export const getJobResult = async (jobId) => {
  const response = await api.get(`/api/job-result?job_id=${jobId}`);
  return response.data;
};

export const maskFiles = async (jobId, maskType, password = null, batchId = null, selectedPiiTypes = null) => {
  const payload = {
    mask_type: maskType,
    password: password
  };
  if (jobId) {
    payload.job_id = jobId;
  }
  if (batchId) {
    payload.batch_id = batchId;
  }
  if (selectedPiiTypes && selectedPiiTypes.length > 0) {
    payload.selected_pii_types = selectedPiiTypes;
  }
  const response = await api.post('/api/mask', payload);
  return response.data;
};

export const deleteBatch = async (batchId) => {
  const response = await api.delete(`/api/batch/${batchId}`);
  return response.data;
};

export const listBatches = async (userId = 'default', limit = 100) => {
  const response = await api.get(`/api/batches?user_id=${userId}&limit=${limit}`);
  return response.data;
};

export const downloadFile = async (filePath) => {
  // Ensure path is properly encoded
  const encodedPath = encodeURIComponent(filePath);
  const response = await api.get(`/api/download?path=${encodedPath}`, {
    responseType: 'blob',
    headers: {
      'X-API-KEY': API_KEY  // Explicitly include API key
    }
  });
  return response.data;
};

export const decryptUploadedFiles = async (files, password) => {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files[]', file);
  });
  formData.append('password', password);

  // Create a new axios instance without default Content-Type for FormData
  const formDataApi = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'X-API-KEY': API_KEY
      // Don't set Content-Type - axios will auto-detect FormData and set boundary
    }
  });

  const response = await formDataApi.post('/api/decrypt-upload', formData);
  return response.data;
};

export const exportPiiJson = async (batchId, selectedPiiTypes = [], password = null, lockFile = false) => {
  const payload = {
    batch_id: batchId,
    selected_pii_types: selectedPiiTypes,
    password: password,
    lock_file: lockFile
  };
  
  console.log('📤 Export Request:');
  console.log('  Batch ID:', batchId);
  console.log('  Selected Types:', selectedPiiTypes);
  console.log('  Lock File:', lockFile);
  console.log('  Full Payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await api.post('/api/export-pii-json', payload);
    console.log('✅ Export Response:', response.status, response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Export Error:', error.response?.status, error.response?.data || error.message);
    throw error;
  }
};

export const decryptJson = async (file, password) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('password', password);

  const formDataApi = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'X-API-KEY': API_KEY
    }
  });

  const response = await formDataApi.post('/api/decrypt-json', formData);
  return response.data;
};

export const createAccount = async (userData) => {
  const response = await api.post('/api/create-account', userData);
  return response.data;
};

export const login = async (email, password) => {
  const response = await api.post('/api/login', { email, password });
  return response.data;
};

export const signInWithGoogle = async ({ authCode, idToken }) => {
  const payload = {};
  if (authCode) {
    payload.auth_code = authCode;
  }
  if (idToken) {
    payload.id_token = idToken;
  }
  const response = await api.post('/api/auth/google', payload);
  return response.data;
};

export const getFilePiis = async (batchId, filename, page = 1, perPage = 20) => {
  const response = await api.get(`/api/batch/${batchId}/piis-for-file`, {
    params: { filename, page, per_page: perPage }
  });
  return response.data;
};

export const getProfile = async (username = null, email = null) => {
  const params = username ? { username } : { email };
  const response = await api.get('/api/profile', { params });
  return response.data;
};

export const updateProfile = async (userData) => {
  const response = await api.put('/api/profile', userData);
  return response.data;
};

export const activatePlan = async (planName, billingPeriod, email) => {
  const response = await api.post('/api/activate-plan', {
    plan_name: planName,
    billing_period: billingPeriod,
    email: email
  });
  return response.data;
};

export const getSubscription = async (email) => {
  const response = await api.get(`/api/subscription?email=${encodeURIComponent(email)}`);
  return response.data;
};

// OTP Authentication APIs
export const sendOTP = async (mobile, countryCode) => {
  const payload = { mobile, country_code: countryCode };
  const response = await api.post('/api/auth/send-otp', payload);
  return response.data;
};

export const resendOTP = async (mobile, countryCode) => {
  const payload = { mobile, country_code: countryCode };
  const response = await api.post('/api/auth/resend-otp', payload);
  return response.data;
};

export const verifyOTP = async (mobile, countryCode, otp) => {
  try {
    const response = await api.post('/api/auth/verify-otp', { mobile, country_code: countryCode, otp });
    return response.data;
  } catch (error) {
    // If it's a 404 with otp_verified flag, return the error data instead of throwing
    if (error.response?.status === 404 && error.response?.data?.otp_verified) {
      return error.response.data;
    }
    // Otherwise, re-throw the error
    throw error;
  }
};

// Settings APIs
export const updateAccountStatus = async (email, status) => {
  const response = await api.post('/api/settings/update-status', { email, status });
  return response.data;
};

export const updatePlan = async (email, plan, billingPeriod) => {
  const response = await api.post('/api/settings/update-plan', { email, plan, billingPeriod });
  return response.data;
};

export const updateSecurity = async (data) => {
  const response = await api.post('/api/settings/update-security', data);
  return response.data;
};

export const updatePreferences = async (data) => {
  const response = await api.post('/api/settings/update-preferences', data);
  return response.data;
};

export const downloadUserData = async (email) => {
  const response = await api.post('/api/settings/download-data', { email });
  return response.data;
};

export const clearActivityLogs = async (email) => {
  const response = await api.post('/api/settings/clear-activity', { email });
  return response.data;
};

export const logoutUser = async (email) => {
  const response = await api.post('/api/settings/logout', { email });
  return response.data;
};

export const deleteAccount = async (data) => {
  const response = await api.post('/api/settings/delete-account', data);
  return response.data;
};

// Activity Log API
export const getUserActivityLog = async (userId) => {
  try {
    // For now, we'll derive activity from user data and batches
    // In future, this can be a dedicated endpoint
    const batches = await listBatches(userId, 5);
    return {
      lastLogin: null, // Will be set from user data
      lastBatchCreated: batches.batches && batches.batches.length > 0 ? batches.batches[0].created_at : null,
      lastPiiScanCompleted: batches.batches && batches.batches.length > 0 ? batches.batches[0].updated_at : null
    };
  } catch (error) {
    console.error('Error fetching activity log:', error);
    return {
      lastLogin: null,
      lastBatchCreated: null,
      lastPiiScanCompleted: null
    };
  }
};

export const fetchTokenSummary = async (userEmail) => {
  if (!userEmail) {
    throw new Error('User email is required to fetch token summary.');
  }
  const response = await api.get('/api/user/tokens', {
    params: {
      user_id: userEmail
    }
  });
  return response.data;
};

export const purchasePlan = async ({ planId, userEmail, simulate = false, billingPeriod = 'monthly' }) => {
  if (!planId) {
    throw new Error('planId is required');
  }
  if (!userEmail) {
    throw new Error('User email is required');
  }
  const response = await api.post('/api/purchase/plan', {
    plan_id: planId,
    email: userEmail,
    user_id: userEmail,
    simulate,
    billing_period: billingPeriod
  });
  return response.data;
};

export const purchaseAddons = async ({ tokens, userEmail, simulate = false }) => {
  if (!tokens || tokens <= 0) {
    throw new Error('Token quantity must be greater than zero');
  }
  if (!userEmail) {
    throw new Error('User email is required');
  }
  const response = await api.post('/api/purchase/addons', {
    tokens,
    tokens_requested: tokens,
    email: userEmail,
    user_id: userEmail,
    simulate
  });
  return response.data;
};

export const fetchInvoiceMetadata = async ({ txId, userEmail }) => {
  if (!txId) {
    throw new Error('Transaction id is required');
  }
  if (!userEmail) {
    throw new Error('User email is required');
  }
  const response = await api.post(`/api/invoice/${txId}`, {
    email: userEmail,
    user_id: userEmail,
    download: false
  });
  return response.data;
};

export const downloadInvoicePdf = async ({ txId, userEmail }) => {
  if (!txId) {
    throw new Error('Transaction id is required');
  }
  if (!userEmail) {
    throw new Error('User email is required');
  }
  const response = await api.post(
    `/api/invoice/${txId}`,
    {
      email: userEmail,
      user_id: userEmail,
      download: true
    },
    {
      responseType: 'blob',
      headers: {
        Accept: 'application/pdf'
      }
    }
  );
  return response.data;
};

export const consumeTokenAction = async ({ action, userEmail, metadata = {} }) => {
  if (!action) {
    throw new Error('action is required');
  }
  if (!userEmail) {
    throw new Error('User email is required');
  }
  const response = await api.post('/api/action/consume-token', {
    action,
    email: userEmail,
    user_id: userEmail,
    metadata
  });
  return response.data;
};

export default api;

