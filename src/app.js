const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const timeout = require('connect-timeout');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');

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

// Rate Limiting: Limit each IP to 100 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/app', limiter);

app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// Prevent parameter pollution
app.use(hpp());

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

const migrator = require('./config/migrator');

migrator.up()
  .then(() => {
    console.log("Database migrations successfully executed.");
  })
  .catch((err) => {
    console.error("Failed to run migrations: " + err.message);
  });


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
