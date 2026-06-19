-- migrations/sql/00_initial_schema.sql

CREATE TABLE IF NOT EXISTS wallets (
    id CHAR(36) BINARY NOT NULL PRIMARY KEY,
    tenantId VARCHAR(255) NOT NULL UNIQUE,
    balance DECIMAL(15, 6) NOT NULL DEFAULT 100.000000,
    tier ENUM('free', 'pro', 'enterprise') DEFAULT 'free',
    status ENUM('active', 'suspended', 'depleted') DEFAULT 'active',
    createdAt DATETIME NOT NULL,
    updatedAt DATETIME NOT NULL,
    INDEX (tenantId),
    INDEX (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS events (
    id CHAR(36) BINARY NOT NULL PRIMARY KEY,
    tenantId VARCHAR(255) NOT NULL,
    provider VARCHAR(255) NOT NULL,
    providerEventId VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    startTime DATETIME NOT NULL,
    endTime DATETIME NOT NULL,
    location VARCHAR(255),
    attendees JSON,
    recurrence JSON,
    status VARCHAR(255) NOT NULL DEFAULT 'confirmed',
    createdAt DATETIME NOT NULL,
    updatedAt DATETIME NOT NULL,
    INDEX (tenantId),
    INDEX (provider),
    INDEX (providerEventId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS integrations (
    id CHAR(36) BINARY NOT NULL PRIMARY KEY,
    tenantId INTEGER NOT NULL,
    provider ENUM('google', 'microsoft', 'apple') NOT NULL,
    status ENUM('active', 'expired', 'revoked') DEFAULT 'active',
    metadata JSON,
    syncToken TEXT,
    lastSyncAt DATETIME,
    createdAt DATETIME NOT NULL,
    updatedAt DATETIME NOT NULL,
    INDEX (tenantId, provider)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS chatsessions (
    id CHAR(36) BINARY NOT NULL PRIMARY KEY,
    tenantId VARCHAR(255) NOT NULL,
    threadId VARCHAR(255) NOT NULL DEFAULT 'default',
    client_number VARCHAR(255),
    client_type VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255),
    metadata JSON,
    createdAt DATETIME NOT NULL,
    updatedAt DATETIME NOT NULL,
    INDEX (tenantId),
    INDEX (client_number),
    INDEX (email),
    UNIQUE INDEX (tenantId, threadId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
    id CHAR(36) BINARY NOT NULL PRIMARY KEY,
    eventId CHAR(36) BINARY,
    sessionId CHAR(36) BINARY,
    tenantId VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    performedBy VARCHAR(255) NOT NULL,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    details JSON,
    INDEX (tenantId),
    INDEX (eventId),
    INDEX (sessionId),
    CONSTRAINT audit_logs_ibfk_1 FOREIGN KEY (eventId) REFERENCES events (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT audit_logs_ibfk_2 FOREIGN KEY (sessionId) REFERENCES chatsessions (id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT audit_logs_ibfk_3 FOREIGN KEY (tenantId) REFERENCES wallets (tenantId) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;
