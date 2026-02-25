const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const fs = require('fs');
const YAML = require('yamljs');
const path = require('path');

const uuid = require('uuid');

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
if(fs.existsSync(yamlPath)) {
    const swaggerDocument = YAML.load(yamlPath);	
    app.use('/calendar/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));	
}else{
    console.error(`SWAGGER ERROR: Cannot find file at ${yamlPath}`);
}

app.use('/calendar', routes);

app.use((req, res) => res.status(404).send("Route not found"));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Middleware to capture Correlation ID
app.use((req, res, next) => {
  const correlationId = req.header('X-Correlation-ID') || uuid.v4();   
  req.correlationId = correlationId;

  res.setHeader('X-Correlation-ID', correlationId);
    
  next();
});

module.exports = app;
