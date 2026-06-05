const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const timeout = require('connect-timeout');

const fs = require('fs');
const YAML = require('yamljs');
const path = require('path');

const crypto = require('crypto');

const morgan = require('morgan');

const routes = require('./routes');

const sequelize = require('./config/database');

const swaggerUi = require('swagger-ui-express');

require('dotenv').config();

const app = express();

app.use(helmet());
app.use(cors());

app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// Timeout middleware should be added before routes
app.use(timeout('15s'));
app.use((req, res, next) => {
  if (!req.timedout) next();
});

// Middleware to capture Correlation ID
app.use((req, res, next) => {
  const correlationId = req.header('X-Correlation-ID') || crypto.randomUUID();
  req.correlationId = correlationId;

  res.setHeader('X-Correlation-ID', correlationId);

  next();
});

app.use(morgan('tiny'));

sequelize.sync({ alter: true })
  .then(() => {
    console.log("Synced db.");
  })
  .catch((err) => {
    console.log("Failed to sync db: " + err.message);
  });


const swaggerDocument = YAML.load(path.join(__dirname, '..', 'swagger.yaml'));
const yamlPath = path.join(__dirname, '..', 'swagger.yaml');
if (fs.existsSync(yamlPath)) {
  const swaggerDocument = YAML.load(yamlPath);
  app.use('/api/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} else {
  console.error(`SWAGGER ERROR: Cannot find file at ${yamlPath}`);
}

app.use('/app', routes);

app.use((req, res) => res.status(404).send({ status: false, error: 'Route not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ status: false, error: 'Internal Server Error' });
});

module.exports = app;
