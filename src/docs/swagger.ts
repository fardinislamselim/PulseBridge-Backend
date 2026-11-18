import path from 'node:path';
import fs from 'node:fs';
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import httpStatus from 'http-status';

const router = Router();

const openApiYamlPath = path.resolve(process.cwd(), 'docs', 'openapi.yaml');
const postmanCollectionPath = path.resolve(
  process.cwd(),
  'postman',
  'PulseBridge.postman_collection.json'
);

let openApiDocument: Record<string, unknown>;
try {
  openApiDocument = YAML.load(openApiYamlPath);
} catch {
  openApiDocument = {};
}

const swaggerOptions: swaggerUi.SwaggerUiOptions = {
  customSiteTitle: 'PulseBridge API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
  },
};

// 1. Downloadable Postman collection at /api-docs/postman-collection (must precede /api-docs prefix)
router.get('/api-docs/postman-collection', (_req, res) => {
  if (fs.existsSync(postmanCollectionPath)) {
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="PulseBridge.postman_collection.json"'
    );
    res.setHeader('Content-Type', 'application/json');
    const collectionContent = fs.readFileSync(postmanCollectionPath, 'utf8');
    return res.send(collectionContent);
  }
  return res.status(httpStatus.NOT_FOUND).json({
    success: false,
    statusCode: httpStatus.NOT_FOUND,
    message: 'Postman collection file not found',
  });
});

// 2. OpenAPI JSON at /api-docs.json
router.get('/api-docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  return res.json(openApiDocument);
});

// 3. OpenAPI YAML at /api-docs.yaml
router.get('/api-docs.yaml', (_req, res) => {
  res.setHeader('Content-Type', 'text/yaml');
  if (fs.existsSync(openApiYamlPath)) {
    const yamlContent = fs.readFileSync(openApiYamlPath, 'utf8');
    return res.send(yamlContent);
  }
  return res.status(httpStatus.NOT_FOUND).send('# OpenAPI specification not found');
});

// 4. Swagger UI at /api-docs
router.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, swaggerOptions));

export const docsRouter = router;
