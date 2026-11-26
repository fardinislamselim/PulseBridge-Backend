export const defaultOpenApiSpec: Record<string, unknown> = {
  openapi: '3.0.3',
  info: {
    title: 'PulseBridge API',
    version: '1.0.0',
    description:
      'REST API documentation for PulseBridge — blood donation matching, request management, and payment platform.',
  },
  servers: [
    {
      url: 'https://pulse-bridge-backend.vercel.app',
      description: 'Production (Vercel)',
    },
    {
      url: 'http://localhost:5000',
      description: 'Local Development',
    },
  ],
  tags: [
    { name: 'Health', description: 'Service & infrastructure health checks' },
    { name: 'Auth', description: 'Authentication & session management' },
    { name: 'Users', description: 'User profile & account management' },
    { name: 'Donors', description: 'Donor profiles & discovery' },
    { name: 'Blood Requests', description: 'Blood donation request lifecycle' },
    { name: 'Matching', description: 'Donor-request compatibility & matching' },
    { name: 'Donations', description: 'Donation history & verification' },
    { name: 'Payments', description: 'Platform support & campaign payments' },
    { name: 'Admin', description: 'Administration & analytics' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  paths: {
    '/': {
      get: {
        tags: ['Health'],
        summary: 'API root status',
        responses: {
          '200': {
            description: 'Service active',
          },
        },
      },
    },
    '/api/v1/health': {
      get: {
        tags: ['Health'],
        summary: 'Database and Redis health check',
        responses: {
          '200': {
            description: 'All services healthy',
          },
          '503': {
            description: 'Service degraded or unavailable',
          },
        },
      },
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        responses: { '201': { description: 'User registered' } },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login with email and password',
        responses: { '200': { description: 'Authenticated' } },
      },
    },
    '/api/v1/users/me': {
      get: {
        tags: ['Users'],
        summary: 'Get current user profile',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Current user profile' } },
      },
    },
    '/api/v1/donors': {
      get: {
        tags: ['Donors'],
        summary: 'List or search blood donors',
        responses: { '200': { description: 'Donor list' } },
      },
    },
    '/api/v1/blood-requests': {
      get: {
        tags: ['Blood Requests'],
        summary: 'List blood requests',
        responses: { '200': { description: 'Blood requests list' } },
      },
    },
    '/api/v1/matching': {
      get: {
        tags: ['Matching'],
        summary: 'Find compatible donors for a request',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Matching results' } },
      },
    },
    '/api/v1/donations': {
      get: {
        tags: ['Donations'],
        summary: 'List donations',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Donations list' } },
      },
    },
    '/api/v1/payments': {
      get: {
        tags: ['Payments'],
        summary: 'List payments',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Payments list' } },
      },
    },
    '/api/v1/admin/analytics': {
      get: {
        tags: ['Admin'],
        summary: 'Admin platform analytics',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Analytics summary' } },
      },
    },
  },
};
