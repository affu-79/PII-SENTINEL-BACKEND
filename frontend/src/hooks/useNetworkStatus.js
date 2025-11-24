import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook to monitor network status and connection quality
 * Returns: { isOnline, isSlowConnection, showOfflinePage, showLoader }
 */
export const useNetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSlowConnection, setIsSlowConnection] = useState(false);
    const [showOfflinePage, setShowOfflinePage] = useState(false);

    // Handle online/offline events
    useEffect(() => {
        const handleOnline = () => {
            console.log('✓ Network connection restored');
            setIsOnline(true);
            setShowOfflinePage(false);
        };

        const handleOffline = () => {
            console.log('✗ Network connection lost');
            setIsOnline(false);
            setShowOfflinePage(true);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Check initial state
        if (!navigator.onLine) {
            setShowOfflinePage(true);
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Detect slow connection using Network Information API
    useEffect(() => {
        const checkConnectionSpeed = () => {
            if ('connection' in navigator) {
                const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
                
                if (connection) {
                    const effectiveType = connection.effectiveType;
                    const downlink = connection.downlink; // Mbps
                    
                    // Consider connection slow if:
                    // - effectiveType is 'slow-2g' or '2g'
                    // - downlink is less than 1 Mbps
                    const isSlow = 
                        effectiveType === 'slow-2g' || 
                        effectiveType === '2g' ||
                        (downlink && downlink < 1);
                    
                    setIsSlowConnection(isSlow);
                    
                    if (isSlow) {
                        console.warn('⚠️ Slow network connection detected');
                    }
                }
            }
        };

        checkConnectionSpeed();

        // Listen for connection changes
        if ('connection' in navigator) {
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (connection) {
                connection.addEventListener('change', checkConnectionSpeed);
                return () => connection.removeEventListener('change', checkConnectionSpeed);
            }
        }
    }, []);

    return {
        isOnline,
        isSlowConnection,
        showOfflinePage,
    };
};

/**
 * Hook to track API request loading state with timeout detection
 * Shows loader for slow requests (> 500ms)
 */
export const useApiLoader = (timeout = 500) => {
    const [isLoading, setIsLoading] = useState(false);
    const [showLoader, setShowLoader] = useState(false);
    const [timeoutId, setTimeoutId] = useState(null);

    const startLoading = useCallback(() => {
        setIsLoading(true);
        
        // Show loader after timeout (for slow connections)
        const id = setTimeout(() => {
            setShowLoader(true);
        }, timeout);
        
        setTimeoutId(id);
    }, [timeout]);

    const stopLoading = useCallback(() => {
        setIsLoading(false);
        setShowLoader(false);
        
        if (timeoutId) {
            clearTimeout(timeoutId);
            setTimeoutId(null);
        }
    }, [timeoutId]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [timeoutId]);

    return {
        isLoading,
        showLoader,
        startLoading,
        stopLoading,
    };
};

/**
 * Axios interceptor setup to handle network errors and slow requests
 */
export const setupAxiosInterceptors = (axiosInstance) => {
    // Request interceptor
    axiosInstance.interceptors.request.use(
        (config) => {
            config.metadata = { startTime: new Date() };
            return config;
        },
        (error) => {
            return Promise.reject(error);
        }
    );

    // Response interceptor
    axiosInstance.interceptors.response.use(
        (response) => {
            // Calculate request duration
            const duration = new Date() - response.config.metadata.startTime;
            
            if (duration > 3000) {
                console.warn(`⚠️ Slow API response: ${response.config.url} (${duration}ms)`);
            }
            
            return response;
        },
        (error) => {
            // Handle network errors
            if (!error.response) {
                // Network error (no response from server)
                if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
                    console.error('❌ Network error: Unable to reach server');
                    error.isNetworkError = true;
                }
                
                // Timeout error
                if (error.code === 'ECONNABORTED') {
                    console.error('❌ Request timeout');
                    error.isTimeout = true;
                }
            }
            
            return Promise.reject(error);
        }
    );
};

/**
 * Utility to check if server is reachable
 */
export const checkServerHealth = async (url = '/api/health', timeout = 5000) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
            signal: controller.signal,
            method: 'GET',
        });
        
        clearTimeout(timeoutId);
        
        return response.ok;
    } catch (error) {
        console.error('Server health check failed:', error);
        return false;
    }
};

export default useNetworkStatus;

