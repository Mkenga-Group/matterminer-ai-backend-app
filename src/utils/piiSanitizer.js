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
