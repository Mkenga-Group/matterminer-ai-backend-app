// src/utils/piiSanitizer.js

/**
 * A lightweight utility to proactively redact PII from text before it is embedded or stored.
 * 
 * @param {string} text - The raw text containing potential PII.
 * @returns {string} - The sanitized text with PII redacted.
 */
exports.redactPII = (text) => {
    if (!text || typeof text !== 'string') return text;

    let sanitized = text;

    // Mask Emails (e.g., user@example.com -> [EMAIL_REDACTED])
    sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL_REDACTED]");

    // Mask Phone Numbers (simplified pattern for US/International formats)
    sanitized = sanitized.replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE_REDACTED]");

    // Mask SSNs (e.g., 123-45-6789 -> [SSN_REDACTED])
    sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_REDACTED]");

    return sanitized;
};

/**
 * A hybrid utility that recursively sanitizes raw JSON data.
 * It strictly redacts known sensitive keys entirely, and applies
 * regex redaction to all other unstructured text values.
 * 
 * @param {Object} data - The raw JSON object from the legal module
 * @returns {Object} - The sanitized JSON object
 */
exports.sanitizeLegalJSON = (data) => {
    if (!data) return data;

    const sensitiveKeys = [
        'clientname', 'prospectname', 'address', 'dob', 'dateofbirth',
        'accountnumber', 'creditcard', 'billinginfo', 'ssn', 'passport'
    ];

    const sanitizeNode = (node) => {
        if (Array.isArray(node)) {
            return node.map(item => sanitizeNode(item));
        } else if (node !== null && typeof node === 'object') {
            const sanitizedObj = {};
            for (const [key, value] of Object.entries(node)) {
                const lowerKey = key.toLowerCase();
                
                // 1. Key-Based Redaction: If the key is highly sensitive, mask it completely.
                if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
                    sanitizedObj[key] = '[REDACTED]';
                } 
                // 2. Recursive traversal for nested objects
                else if (typeof value === 'object') {
                    sanitizedObj[key] = sanitizeNode(value);
                } 
                // 3. Regex-Based Redaction: For unstructured text (e.g. descriptions, notes)
                else if (typeof value === 'string') {
                    sanitizedObj[key] = exports.redactPII(value);
                } 
                else {
                    sanitizedObj[key] = value;
                }
            }
            return sanitizedObj;
        }
        return node;
    };

    return sanitizeNode(data);
};
