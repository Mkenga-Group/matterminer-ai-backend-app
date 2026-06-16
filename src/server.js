const { loadAwsSecrets } = require('./config/awsSecrets');

async function startServer() {
    try {
        await loadAwsSecrets();
        
        const app = require('./app');
        const PORT = process.env.PORT || 3000;

        app.listen(PORT, () => {
          console.log(`Server running on port ${PORT}`);
        });
    } catch (err) {
        console.error("Failed to start server due to configuration errors", err);
        process.exit(1);
    }
}

startServer();
