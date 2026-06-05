const axios = require('axios');

/**
 * A standardized Axios HTTP request wrapper.
 * * @param {string} url - The API endpoint.
 * @param {string} method - The HTTP method (e.g., 'get', 'post', 'put', 'delete').
 * @param {object} [data=null] - The request body payload as a Javascript object.
 * @param {object} [customHeaders={}] - Any additional headers to merge with defaults.
 * @returns {Promise<object>} - A standardized response: { success, status, message, data }.
 */
const apiRequest = async (url, method = 'get', data = null, customHeaders = {}, apiKey = null, tenantId = null) => {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...customHeaders // Allows overwriting or adding headers per request
  };

  if(apiKey){
      headers['X-API-Key'] = `${apiKey}`;
  }

  if(tenantId){
      headers['X-Tenant-ID'] = tenantId;
  }	
	
  const config = {
    method: method.toLowerCase(),
    url: url,
    headers: headers,
    data: data, // Axios automatically serializes this to JSON
    maxBodyLength: Infinity,
  };
    
  try {
    const response = await axios.request(config);
    
    return {
      success: true,
      status: response.status,
      message: response.statusText || 'Request successful',
      data: response.data
    };
    
  } catch (error) {
    // Safely trap errors to prevent unhandled promise rejections
    if (error.response) {
      // The server responded with a status code outside the 2xx range
      return {
        success: false,
        status: error.response.status,
        message: error.response.data?.message || error.message || 'Request failed',
        data: error.response.data || null
      };
    } else if (error.request) {
      // The request was made, but no response was received (e.g., timeout, network issue)
      return {
        success: false,
        status: 503,
        message: 'Service Unavailable: No response received from the server',
        data: null
      };
    } else {
      // An internal error occurred while setting up the request
      return {
        success: false,
        status: 500,
        message: `Internal Request Error: ${error.message}`,
        data: null
      };
    }
  }
};

module.exports = { apiRequest };
