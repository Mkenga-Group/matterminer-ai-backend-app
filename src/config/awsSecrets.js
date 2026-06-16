const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

// Resolve Base Directory to the project root
const BASE_DIR = path.resolve(__dirname, '..', '..');

async function loadAwsSecrets(baseDir = BASE_DIR) {
    // Safely load local .env variables
    try {
        const envPath = path.join(baseDir, '.env');
        if (fs.existsSync(envPath)) {
            dotenv.config({ path: envPath });
        }
    } catch (e) {
        // Pass silently if dotenv fails
    }

    const defaultRegion = process.env.AWS_REGION || "us-east-1";
    const rdsEuRegion = process.env.AWS_RDS_EU_REGION || "eu-north-1";

    const secretTargets = [
        { id: process.env.AWS_SECRET_ID, region: defaultRegion },
        { id: process.env.AWS_RDS_SECRET_ID, region: rdsEuRegion }
    ];

    // Process each targeted secret sequentially
    for (const target of secretTargets) {
        const secretId = target.id;
        const targetRegion = target.region;

        if (!secretId) continue;

        try {
            const client = new SecretsManagerClient({ region: targetRegion });
            const command = new GetSecretValueCommand({ SecretId: secretId });
            const response = await client.send(command);
            
            if (response.SecretString) {
                let secretsPayload;
                
                // Safely parse JSON
                try {
                    secretsPayload = JSON.parse(response.SecretString);
                } catch (parseErr) {
                    throw new Error(`Invalid JSON payload in secret '${secretId}': ${parseErr.message}`);
                }
                
                // Inject secrets into process.env
                for (const [key, val] of Object.entries(secretsPayload)) {
                    process.env[key] = String(val);
                    
                    // Special DB mapping cases
                    if (key === "username") process.env.DB_USER = String(val);
                    else if (key === "password") process.env.DB_PASSWORD = String(val);
                }
                console.log(`[AWS SECRETS] Successfully loaded keys from '${secretId}' out of [${targetRegion}]`);
            }
        } catch (error) {
            console.error(`[AWS SECRETS] Critical - Failed to load '${secretId}' from [${targetRegion}]: ${error.message}`);
            // Recommended fail-fast approach for critical secrets
            throw error; 
        }
    }
}

// Export for execution at the app's entry point
module.exports = { loadAwsSecrets, BASE_DIR };
