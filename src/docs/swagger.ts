import path from 'node:path';
import fs from 'node:fs';
import { Router, type Request, type Response, type NextFunction } from 'express';
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

/**
 * Returns latest parsed OpenAPI document from disk, ensuring live updates on reload.
 */
const getOpenApiDocument = (): Record<string, unknown> => {
  try {
    if (fs.existsSync(openApiYamlPath)) {
      return (YAML.load(openApiYamlPath) as Record<string, unknown>) || openApiDocument || {};
    }
  } catch {
    // fallback to initial document
  }
  return openApiDocument || {};
};

const swaggerOptions: swaggerUi.SwaggerUiOptions = {
  customSiteTitle: 'PulseBridge API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
  },
};

// 1. Downloadable Postman collection at /api-docs/postman-collection & /api/docs/postman-collection
const servePostmanCollection = (_req: Request, res: Response) => {
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
};
router.get('/api-docs/postman-collection', servePostmanCollection);
router.get('/api/docs/postman-collection', servePostmanCollection);

// 2. OpenAPI JSON at /api-docs.json & /api/docs.json
const serveOpenApiJson = (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  return res.json(getOpenApiDocument());
};
router.get('/api-docs.json', serveOpenApiJson);
router.get('/api/docs.json', serveOpenApiJson);

// 3. OpenAPI YAML at /api-docs.yaml & /api/docs/openapi.yaml
const serveOpenApiYaml = (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/yaml');
  if (fs.existsSync(openApiYamlPath)) {
    const yamlContent = fs.readFileSync(openApiYamlPath, 'utf8');
    return res.send(yamlContent);
  }
  return res.status(httpStatus.NOT_FOUND).send('# OpenAPI specification not found');
};
router.get('/api-docs.yaml', serveOpenApiYaml);
router.get('/api/docs/openapi.yaml', serveOpenApiYaml);

// 4. Swagger UI at /api-docs and /api/docs (live document reloaded)
router.use('/api-docs', swaggerUi.serve, (req: Request, res: Response, next: NextFunction) => {
  const doc = getOpenApiDocument();
  swaggerUi.setup(doc, swaggerOptions)(req, res, next);
});
router.use('/api/docs', swaggerUi.serve, (req: Request, res: Response, next: NextFunction) => {
  const doc = getOpenApiDocument();
  swaggerUi.setup(doc, swaggerOptions)(req, res, next);
});

export const docsRouter = router;
