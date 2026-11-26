import path from 'node:path';
import fs from 'node:fs';
import { Router, type Request, type Response, type NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import httpStatus from 'http-status';

const router = Router();

const SWAGGER_UI_CDN_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.18.2';

const resolveExistingPath = (candidates: string[]): string => {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
};

const getOpenApiYamlPath = (): string =>
  resolveExistingPath([
    path.join(process.cwd(), 'docs', 'openapi.yaml'),
    path.join(process.cwd(), 'dist', 'docs', 'openapi.yaml'),
  ]);

const openApiYamlPath = getOpenApiYamlPath();
const postmanCollectionPath = path.join(
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
  const yamlPath = getOpenApiYamlPath();
  try {
    if (fs.existsSync(yamlPath)) {
      return (YAML.load(yamlPath) as Record<string, unknown>) || openApiDocument || {};
    }
  } catch {
    // fallback to initial document
  }
  return openApiDocument || {};
};

const swaggerOptions: swaggerUi.SwaggerUiOptions = {
  customSiteTitle: 'PulseBridge API Documentation',
  customCssUrl: `${SWAGGER_UI_CDN_BASE}/swagger-ui.min.css`,
  customJs: [
    `${SWAGGER_UI_CDN_BASE}/swagger-ui-bundle.min.js`,
    `${SWAGGER_UI_CDN_BASE}/swagger-ui-standalone-preset.min.js`,
  ],
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
  const yamlPath = getOpenApiYamlPath();
  res.setHeader('Content-Type', 'text/yaml');
  if (fs.existsSync(yamlPath)) {
    const yamlContent = fs.readFileSync(yamlPath, 'utf8');
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
