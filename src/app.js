const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const fs = require('fs');
const YAML = require('yamljs');
const path = require('path');

const routes = require('./routes');

const swaggerUi = require('swagger-ui-express');

require('dotenv').config();

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

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

module.exports = app;
