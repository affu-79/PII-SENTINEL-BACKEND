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

// Setup axios interceptors for network monitoring
api.interceptors.request.use(
  (config) => {
    config.metadata = { startTime: new Date() };
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    // Log slow responses
    const duration = new Date() - response.config.metadata.startTime;
    if (duration > 3000 && process.env.NODE_ENV === 'development') {
      console.warn(`⚠️ Slow API response: ${response.config.url} (${duration}ms)`);
    }
    return response;
  },
  (error) => {
    // Enhance error with network-specific information
    if (!error.response) {
      if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
        error.isNetworkError = true;
        console.error('❌ Network error: Unable to reach server');
      }
      if (error.code === 'ECONNABORTED') {
        error.isTimeout = true;
        console.error('❌ Request timeout');
      }
    }
    return Promise.reject(error);
  }
);

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
    const responseData = JSON.parse(responseText);
    
    // Log pipeline information for each file
    if (responseData.results && Array.isArray(responseData.results)) {
      console.log('\n📊 ═══════════════════════════════════════════════════════');
      console.log('📊 PROCESSING RESULTS:');
      console.log('📊 ═══════════════════════════════════════════════════════');
      
      responseData.results.forEach((result, index) => {
        console.log(`\n🔹 File ${index + 1}: ${result.filename || 'Unknown'}`);
        console.log(`   ├─ Success: ${result.success ? '✅ YES' : '❌ NO'}`);
        console.log(`   ├─ File Type: ${result.file_type || result.detector_used || 'N/A'}`);
        console.log(`   ├─ Pipeline Used: ${result.pipeline_used || 'Not specified'}`);
        console.log(`   ├─ Detector: ${result.detector_used || 'N/A'}`);
        console.log(`   ├─ PIIs Found: ${result.pii_count || result.piis?.length || 0}`);
        console.log(`   ├─ Processing Time: ${result.processing_time || 0}s`);
        console.log(`   └─ Pages: ${result.page_count || 1}`);
        
        // Log deduplication info if available
        if (result.piis && result.piis.length > 0) {
          const deduplicated = result.piis.filter(pii => pii.is_deduplicated);
          if (deduplicated.length > 0) {
            console.log(`   🔄 Deduplication: ${deduplicated.length} PII(s) had duplicates removed`);
          }
          
          // Log unique PII types
          const uniqueTypes = [...new Set(result.piis.map(pii => pii.type))];
          console.log(`   📋 PII Types: ${uniqueTypes.join(', ')}`);
        }
      });
      
      console.log('\n📊 ═══════════════════════════════════════════════════════\n');
    }
    
    return responseData;
  } catch (error) {
    console.error('❌ Upload error:', error);
    throw error;
  }
};

export const getJobResult = async (jobId) => {
  const response = await api.get(`/api/job-result?job_id=${jobId}`);
  const data = response.data;
  
  // Log pipeline information when polling job results
  if (data && data.results && Array.isArray(data.results)) {
    console.log('\n📊 ═══════════════════════════════════════════════════════');
    console.log(`📊 JOB RESULT (${jobId}):`, data.status || 'processing');
    console.log('📊 ═══════════════════════════════════════════════════════');
    
    data.results.forEach((result, index) => {
      if (result.filename) {
        console.log(`\n🔹 File ${index + 1}: ${result.filename}`);
        console.log(`   ├─ Pipeline Used: ${result.pipeline_used || 'Not specified'}`);
        console.log(`   ├─ Detector: ${result.detector_used || 'N/A'}`);
        console.log(`   ├─ Document Type: ${result.document_type || 'GENERIC'}`);
        console.log(`   ├─ PIIs Found: ${result.pii_count || 0}`);
        console.log(`   └─ Processing Time: ${result.processing_time || 0}s`);
        
        // Log PII types found (if available)
        if (result.piis && result.piis.length > 0) {
          const uniqueTypes = [...new Set(result.piis.map(pii => pii.type))];
          console.log(`   📋 PII Types: ${uniqueTypes.join(', ')}`);
          
          // Log occurrence counts for duplicates
          result.piis.forEach(pii => {
            if (pii.occurrence_count && pii.occurrence_count > 1) {
              console.log(`      ↳ ${pii.type}: ${pii.occurrence_count} occurrences (all will be masked)`);
            }
          });
        }
      }
    });
    
    console.log('\n📊 ═══════════════════════════════════════════════════════\n');
  }
  
  return data;
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
  // Add timestamp to bypass cache
  params._t = Date.now();
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
  const payload = response.data || {};

  if (!payload.success || !payload.downloadUrl) {
    return payload;
  }

  try {
    const fileResponse = await api.get(payload.downloadUrl, {
      responseType: 'blob',
      headers: {
        Accept: 'application/pdf'
      }
    });

    const contentDisposition = fileResponse.headers?.['content-disposition'] || '';
    let fileName = payload.fileName || 'PII-Sentinel-DataExport.pdf';
    const match = contentDisposition.match(/filename="?([^"]+)"?/i);
    if (match && match[1]) {
      fileName = match[1];
    }

    return {
      success: true,
      blob: fileResponse.data,
      fileName,
      message: payload.message || 'Data export prepared successfully'
    };
  } catch (downloadError) {
    return {
      success: false,
      error: downloadError.response?.data?.error || 'Failed to download data export'
    };
  }
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

export const fetchUserActivity = async (userEmail) => {
  if (!userEmail) {
    throw new Error('User email is required to fetch activity.');
  }
  const response = await api.get('/api/user/activity', {
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

// ============================================================================
// RAZORPAY PAYMENT APIs
// ============================================================================

/**
 * Create a Razorpay order for plan upgrade
 * @param {string} planId - Plan ID ('professional' or 'enterprise')
 * @param {string} userEmail - User email
 * @param {string} userId - User ID
 * @returns {Promise} Order details (order_id, amount, currency, key)
 */
export const createPaymentOrder = async ({ planId, userEmail, userId, billingPeriod = 'monthly' }) => {
  if (!planId) {
    throw new Error('Plan ID is required');
  }
  if (!userEmail) {
    throw new Error('User email is required');
  }
  
  const response = await api.post('/api/payment/create-order', {
    plan_id: planId,
    email: userEmail,
    user_id: userId || userEmail,
    billing_period: billingPeriod,  // 'monthly' or 'yearly'
    notes: {
      user_email: userEmail,
      plan: planId,
      billing_period: billingPeriod,
      timestamp: new Date().toISOString()
    }
  });
  
  return response.data;
};

/**
 * Create a Razorpay order for token addon purchase
 * @param {number} tokenAmount - Number of tokens to purchase
 * @param {string} userEmail - User email
 * @param {string} userId - User ID
 * @returns {Promise} Order details (order_id, amount, currency, key)
 */
export const createTokenAddonOrder = async ({ tokenAmount, userEmail, userId }) => {
  if (!tokenAmount || tokenAmount <= 0) {
    throw new Error('Valid token amount is required');
  }
  if (!userEmail) {
    throw new Error('User email is required');
  }
  
  const response = await api.post('/api/payment/create-token-order', {
    token_amount: tokenAmount,
    email: userEmail,
    user_id: userId || userEmail,
    notes: {
      user_email: userEmail,
      token_addon: tokenAmount,
      timestamp: new Date().toISOString()
    }
  });
  
  return response.data;
};

/**
 * Verify payment after successful transaction
 * @param {string} razorpayOrderId - Order ID from Razorpay
 * @param {string} razorpayPaymentId - Payment ID from Razorpay
 * @param {string} razorpaySignature - Signature from Razorpay
 * @param {string} userEmail - User email
 * @param {string} planId - Plan ID (for plan upgrades) or null (for token addons)
 * @param {number} tokenAmount - Token amount (for token addons) or null (for plan upgrades)
 * @returns {Promise} Verification result
 */
export const verifyPayment = async ({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  userEmail,
  planId = null,
  tokenAmount = null
}) => {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new Error('Payment details are incomplete');
  }
  if (!userEmail) {
    throw new Error('User email is required');
  }
  
  const response = await api.post('/api/payment/verify', {
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature,
    email: userEmail,
    user_id: userEmail,  // Add user_id for authentication
    plan_id: planId,
    token_amount: tokenAmount
  });
  
  return response.data;
};

/**
 * Get payment history for user
 * @param {string} userEmail - User email
 * @returns {Promise} Payment history
 */
export const getPaymentHistory = async (userEmail) => {
  if (!userEmail) {
    throw new Error('User email is required');
  }
  
  const response = await api.get(`/api/payment/history?email=${userEmail}&user_id=${userEmail}`);
  return response.data;
};

/**
 * Download invoice for a payment
 * @param {string} paymentId - Payment ID
 * @param {string} userEmail - User email
 * @returns {Promise} Invoice blob
 */
export const downloadInvoice = async (paymentId, userEmail) => {
  if (!paymentId || !userEmail) {
    throw new Error('Payment ID and user email are required');
  }
  
  const response = await api.get(`/api/payment/invoice/${paymentId}?email=${userEmail}&user_id=${userEmail}`, {
    responseType: 'blob'
  });
  
  // Create a download link
  const blob = new Blob([response.data], { type: 'text/html' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `invoice_${paymentId}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
  
  return response.data;
};

/**
 * Generate comprehensive analysis report for a batch
 * @param {string} batchId - Batch ID
 * @param {string} userEmail - User email
 * @returns {Promise} Report generation result
 */
export const generateAnalysisReport = async (batchId, userEmail) => {
  if (!batchId || !userEmail) {
    throw new Error('Batch ID and user email are required');
  }
  
  const response = await api.post(`/api/batch/${batchId}/generate-report`, {
    email: userEmail,
    user_id: userEmail
  });
  
  return response.data;
};

/**
 * Download generated analysis report
 * @param {string} batchId - Batch ID
 * @param {string} filename - Report filename
 * @returns {Promise} Report blob
 */
export const downloadAnalysisReport = async (batchId, filename) => {
  if (!batchId || !filename) {
    throw new Error('Batch ID and filename are required');
  }
  
  const response = await api.get(`/api/batch/${batchId}/download-report?filename=${filename}`, {
    responseType: 'blob'
  });
  
  return new Blob([response.data], { type: 'application/pdf' });
};

/**
 * Share analysis report
 * @param {string} batchId - Batch ID
 * @param {string} filename - Report filename
 * @param {string} method - Share method ('email', 'whatsapp', 'link')
 * @param {string} recipient - Recipient email or phone
 * @param {string} userEmail - User email
 * @returns {Promise} Share result
 */
export const shareAnalysisReport = async (batchId, filename, method, recipient, userEmail) => {
  if (!batchId || !filename || !method || !userEmail) {
    throw new Error('Batch ID, filename, method, and user email are required');
  }
  
  const response = await api.post(`/api/batch/${batchId}/share-report`, {
    filename,
    method,
    recipient,
    email: userEmail,
    user_id: userEmail
  });
  
  return response.data;
};

export default api;

