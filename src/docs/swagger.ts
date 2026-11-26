import path from 'node:path';
import fs from 'node:fs';
import { Router, type Request, type Response, type NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import httpStatus from 'http-status';
import { env } from '../config/env.js';
import { defaultOpenApiSpec } from './openapi.js';

const router = Router();

const SWAGGER_UI_CDN_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.18.2';
const PRODUCTION_VERCEL_URL = 'https://pulse-bridge-backend.vercel.app';

const resolveExistingPath = (candidates: string[]): string | null => {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
};

const getOpenApiYamlPath = (): string | null =>
  resolveExistingPath([
    path.join(process.cwd(), 'docs', 'openapi.yaml'),
    path.join(process.cwd(), 'dist', 'docs', 'openapi.yaml'),
  ]);

const postmanCollectionPath = path.join(
  process.cwd(),
  'postman',
  'PulseBridge.postman_collection.json'
);

const isValidOpenApiDoc = (doc: unknown): doc is Record<string, unknown> => {
  if (!doc || typeof doc !== 'object') {
    return false;
  }
  const record = doc as Record<string, unknown>;
  return (
    (typeof record.openapi === 'string' && record.openapi.trim().length > 0) ||
    (typeof record.swagger === 'string' && record.swagger.trim().length > 0)
  );
};

const loadOpenApiBaseDocument = (): Record<string, unknown> => {
  const yamlPath = getOpenApiYamlPath();
  if (yamlPath) {
    try {
      const parsed = YAML.load(yamlPath) as unknown;
      if (isValidOpenApiDoc(parsed)) {
        return parsed;
      }
      console.error(
        `[Swagger] Loaded OpenAPI YAML from "${yamlPath}" is invalid or missing "openapi"/"swagger" version field. Falling back to bundled OpenAPI spec.`
      );
    } catch (error) {
      console.error(
        `[Swagger] Failed to parse OpenAPI YAML at "${yamlPath}". Falling back to bundled OpenAPI spec:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  if (!isValidOpenApiDoc(defaultOpenApiSpec)) {
    console.error('[Swagger] Bundled OpenAPI spec is invalid or missing "openapi"/"swagger" version field.');
  }

  return defaultOpenApiSpec;
};

let openApiDocument: Record<string, unknown> = loadOpenApiBaseDocument();

const buildServersList = (req?: Request): Array<{ url: string; description: string }> => {
  const isProd = process.env.VERCEL === '1' || env.NODE_ENV === 'production';
  const localUrl = `http://localhost:${env.PORT}`;
  const configuredBackendUrl =
    env.BACKEND_URL && !env.BACKEND_URL.includes('localhost') ? env.BACKEND_URL : PRODUCTION_VERCEL_URL;

  const requestHost = req?.get('host');
  const requestProtocol = req?.headers['x-forwarded-proto']?.toString().split(',')[0] || req?.protocol || 'https';
  const liveOrigin =
    requestHost && !requestHost.includes('localhost')
      ? `${requestProtocol}://${requestHost}`
      : configuredBackendUrl;

  if (isProd) {
    const servers = [{ url: liveOrigin, description: 'Production Server' }];
    if (liveOrigin !== PRODUCTION_VERCEL_URL) {
      servers.push({ url: PRODUCTION_VERCEL_URL, description: 'Production (Vercel)' });
    }
    servers.push({ url: localUrl, description: 'Local Development' });
    return servers;
  }

  return [
    { url: localUrl, description: 'Local Development' },
    { url: PRODUCTION_VERCEL_URL, description: 'Production (Vercel)' },
  ];
};

/**
 * Returns latest parsed OpenAPI document with environment-appropriate servers.
 */
const getOpenApiDocument = (req?: Request): Record<string, unknown> => {
  const baseDoc = loadOpenApiBaseDocument();
  openApiDocument = baseDoc;

  if (!isValidOpenApiDoc(baseDoc)) {
    console.error('[Swagger] OpenAPI document is missing a valid "openapi" or "swagger" version field.');
  }

  return {
    ...baseDoc,
    servers: buildServersList(req),
  };
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
const serveOpenApiJson = (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  return res.json(getOpenApiDocument(req));
};
router.get('/api-docs.json', serveOpenApiJson);
router.get('/api/docs.json', serveOpenApiJson);

// 3. OpenAPI YAML at /api-docs.yaml & /api/docs/openapi.yaml
const serveOpenApiYaml = (req: Request, res: Response) => {
  const yamlPath = getOpenApiYamlPath();
  res.setHeader('Content-Type', 'text/yaml');
  if (yamlPath && fs.existsSync(yamlPath)) {
    const yamlContent = fs.readFileSync(yamlPath, 'utf8');
    return res.send(yamlContent);
  }
  return res.send(YAML.stringify(getOpenApiDocument(req), 10, 2));
};
router.get('/api-docs.yaml', serveOpenApiYaml);
router.get('/api/docs/openapi.yaml', serveOpenApiYaml);

// 4. Swagger UI at /api-docs and /api/docs (live document reloaded)
router.use('/api-docs', swaggerUi.serve, (req: Request, res: Response, next: NextFunction) => {
  const doc = getOpenApiDocument(req);
  swaggerUi.setup(doc, swaggerOptions)(req, res, next);
});
router.use('/api/docs', swaggerUi.serve, (req: Request, res: Response, next: NextFunction) => {
  const doc = getOpenApiDocument(req);
  swaggerUi.setup(doc, swaggerOptions)(req, res, next);
});

export const docsRouter = router;
