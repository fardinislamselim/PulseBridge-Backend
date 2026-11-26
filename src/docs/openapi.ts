const BLOOD_GROUPS = [
  'A_POSITIVE',
  'A_NEGATIVE',
  'B_POSITIVE',
  'B_NEGATIVE',
  'AB_POSITIVE',
  'AB_NEGATIVE',
  'O_POSITIVE',
  'O_NEGATIVE',
] as const;

const USER_ROLES = ['USER', 'REQUESTER', 'DONOR', 'ADMIN', 'SUPER_ADMIN'] as const;
const USER_STATUSES = ['ACTIVE', 'BLOCKED', 'DELETED'] as const;
const REQUEST_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'MATCHING',
  'IN_PROGRESS',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
  'CANCELLED',
  'EXPIRED',
] as const;
const REQUEST_URGENCIES = ['NORMAL', 'URGENT', 'EMERGENCY'] as const;
const DONATION_STATUSES = ['PENDING', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'FAILED'] as const;
const DONATION_VERIFICATION_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'] as const;
const PAYMENT_PROVIDERS = ['SSLCOMMERZ', 'STRIPE'] as const;
const PAYMENT_PURPOSES = ['PLATFORM_SUPPORT', 'CAMPAIGN_DONATION', 'OTHER'] as const;
const PAYMENT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'PAID',
  'SUCCESS',
  'FAILED',
  'CANCELLED',
  'REFUND_PENDING',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
] as const;
const REFUND_STATUSES = ['PENDING', 'PROCESSING', 'SUCCEEDED', 'SUCCESS', 'FAILED', 'CANCELLED'] as const;

const authSecurity = [{ bearerAuth: [] }, { cookieAuth: [] }];

const jsonContent = (schema: Record<string, unknown>, example?: unknown) => ({
  'application/json': {
    schema,
    ...(example !== undefined ? { example } : {}),
  },
});

const successResponse = (
  description: string,
  dataSchema: Record<string, unknown> = { type: 'object', additionalProperties: true },
  example?: unknown,
  withMeta = false
) => ({
  description,
  content: jsonContent(
    {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        statusCode: { type: 'integer', example: 200 },
        message: { type: 'string', example: description },
        ...(withMeta ? { meta: { $ref: '#/components/schemas/PaginationMeta' } } : {}),
        data: dataSchema,
      },
    },
    example
  ),
});

const errorRef = (ref: string, description: string) => ({
  description,
  content: jsonContent({ $ref: `#/components/schemas/${ref}` }),
});

const stdErrors = (includeAuth = true, includeForbidden = false, includeNotFound = false) => ({
  '400': errorRef('ErrorResponse', 'Bad Request / Validation Error'),
  ...(includeAuth ? { '401': errorRef('ErrorResponse', 'Unauthorized — missing or invalid token') } : {}),
  ...(includeForbidden ? { '403': errorRef('ErrorResponse', 'Forbidden — insufficient role permissions') } : {}),
  ...(includeNotFound ? { '404': errorRef('ErrorResponse', 'Resource Not Found') } : {}),
  '500': errorRef('ErrorResponse', 'Internal Server Error'),
});

const pathParam = (name: string, description: string, format?: string) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string', ...(format ? { format } : {}) },
});

const queryParam = (
  name: string,
  schema: Record<string, unknown>,
  description: string,
  required = false
) => ({
  name,
  in: 'query',
  required,
  description,
  schema,
});

const paginationParams = [
  queryParam('page', { type: 'integer', minimum: 1, default: 1 }, 'Page number'),
  queryParam('limit', { type: 'integer', minimum: 1, maximum: 100, default: 10 }, 'Items per page'),
];

const analyticsQueryParams = [
  queryParam(
    'period',
    { type: 'string', enum: ['today', '7d', '30d', '90d', '6m', '1y', 'all'], default: '30d' },
    'Time range preset'
  ),
  queryParam('startDate', { type: 'string', format: 'date-time' }, 'Filter start date (ISO 8601)'),
  queryParam('endDate', { type: 'string', format: 'date-time' }, 'Filter end date (ISO 8601)'),
  queryParam('interval', { type: 'string', enum: ['day', 'week', 'month'], default: 'day' }, 'Aggregation bucket'),
  queryParam('district', { type: 'string' }, 'Filter by district'),
  queryParam('bloodGroup', { type: 'string', enum: [...BLOOD_GROUPS] }, 'Filter by blood group'),
  queryParam('status', { type: 'string' }, 'Filter by status'),
  queryParam('urgency', { type: 'string', enum: [...REQUEST_URGENCIES] }, 'Filter by urgency'),
  queryParam('refresh', { type: 'boolean', default: false }, 'Bypass analytics cache'),
];

const userQueryParams = [
  ...paginationParams,
  queryParam('search', { type: 'string' }, 'Search by name, email, or phone'),
  queryParam('role', { type: 'string', enum: [...USER_ROLES] }, 'Filter by user role'),
  queryParam('status', { type: 'string', enum: [...USER_STATUSES] }, 'Filter by account status'),
  queryParam('emailVerified', { type: 'boolean' }, 'Filter by email verification status'),
  queryParam(
    'sortBy',
    { type: 'string', enum: ['createdAt', 'name', 'email', 'role', 'status'], default: 'createdAt' },
    'Sort field'
  ),
  queryParam('sortOrder', { type: 'string', enum: ['asc', 'desc'], default: 'desc' }, 'Sort direction'),
];

const donorQueryParams = [
  ...paginationParams,
  queryParam('search', { type: 'string' }, 'Search donors by name, city, district, or area'),
  queryParam('bloodGroup', { type: 'string', enum: [...BLOOD_GROUPS] }, 'Filter by blood group'),
  queryParam('district', { type: 'string' }, 'Filter by district'),
  queryParam('city', { type: 'string' }, 'Filter by city'),
  queryParam('area', { type: 'string' }, 'Filter by area'),
  queryParam('isAvailable', { type: 'boolean' }, 'Filter by availability'),
  queryParam('isVerified', { type: 'boolean' }, 'Filter by verification status'),
  queryParam('eligible', { type: 'boolean' }, 'Filter by donation eligibility (90-day rule)'),
  queryParam(
    'sortBy',
    {
      type: 'string',
      enum: ['createdAt', 'city', 'district', 'area', 'lastDonationDate', 'eligibleAt'],
      default: 'createdAt',
    },
    'Sort field'
  ),
  queryParam('sortOrder', { type: 'string', enum: ['asc', 'desc'], default: 'desc' }, 'Sort direction'),
];

const donationQueryParams = [
  ...paginationParams,
  queryParam(
    'sortBy',
    { type: 'string', enum: ['createdAt', 'donationDate', 'completedAt', 'unitsDonated'], default: 'createdAt' },
    'Sort field'
  ),
  queryParam('sortOrder', { type: 'string', enum: ['asc', 'desc'], default: 'desc' }, 'Sort direction'),
  queryParam('status', { type: 'string', enum: [...DONATION_STATUSES] }, 'Filter by donation status'),
  queryParam(
    'verificationStatus',
    { type: 'string', enum: [...DONATION_VERIFICATION_STATUSES] },
    'Filter by verification status'
  ),
  queryParam('startDate', { type: 'string', format: 'date-time' }, 'Filter from date'),
  queryParam('endDate', { type: 'string', format: 'date-time' }, 'Filter to date'),
  queryParam('bloodRequestId', { type: 'string' }, 'Filter by blood request ID'),
  queryParam('donorId', { type: 'string' }, 'Filter by donor ID'),
  queryParam('district', { type: 'string' }, 'Filter by district'),
  queryParam('bloodGroup', { type: 'string', enum: [...BLOOD_GROUPS] }, 'Filter by blood group'),
];

const paymentQueryParams = [
  ...paginationParams,
  queryParam('sortBy', { type: 'string', enum: ['createdAt', 'paidAt', 'amount'], default: 'createdAt' }, 'Sort field'),
  queryParam('sortOrder', { type: 'string', enum: ['asc', 'desc'], default: 'desc' }, 'Sort direction'),
  queryParam('status', { type: 'string', enum: [...PAYMENT_STATUSES] }, 'Filter by payment status'),
  queryParam('provider', { type: 'string', enum: [...PAYMENT_PROVIDERS] }, 'Filter by gateway provider'),
  queryParam('paymentPurpose', { type: 'string', enum: [...PAYMENT_PURPOSES] }, 'Filter by payment purpose'),
  queryParam('currency', { type: 'string' }, '3-letter currency code (e.g. BDT, USD)'),
  queryParam('transactionId', { type: 'string' }, 'Filter by transaction ID'),
  queryParam('userId', { type: 'string' }, 'Filter by user ID'),
  queryParam('startDate', { type: 'string', format: 'date-time' }, 'Filter from date'),
  queryParam('endDate', { type: 'string', format: 'date-time' }, 'Filter to date'),
  queryParam('minAmount', { type: 'number', minimum: 0 }, 'Minimum amount'),
  queryParam('maxAmount', { type: 'number', minimum: 0 }, 'Maximum amount'),
];

const refundQueryParams = [
  ...paginationParams,
  queryParam('sortBy', { type: 'string', enum: ['createdAt', 'amount'], default: 'createdAt' }, 'Sort field'),
  queryParam('sortOrder', { type: 'string', enum: ['asc', 'desc'], default: 'desc' }, 'Sort direction'),
  queryParam('status', { type: 'string', enum: [...REFUND_STATUSES] }, 'Filter by refund status'),
  queryParam('paymentId', { type: 'string' }, 'Filter by payment ID'),
  queryParam('startDate', { type: 'string', format: 'date-time' }, 'Filter from date'),
  queryParam('endDate', { type: 'string', format: 'date-time' }, 'Filter to date'),
  queryParam('minAmount', { type: 'number', minimum: 0 }, 'Minimum amount'),
  queryParam('maxAmount', { type: 'number', minimum: 0 }, 'Maximum amount'),
];

const bloodRequestQueryParams = [
  ...paginationParams,
  queryParam('search', { type: 'string' }, 'Search patient name, hospital, or location'),
  queryParam('bloodGroup', { type: 'string', enum: [...BLOOD_GROUPS] }, 'Filter by blood group'),
  queryParam('district', { type: 'string' }, 'Filter by district'),
  queryParam('city', { type: 'string' }, 'Filter by city'),
  queryParam('area', { type: 'string' }, 'Filter by area'),
  queryParam('urgency', { type: 'string', enum: [...REQUEST_URGENCIES] }, 'Filter by urgency'),
  queryParam('status', { type: 'string', enum: [...REQUEST_STATUSES] }, 'Filter by status'),
  queryParam('fromDate', { type: 'string', format: 'date-time' }, 'Filter from date'),
  queryParam('toDate', { type: 'string', format: 'date-time' }, 'Filter to date'),
  queryParam(
    'sortBy',
    {
      type: 'string',
      enum: ['createdAt', 'requiredAt', 'neededAt', 'urgency', 'unitsRequired', 'city', 'district'],
      default: 'createdAt',
    },
    'Sort field'
  ),
  queryParam('sortOrder', { type: 'string', enum: ['asc', 'desc'], default: 'desc' }, 'Sort direction'),
];

const adminBloodRequestQueryParams = [
  ...paginationParams,
  queryParam('search', { type: 'string' }, 'Search patient name, hospital, or location'),
  queryParam('bloodGroup', { type: 'string', enum: [...BLOOD_GROUPS] }, 'Filter by blood group'),
  queryParam('district', { type: 'string' }, 'Filter by district'),
  queryParam('city', { type: 'string' }, 'Filter by city'),
  queryParam('area', { type: 'string' }, 'Filter by area'),
  queryParam('urgency', { type: 'string', enum: [...REQUEST_URGENCIES] }, 'Filter by urgency'),
  queryParam('status', { type: 'string', enum: [...REQUEST_STATUSES] }, 'Filter by status'),
  queryParam('requesterId', { type: 'string', format: 'uuid' }, 'Filter by requester UUID'),
  queryParam('createdFrom', { type: 'string', format: 'date-time' }, 'Created after date'),
  queryParam('createdTo', { type: 'string', format: 'date-time' }, 'Created before date'),
  queryParam('neededFrom', { type: 'string', format: 'date-time' }, 'Needed after date'),
  queryParam('neededTo', { type: 'string', format: 'date-time' }, 'Needed before date'),
  queryParam(
    'sortBy',
    {
      type: 'string',
      enum: ['createdAt', 'requiredAt', 'neededAt', 'urgency', 'unitsRequired', 'fulfilledUnits', 'city', 'district'],
      default: 'createdAt',
    },
    'Sort field'
  ),
  queryParam('sortOrder', { type: 'string', enum: ['asc', 'desc'], default: 'desc' }, 'Sort direction'),
];

export const defaultOpenApiSpec: Record<string, unknown> = {
  openapi: '3.0.3',
  info: {
    title: 'PulseBridge API',
    version: '1.0.0',
    description:
      'Complete REST API documentation for PulseBridge — blood donation matching, request lifecycle management, donor eligibility, payments/refunds, and admin analytics.',
  },
  servers: [
    { url: 'https://pulse-bridge-backend.vercel.app', description: 'Production (Vercel)' },
    { url: 'http://localhost:5000', description: 'Local Development' },
  ],
  tags: [
    { name: 'Health', description: 'Root status and infrastructure health checks' },
    { name: 'Auth', description: 'Registration, login, OAuth, OTP verification, password reset & sessions' },
    { name: 'Users', description: 'User profile & administrative user management' },
    { name: 'Donors', description: 'Donor profile, eligibility, availability & geospatial discovery' },
    { name: 'Blood Requests', description: 'Blood donation request lifecycle & administration' },
    { name: 'Matching', description: 'ABO/Rh blood group compatibility & eligible donor matching' },
    { name: 'Donations', description: 'Donation records, verification & 90-day cooldown history' },
    { name: 'Payments', description: 'Payment initiation, gateway callbacks/webhooks & refunds' },
    { name: 'Admin', description: 'Admin dashboard, analytics, audit logs & entity management (ADMIN / SUPER_ADMIN)' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token passed in Authorization: Bearer <token>',
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'accessToken',
        description: 'HTTP-only accessToken cookie set on login/register/refresh',
      },
    },
    schemas: {
      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 10 },
          total: { type: 'integer', example: 42 },
          totalPages: { type: 'integer', example: 5 },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          statusCode: { type: 'integer', example: 400 },
          message: { type: 'string', example: 'Validation failed' },
          error: {
            type: 'object',
            additionalProperties: true,
            example: { name: 'ValidationError' },
          },
        },
      },
      UserSummary: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Amina Rahman' },
          email: { type: 'string', format: 'email', example: 'amina@example.com' },
          phone: { type: 'string', nullable: true, example: '+8801712345678' },
          role: { type: 'string', enum: [...USER_ROLES] },
          status: { type: 'string', enum: [...USER_STATUSES] },
          emailVerified: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      BloodRequest: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          requesterId: { type: 'string', format: 'uuid' },
          patientName: { type: 'string', example: 'Karim Uddin' },
          bloodGroup: { type: 'string', enum: [...BLOOD_GROUPS], example: 'O_NEGATIVE' },
          unitsRequired: { type: 'integer', example: 2 },
          fulfilledUnits: { type: 'integer', example: 0 },
          hospitalName: { type: 'string', example: 'Dhaka Medical College Hospital' },
          hospitalAddress: { type: 'string', example: 'Secretariat Rd, Dhaka 1000' },
          district: { type: 'string', example: 'Dhaka' },
          city: { type: 'string', example: 'Dhaka' },
          area: { type: 'string', nullable: true, example: 'Shahbag' },
          contactPerson: { type: 'string', example: 'Rahim Uddin' },
          contactPhone: { type: 'string', example: '+8801712345678' },
          requiredAt: { type: 'string', format: 'date-time' },
          urgency: { type: 'string', enum: [...REQUEST_URGENCIES], example: 'URGENT' },
          status: { type: 'string', enum: [...REQUEST_STATUSES], example: 'PENDING' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    // =========================================================================
    // HEALTH & ROOT
    // =========================================================================
    '/': {
      get: {
        tags: ['Health'],
        summary: 'API root status',
        description: 'Returns service metadata and links to health check and Swagger documentation.',
        responses: {
          '200': successResponse('PulseBridge API service is active', {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'PulseBridge Backend' },
              version: { type: 'string', example: '1.0.0' },
              health: { type: 'string', example: '/api/v1/health' },
              docs: { type: 'string', example: '/api-docs' },
            },
          }),
        },
      },
    },
    '/api/v1/health': {
      get: {
        tags: ['Health'],
        summary: 'Infrastructure health check',
        description: 'Verifies PostgreSQL and Redis connectivity.',
        responses: {
          '200': successResponse('PulseBridge API is healthy and operational', {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
              timestamp: { type: 'string', format: 'date-time' },
              application: { type: 'string', example: 'PulseBridge' },
              services: {
                type: 'object',
                properties: {
                  database: { type: 'string', enum: ['connected', 'disconnected'] },
                  redis: { type: 'string', enum: ['connected', 'disconnected'] },
                },
              },
            },
          }),
          '503': errorRef('ErrorResponse', 'Service degraded or infrastructure unavailable'),
        },
      },
    },

    // =========================================================================
    // AUTH
    // =========================================================================
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user account',
        description:
          'Registers a REQUESTER or DONOR account. DONOR registration requires bloodGroup, district, and phone.',
        requestBody: {
          required: true,
          content: jsonContent(
            {
              type: 'object',
              required: ['name', 'email', 'password'],
              properties: {
                name: { type: 'string', minLength: 2, maxLength: 100 },
                email: { type: 'string', format: 'email' },
                password: { type: 'string', minLength: 8, description: 'Must include upper, lower, digit & special char' },
                phone: { type: 'string', pattern: '^\\+?[0-9]{10,15}$' },
                role: { type: 'string', enum: ['DONOR', 'REQUESTER'], default: 'REQUESTER' },
                bloodGroup: { type: 'string', enum: [...BLOOD_GROUPS] },
                district: { type: 'string', minLength: 2 },
                city: { type: 'string', minLength: 2 },
                address: { type: 'string', minLength: 3 },
              },
            },
            {
              name: 'Amina Rahman',
              email: 'amina@example.com',
              password: 'Password@123',
              phone: '+8801712345678',
              role: 'DONOR',
              bloodGroup: 'O_POSITIVE',
              district: 'Dhaka',
              city: 'Dhaka',
            }
          ),
        },
        responses: {
          '201': successResponse('Registration successful. Verification OTP sent to email.'),
          ...stdErrors(false),
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login with email and password',
        requestBody: {
          required: true,
          content: jsonContent(
            {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', minLength: 1 },
              },
            },
            { email: 'amina@example.com', password: 'Password@123' }
          ),
        },
        responses: {
          '200': successResponse('Login successful', {
            type: 'object',
            properties: {
              user: { $ref: '#/components/schemas/UserSummary' },
              accessToken: { type: 'string' },
            },
          }),
          ...stdErrors(true),
        },
      },
    },
    '/api/v1/auth/google': {
      get: {
        tags: ['Auth'],
        summary: 'Google OAuth configuration / initiation',
        responses: {
          '200': successResponse('Google OAuth metadata'),
          ...stdErrors(false),
        },
      },
      post: {
        tags: ['Auth'],
        summary: 'Authenticate with Google ID token credential',
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            required: ['credential'],
            properties: {
              credential: { type: 'string', minLength: 10, description: 'Google OAuth ID token' },
            },
          }),
        },
        responses: {
          '200': successResponse('Google login successful'),
          ...stdErrors(true),
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        description: 'Issues a new access token using the refreshToken cookie or request body.',
        requestBody: {
          required: false,
          content: jsonContent({
            type: 'object',
            properties: { refreshToken: { type: 'string' } },
          }),
        },
        responses: {
          '200': successResponse('Token refreshed successfully'),
          ...stdErrors(true),
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout current session',
        responses: {
          '200': successResponse('Logged out successfully'),
          ...stdErrors(false),
        },
      },
    },
    '/api/v1/auth/verify-email': {
      post: {
        tags: ['Auth'],
        summary: 'Verify email address using 6-digit OTP',
        requestBody: {
          required: true,
          content: jsonContent(
            {
              type: 'object',
              required: ['email', 'otp'],
              properties: {
                email: { type: 'string', format: 'email' },
                otp: { type: 'string', pattern: '^\\d{6}$' },
              },
            },
            { email: 'amina@example.com', otp: '123456' }
          ),
        },
        responses: {
          '200': successResponse('Email verified successfully'),
          ...stdErrors(false),
        },
      },
    },
    '/api/v1/auth/resend-verification-otp': {
      post: {
        tags: ['Auth'],
        summary: 'Resend email verification OTP',
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            required: ['email'],
            properties: { email: { type: 'string', format: 'email' } },
          }),
        },
        responses: {
          '200': successResponse('Verification OTP sent'),
          ...stdErrors(false),
        },
      },
    },
    '/api/v1/auth/resend-verification': {
      post: {
        tags: ['Auth'],
        summary: 'Resend email verification OTP (alias)',
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            required: ['email'],
            properties: { email: { type: 'string', format: 'email' } },
          }),
        },
        responses: {
          '200': successResponse('Verification OTP sent'),
          ...stdErrors(false),
        },
      },
    },
    '/api/v1/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request password reset OTP',
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            required: ['email'],
            properties: { email: { type: 'string', format: 'email' } },
          }),
        },
        responses: {
          '200': successResponse('Password reset OTP sent if account exists'),
          ...stdErrors(false),
        },
      },
    },
    '/api/v1/auth/verify-reset-otp': {
      post: {
        tags: ['Auth'],
        summary: 'Verify password reset OTP and obtain reset token',
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            required: ['email', 'otp'],
            properties: {
              email: { type: 'string', format: 'email' },
              otp: { type: 'string', pattern: '^\\d{6}$' },
            },
          }),
        },
        responses: {
          '200': successResponse('OTP verified', {
            type: 'object',
            properties: { resetToken: { type: 'string' } },
          }),
          ...stdErrors(false),
        },
      },
    },
    '/api/v1/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Reset password using verified reset token',
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            required: ['email', 'resetToken', 'newPassword'],
            properties: {
              email: { type: 'string', format: 'email' },
              resetToken: { type: 'string' },
              newPassword: { type: 'string', minLength: 8 },
            },
          }),
        },
        responses: {
          '200': successResponse('Password reset successfully'),
          ...stdErrors(false),
        },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get authenticated user profile',
        security: authSecurity,
        responses: {
          '200': successResponse('Authenticated user retrieved', { $ref: '#/components/schemas/UserSummary' }),
          ...stdErrors(true),
        },
      },
    },
    '/api/v1/auth/logout-all': {
      post: {
        tags: ['Auth'],
        summary: 'Logout from all active sessions',
        security: authSecurity,
        responses: {
          '200': successResponse('All sessions revoked'),
          ...stdErrors(true),
        },
      },
    },
    '/api/v1/auth/sessions': {
      get: {
        tags: ['Auth'],
        summary: 'List active sessions for current user',
        security: authSecurity,
        responses: {
          '200': successResponse('Active sessions retrieved', { type: 'array', items: { type: 'object' } }),
          ...stdErrors(true),
        },
      },
    },
    '/api/v1/auth/sessions/{id}': {
      delete: {
        tags: ['Auth'],
        summary: 'Revoke a specific session',
        security: authSecurity,
        parameters: [pathParam('id', 'Session ID')],
        responses: {
          '200': successResponse('Session revoked'),
          ...stdErrors(true, false, true),
        },
      },
    },

    // =========================================================================
    // USERS
    // =========================================================================
    '/api/v1/users/me': {
      get: {
        tags: ['Users'],
        summary: 'Get my user profile',
        security: authSecurity,
        responses: {
          '200': successResponse('User profile retrieved', { $ref: '#/components/schemas/UserSummary' }),
          ...stdErrors(true),
        },
      },
      patch: {
        tags: ['Users'],
        summary: 'Update my user profile',
        security: authSecurity,
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            properties: {
              name: { type: 'string', minLength: 2, maxLength: 100 },
              phone: { type: 'string', pattern: '^\\+?[0-9]{10,15}$' },
              avatar: { type: 'string', nullable: true },
              bloodGroup: { type: 'string', enum: [...BLOOD_GROUPS] },
              dateOfBirth: { type: 'string', format: 'date' },
              gender: { type: 'string', maxLength: 20 },
              address: { type: 'string', minLength: 3 },
              city: { type: 'string', minLength: 2 },
              district: { type: 'string', minLength: 2 },
              isAvailable: { type: 'boolean' },
            },
          }),
        },
        responses: {
          '200': successResponse('Profile updated successfully'),
          ...stdErrors(true),
        },
      },
    },
    '/api/v1/users': {
      get: {
        tags: ['Users'],
        summary: 'List all users (Admin)',
        security: authSecurity,
        parameters: userQueryParams,
        responses: {
          '200': successResponse('Users retrieved', { type: 'array', items: { $ref: '#/components/schemas/UserSummary' } }, undefined, true),
          ...stdErrors(true, true),
        },
      },
    },
    '/api/v1/users/{userId}': {
      get: {
        tags: ['Users'],
        summary: 'Get user details by ID (Admin)',
        security: authSecurity,
        parameters: [pathParam('userId', 'User ID')],
        responses: {
          '200': successResponse('User retrieved', { $ref: '#/components/schemas/UserSummary' }),
          ...stdErrors(true, true, true),
        },
      },
    },
    '/api/v1/users/{userId}/status': {
      patch: {
        tags: ['Users'],
        summary: 'Update user status (Admin)',
        security: authSecurity,
        parameters: [pathParam('userId', 'User ID')],
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            required: ['status'],
            properties: {
              status: { type: 'string', enum: [...USER_STATUSES] },
              reason: { type: 'string', maxLength: 255 },
            },
          }),
        },
        responses: {
          '200': successResponse('User status updated'),
          ...stdErrors(true, true, true),
        },
      },
    },
    '/api/v1/users/{userId}/role': {
      patch: {
        tags: ['Users'],
        summary: 'Update user role (Admin)',
        security: authSecurity,
        parameters: [pathParam('userId', 'User ID')],
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            required: ['role'],
            properties: { role: { type: 'string', enum: [...USER_ROLES] } },
          }),
        },
        responses: {
          '200': successResponse('User role updated'),
          ...stdErrors(true, true, true),
        },
      },
    },

    // =========================================================================
    // DONORS
    // =========================================================================
    '/api/v1/donors/me': {
      get: {
        tags: ['Donors'],
        summary: 'Get my donor profile',
        security: authSecurity,
        responses: {
          '200': successResponse('Donor profile retrieved'),
          ...stdErrors(true, false, true),
        },
      },
      patch: {
        tags: ['Donors'],
        summary: 'Update my donor profile',
        security: authSecurity,
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            properties: {
              name: { type: 'string', minLength: 2, maxLength: 100 },
              phone: { type: 'string', pattern: '^\\+?[0-9]{10,15}$' },
              bloodGroup: { type: 'string', enum: [...BLOOD_GROUPS] },
              dateOfBirth: { type: 'string', format: 'date' },
              gender: { type: 'string', maxLength: 20 },
              district: { type: 'string', maxLength: 100 },
              city: { type: 'string', maxLength: 100 },
              area: { type: 'string', maxLength: 100 },
              address: { type: 'string', maxLength: 255 },
              latitude: { type: 'number', minimum: -90, maximum: 90 },
              longitude: { type: 'number', minimum: -180, maximum: 180 },
            },
          }),
        },
        responses: {
          '200': successResponse('Donor profile updated'),
          ...stdErrors(true),
        },
      },
    },
    '/api/v1/donors/me/availability': {
      patch: {
        tags: ['Donors'],
        summary: 'Toggle donor availability',
        security: authSecurity,
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            required: ['isAvailable'],
            properties: { isAvailable: { type: 'boolean' } },
          }),
        },
        responses: {
          '200': successResponse('Donor availability updated'),
          ...stdErrors(true),
        },
      },
    },
    '/api/v1/donors/me/eligibility': {
      get: {
        tags: ['Donors'],
        summary: 'Check my donation eligibility status',
        security: authSecurity,
        responses: {
          '200': successResponse('Eligibility status retrieved'),
          ...stdErrors(true),
        },
      },
    },
    '/api/v1/donors/search': {
      get: {
        tags: ['Donors'],
        summary: 'Advanced donor search (distance, compatibility, availability)',
        security: authSecurity,
        parameters: [
          queryParam('bloodGroup', { type: 'string', enum: [...BLOOD_GROUPS] }, 'Exact donor blood group'),
          queryParam('recipientBloodGroup', { type: 'string', enum: [...BLOOD_GROUPS] }, 'Recipient blood group for compatibility'),
          queryParam('district', { type: 'string' }, 'District'),
          queryParam('city', { type: 'string' }, 'City'),
          queryParam('area', { type: 'string' }, 'Area'),
          queryParam('search', { type: 'string' }, 'Keyword search'),
          queryParam('isAvailable', { type: 'boolean' }, 'Availability filter'),
          queryParam('isVerified', { type: 'boolean' }, 'Verified donor filter'),
          queryParam('eligibleOnly', { type: 'boolean' }, 'Only eligible donors'),
          queryParam('latitude', { type: 'number', minimum: -90, maximum: 90 }, 'Latitude (required with longitude)'),
          queryParam('longitude', { type: 'number', minimum: -180, maximum: 180 }, 'Longitude (required with latitude)'),
          queryParam('radius', { type: 'number', minimum: 0.1, maximum: 500 }, 'Radius in km'),
          queryParam(
            'sortBy',
            {
              type: 'string',
              enum: ['distance', 'createdAt', 'bloodGroup', 'district', 'city', 'area', 'lastDonationDate', 'isVerified'],
              default: 'createdAt',
            },
            'Sort field'
          ),
          queryParam('sortOrder', { type: 'string', enum: ['asc', 'desc'], default: 'desc' }, 'Sort direction'),
          ...paginationParams,
        ],
        responses: {
          '200': successResponse('Donors search results', { type: 'array', items: { type: 'object' } }, undefined, true),
          ...stdErrors(true),
        },
      },
    },
    '/api/v1/donors/compatible': {
      get: {
        tags: ['Donors'],
        summary: 'Find compatible donors for a recipient blood group',
        security: authSecurity,
        parameters: [
          queryParam('recipientBloodGroup', { type: 'string', enum: [...BLOOD_GROUPS] }, 'Recipient blood group', true),
          queryParam('district', { type: 'string' }, 'District'),
          queryParam('city', { type: 'string' }, 'City'),
          queryParam('area', { type: 'string' }, 'Area'),
          queryParam('isAvailable', { type: 'boolean' }, 'Availability filter'),
          queryParam('eligibleOnly', { type: 'boolean' }, 'Only eligible donors'),
          ...paginationParams,
        ],
        responses: {
          '200': successResponse('Compatible donors retrieved', { type: 'array', items: { type: 'object' } }, undefined, true),
          ...stdErrors(true),
        },
      },
    },
    '/api/v1/donors/nearby': {
      get: {
        tags: ['Donors'],
        summary: 'Find nearby donors within radius',
        parameters: [
          queryParam('latitude', { type: 'number', minimum: -90, maximum: 90 }, 'Latitude', true),
          queryParam('longitude', { type: 'number', minimum: -180, maximum: 180 }, 'Longitude', true),
          queryParam('radius', { type: 'number', minimum: 0.1, maximum: 500, default: 10 }, 'Radius in km'),
          queryParam('bloodGroup', { type: 'string', enum: [...BLOOD_GROUPS] }, 'Blood group'),
          queryParam('isAvailable', { type: 'boolean' }, 'Availability filter'),
          queryParam('isVerified', { type: 'boolean' }, 'Verified filter'),
          queryParam('eligible', { type: 'boolean' }, 'Eligibility filter'),
          queryParam('limit', { type: 'integer', minimum: 1, maximum: 100, default: 10 }, 'Max results'),
        ],
        responses: {
          '200': successResponse('Nearby donors retrieved'),
          ...stdErrors(false),
        },
      },
    },
    '/api/v1/donors/{donorId}': {
      get: {
        tags: ['Donors'],
        summary: 'Get donor profile by ID',
        parameters: [pathParam('donorId', 'Donor UUID', 'uuid')],
        responses: {
          '200': successResponse('Donor retrieved'),
          ...stdErrors(false, false, true),
        },
      },
    },
    '/api/v1/donors/{donorId}/eligibility': {
      get: {
        tags: ['Donors'],
        summary: 'Get donor eligibility by ID',
        parameters: [pathParam('donorId', 'Donor UUID', 'uuid')],
        responses: {
          '200': successResponse('Donor eligibility retrieved'),
          ...stdErrors(false, false, true),
        },
      },
    },
    '/api/v1/donors': {
      get: {
        tags: ['Donors'],
        summary: 'List donors directory',
        parameters: donorQueryParams,
        responses: {
          '200': successResponse('Donors retrieved', { type: 'array', items: { type: 'object' } }, undefined, true),
          ...stdErrors(false),
        },
      },
    },

    // =========================================================================
    // BLOOD REQUESTS
    // =========================================================================
    '/api/v1/blood-requests': {
      post: {
        tags: ['Blood Requests'],
        summary: 'Create a blood donation request (Requester / Admin)',
        security: authSecurity,
        requestBody: {
          required: true,
          content: jsonContent(
            {
              type: 'object',
              required: ['patientName', 'bloodGroup', 'hospitalName', 'hospitalAddress', 'district', 'city', 'contactPhone'],
              properties: {
                patientName: { type: 'string', minLength: 2, maxLength: 100 },
                bloodGroup: { type: 'string', enum: [...BLOOD_GROUPS] },
                unitsNeeded: { type: 'integer', minimum: 1, maximum: 20 },
                unitsRequired: { type: 'integer', minimum: 1, maximum: 20 },
                hospitalName: { type: 'string', minLength: 2, maxLength: 150 },
                hospitalAddress: { type: 'string', minLength: 3, maxLength: 255 },
                district: { type: 'string', minLength: 2, maxLength: 100 },
                city: { type: 'string', minLength: 2, maxLength: 100 },
                area: { type: 'string', maxLength: 100 },
                latitude: { type: 'number', minimum: -90, maximum: 90 },
                longitude: { type: 'number', minimum: -180, maximum: 180 },
                contactName: { type: 'string', minLength: 2, maxLength: 100 },
                contactPerson: { type: 'string', minLength: 2, maxLength: 100 },
                contactPhone: { type: 'string', pattern: '^\\+?[0-9]{10,15}$' },
                neededAt: { type: 'string', format: 'date-time' },
                requiredAt: { type: 'string', format: 'date-time' },
                urgency: { type: 'string', enum: [...REQUEST_URGENCIES], default: 'NORMAL' },
                reason: { type: 'string', maxLength: 1000 },
                additionalNotes: { type: 'string', maxLength: 1000 },
                details: { type: 'string', maxLength: 1000 },
              },
            },
            {
              patientName: 'Karim Uddin',
              bloodGroup: 'O_NEGATIVE',
              unitsRequired: 2,
              hospitalName: 'Dhaka Medical College Hospital',
              hospitalAddress: 'Secretariat Rd, Dhaka 1000',
              district: 'Dhaka',
              city: 'Dhaka',
              area: 'Shahbag',
              contactPerson: 'Rahim Uddin',
              contactPhone: '+8801712345678',
              requiredAt: '2026-12-01T10:00:00.000Z',
              urgency: 'URGENT',
            }
          ),
        },
        responses: {
          '201': successResponse('Blood request created successfully', { $ref: '#/components/schemas/BloodRequest' }),
          ...stdErrors(true, true),
        },
      },
      get: {
        tags: ['Blood Requests'],
        summary: 'List blood donation requests',
        parameters: bloodRequestQueryParams,
        responses: {
          '200': successResponse('Blood requests retrieved', { type: 'array', items: { $ref: '#/components/schemas/BloodRequest' } }, undefined, true),
          ...stdErrors(false),
        },
      },
    },
    '/api/v1/blood-requests/me': {
      get: {
        tags: ['Blood Requests'],
        summary: 'List my blood donation requests',
        security: authSecurity,
        parameters: bloodRequestQueryParams,
        responses: {
          '200': successResponse('My blood requests retrieved', { type: 'array', items: { $ref: '#/components/schemas/BloodRequest' } }, undefined, true),
          ...stdErrors(true),
        },
      },
    },
    '/api/v1/blood-requests/{requestId}': {
      get: {
        tags: ['Blood Requests'],
        summary: 'Get blood request details by ID',
        parameters: [pathParam('requestId', 'Blood request UUID', 'uuid')],
        responses: {
          '200': successResponse('Blood request retrieved', { $ref: '#/components/schemas/BloodRequest' }),
          ...stdErrors(false, false, true),
        },
      },
      patch: {
        tags: ['Blood Requests'],
        summary: 'Update a blood request (Owner or Admin)',
        security: authSecurity,
        parameters: [pathParam('requestId', 'Blood request UUID', 'uuid')],
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            properties: {
              patientName: { type: 'string', minLength: 2, maxLength: 100 },
              bloodGroup: { type: 'string', enum: [...BLOOD_GROUPS] },
              unitsNeeded: { type: 'integer', minimum: 1, maximum: 20 },
              unitsRequired: { type: 'integer', minimum: 1, maximum: 20 },
              hospitalName: { type: 'string', minLength: 2, maxLength: 150 },
              hospitalAddress: { type: 'string', minLength: 3, maxLength: 255 },
              district: { type: 'string', minLength: 2, maxLength: 100 },
              city: { type: 'string', minLength: 2, maxLength: 100 },
              area: { type: 'string', maxLength: 100 },
              latitude: { type: 'number', minimum: -90, maximum: 90 },
              longitude: { type: 'number', minimum: -180, maximum: 180 },
              contactName: { type: 'string', minLength: 2, maxLength: 100 },
              contactPerson: { type: 'string', minLength: 2, maxLength: 100 },
              contactPhone: { type: 'string', pattern: '^\\+?[0-9]{10,15}$' },
              neededAt: { type: 'string', format: 'date-time' },
              requiredAt: { type: 'string', format: 'date-time' },
              urgency: { type: 'string', enum: [...REQUEST_URGENCIES] },
              reason: { type: 'string', maxLength: 1000 },
              additionalNotes: { type: 'string', maxLength: 1000 },
              details: { type: 'string', maxLength: 1000 },
            },
          }),
        },
        responses: {
          '200': successResponse('Blood request updated'),
          ...stdErrors(true, true, true),
        },
      },
    },
    '/api/v1/blood-requests/{requestId}/history': {
      get: {
        tags: ['Blood Requests'],
        summary: 'Get blood request lifecycle history (Owner or Admin)',
        security: authSecurity,
        parameters: [pathParam('requestId', 'Blood request UUID', 'uuid')],
        responses: {
          '200': successResponse('Blood request history retrieved'),
          ...stdErrors(true, true, true),
        },
      },
    },
    '/api/v1/blood-requests/{requestId}/cancel': {
      patch: {
        tags: ['Blood Requests'],
        summary: 'Cancel a blood request (Owner or Admin)',
        security: authSecurity,
        parameters: [pathParam('requestId', 'Blood request UUID', 'uuid')],
        requestBody: {
          required: false,
          content: jsonContent({
            type: 'object',
            properties: {
              cancellationReason: { type: 'string', maxLength: 500 },
              reason: { type: 'string', maxLength: 500 },
            },
          }),
        },
        responses: {
          '200': successResponse('Blood request cancelled'),
          ...stdErrors(true, true, true),
        },
      },
    },
    '/api/v1/blood-requests/{requestId}/approve': {
      patch: {
        tags: ['Blood Requests'],
        summary: 'Approve a blood request (Admin)',
        security: authSecurity,
        parameters: [pathParam('requestId', 'Blood request UUID', 'uuid')],
        responses: {
          '200': successResponse('Blood request approved'),
          ...stdErrors(true, true, true),
        },
      },
    },
    '/api/v1/blood-requests/{requestId}/reject': {
      patch: {
        tags: ['Blood Requests'],
        summary: 'Reject a blood request (Admin)',
        security: authSecurity,
        parameters: [pathParam('requestId', 'Blood request UUID', 'uuid')],
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            properties: {
              rejectionReason: { type: 'string', minLength: 3, maxLength: 500 },
              reason: { type: 'string', minLength: 3, maxLength: 500 },
            },
          }),
        },
        responses: {
          '200': successResponse('Blood request rejected'),
          ...stdErrors(true, true, true),
        },
      },
    },
    '/api/v1/blood-requests/{requestId}/urgency': {
      patch: {
        tags: ['Blood Requests'],
        summary: 'Update blood request urgency (Admin)',
        security: authSecurity,
        parameters: [pathParam('requestId', 'Blood request UUID', 'uuid')],
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            required: ['urgency', 'reason'],
            properties: {
              urgency: { type: 'string', enum: [...REQUEST_URGENCIES] },
              reason: { type: 'string', minLength: 3, maxLength: 500 },
            },
          }),
        },
        responses: {
          '200': successResponse('Blood request urgency updated'),
          ...stdErrors(true, true, true),
        },
      },
    },
    '/api/v1/blood-requests/{requestId}/expire': {
      patch: {
        tags: ['Blood Requests'],
        summary: 'Expire an overdue blood request (Admin)',
        security: authSecurity,
        parameters: [pathParam('requestId', 'Blood request UUID', 'uuid')],
        requestBody: {
          required: false,
          content: jsonContent({
            type: 'object',
            properties: { reason: { type: 'string', maxLength: 500 } },
          }),
        },
        responses: {
          '200': successResponse('Blood request expired'),
          ...stdErrors(true, true, true),
        },
      },
    },

    // =========================================================================
    // MATCHING
    // =========================================================================
    '/api/v1/matching/compatibility': {
      get: {
        tags: ['Matching'],
        summary: 'Check ABO/Rh blood group compatibility',
        parameters: [
          queryParam('donorBloodGroup', { type: 'string', enum: [...BLOOD_GROUPS] }, 'Donor blood group'),
          queryParam('recipientBloodGroup', { type: 'string', enum: [...BLOOD_GROUPS] }, 'Recipient blood group'),
        ],
        responses: {
          '200': successResponse('Compatibility information retrieved'),
          ...stdErrors(false),
        },
      },
    },
    '/api/v1/matching/requests/{requestId}/donors': {
      get: {
        tags: ['Matching'],
        summary: 'Find compatible & eligible donors for a blood request',
        parameters: [pathParam('requestId', 'Blood request UUID', 'uuid')],
        responses: {
          '200': successResponse('Matched donors retrieved'),
          ...stdErrors(false, false, true),
        },
      },
    },
    '/api/v1/matching/find-donors': {
      get: {
        tags: ['Matching'],
        summary: 'Search compatible & eligible donors via query filters',
        parameters: [
          queryParam('requestId', { type: 'string', format: 'uuid' }, 'Blood request UUID'),
          queryParam('bloodGroup', { type: 'string', enum: [...BLOOD_GROUPS] }, 'Target blood group'),
          queryParam('district', { type: 'string' }, 'District'),
          queryParam('city', { type: 'string' }, 'City'),
          queryParam('latitude', { type: 'number', minimum: -90, maximum: 90 }, 'Latitude'),
          queryParam('longitude', { type: 'number', minimum: -180, maximum: 180 }, 'Longitude'),
          queryParam('radiusKm', { type: 'number', minimum: 0.1, maximum: 500, default: 50 }, 'Search radius in km'),
          queryParam('limit', { type: 'integer', minimum: 1, maximum: 50, default: 10 }, 'Max donors'),
        ],
        responses: {
          '200': successResponse('Compatible donors retrieved'),
          ...stdErrors(false),
        },
      },
    },

    // =========================================================================
    // DONATIONS
    // =========================================================================
    '/api/v1/donations/me': {
      get: {
        tags: ['Donations'],
        summary: 'Get my donation history & 90-day cooldown status',
        security: authSecurity,
        parameters: donationQueryParams,
        responses: {
          '200': successResponse('Donation history retrieved', { type: 'object' }, undefined, true),
          ...stdErrors(true, true),
        },
      },
    },
    '/api/v1/donations': {
      post: {
        tags: ['Donations'],
        summary: 'Create a donation record (Requester / Admin)',
        security: authSecurity,
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            required: ['donorId', 'bloodRequestId'],
            properties: {
              donorId: { type: 'string' },
              bloodRequestId: { type: 'string' },
              assignmentId: { type: 'string' },
              unitsDonated: { type: 'integer', minimum: 1, maximum: 10, default: 1 },
              donationDate: { type: 'string', format: 'date-time' },
              hospitalName: { type: 'string', maxLength: 255 },
              hospitalAddress: { type: 'string', maxLength: 500 },
              notes: { type: 'string', maxLength: 1000 },
            },
          }),
        },
        responses: {
          '201': successResponse('Donation record created'),
          ...stdErrors(true, true),
        },
      },
      get: {
        tags: ['Donations'],
        summary: 'List donations (scoped by role)',
        security: authSecurity,
        parameters: donationQueryParams,
        responses: {
          '200': successResponse('Donations retrieved', { type: 'array', items: { type: 'object' } }, undefined, true),
          ...stdErrors(true, true),
        },
      },
    },
    '/api/v1/donations/{donationId}': {
      get: {
        tags: ['Donations'],
        summary: 'Get donation details by ID',
        security: authSecurity,
        parameters: [pathParam('donationId', 'Donation ID')],
        responses: {
          '200': successResponse('Donation retrieved'),
          ...stdErrors(true, true, true),
        },
      },
    },
    '/api/v1/donations/{donationId}/verify': {
      patch: {
        tags: ['Donations'],
        summary: 'Verify and complete a donation (Admin)',
        security: authSecurity,
        parameters: [pathParam('donationId', 'Donation ID')],
        requestBody: {
          required: false,
          content: jsonContent({
            type: 'object',
            properties: { notes: { type: 'string', maxLength: 1000 } },
          }),
        },
        responses: {
          '200': successResponse('Donation verified and completed'),
          ...stdErrors(true, true, true),
        },
      },
    },
    '/api/v1/donations/{donationId}/reject': {
      patch: {
        tags: ['Donations'],
        summary: 'Reject a donation record (Admin)',
        security: authSecurity,
        parameters: [pathParam('donationId', 'Donation ID')],
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            required: ['reason'],
            properties: { reason: { type: 'string', minLength: 3, maxLength: 500 } },
          }),
        },
        responses: {
          '200': successResponse('Donation rejected'),
          ...stdErrors(true, true, true),
        },
      },
    },

    // =========================================================================
    // PAYMENTS & REFUNDS
    // =========================================================================
    '/api/v1/payments/sslcommerz/success': {
      post: {
        tags: ['Payments'],
        summary: 'SSLCommerz success callback',
        responses: { '200': successResponse('SSLCommerz success processed') },
      },
    },
    '/api/v1/payments/sslcommerz/fail': {
      post: {
        tags: ['Payments'],
        summary: 'SSLCommerz failure callback',
        responses: { '200': successResponse('SSLCommerz failure processed') },
      },
    },
    '/api/v1/payments/sslcommerz/cancel': {
      post: {
        tags: ['Payments'],
        summary: 'SSLCommerz cancellation callback',
        responses: { '200': successResponse('SSLCommerz cancel processed') },
      },
    },
    '/api/v1/payments/sslcommerz/ipn': {
      post: {
        tags: ['Payments'],
        summary: 'SSLCommerz Instant Payment Notification (IPN)',
        responses: { '200': successResponse('SSLCommerz IPN processed') },
      },
    },
    '/api/v1/payments/stripe/webhook': {
      post: {
        tags: ['Payments'],
        summary: 'Stripe webhook endpoint',
        responses: { '200': successResponse('Stripe webhook processed') },
      },
    },
    '/api/v1/payments/initiate': {
      post: {
        tags: ['Payments'],
        summary: 'Initiate a payment via SSLCommerz or Stripe',
        security: authSecurity,
        requestBody: {
          required: true,
          content: jsonContent(
            {
              type: 'object',
              required: ['provider', 'amount'],
              properties: {
                provider: { type: 'string', enum: [...PAYMENT_PROVIDERS] },
                paymentPurpose: { type: 'string', enum: [...PAYMENT_PURPOSES], default: 'PLATFORM_SUPPORT' },
                amount: { type: 'number', minimum: 1 },
                currency: { type: 'string', minLength: 3, maxLength: 3 },
                description: { type: 'string', maxLength: 255 },
                bloodRequestId: { type: 'string' },
                idempotencyKey: { type: 'string', maxLength: 100 },
              },
            },
            {
              provider: 'SSLCOMMERZ',
              paymentPurpose: 'PLATFORM_SUPPORT',
              amount: 500,
              currency: 'BDT',
              description: 'Support PulseBridge operations',
            }
          ),
        },
        responses: {
          '201': successResponse('Payment initiated'),
          ...stdErrors(true),
        },
      },
    },
    '/api/v1/payments/me': {
      get: {
        tags: ['Payments'],
        summary: 'Get my payment history',
        security: authSecurity,
        parameters: paymentQueryParams,
        responses: {
          '200': successResponse('My payments retrieved', { type: 'array', items: { type: 'object' } }, undefined, true),
          ...stdErrors(true),
        },
      },
    },
    '/api/v1/payments/statistics': {
      get: {
        tags: ['Payments'],
        summary: 'Get payment statistics (Admin)',
        security: authSecurity,
        responses: {
          '200': successResponse('Payment statistics retrieved'),
          ...stdErrors(true, true),
        },
      },
    },
    '/api/v1/payments': {
      get: {
        tags: ['Payments'],
        summary: 'List all payments (Admin)',
        security: authSecurity,
        parameters: paymentQueryParams,
        responses: {
          '200': successResponse('Payments retrieved', { type: 'array', items: { type: 'object' } }, undefined, true),
          ...stdErrors(true, true),
        },
      },
    },
    '/api/v1/payments/{paymentId}': {
      get: {
        tags: ['Payments'],
        summary: 'Get payment details by ID',
        security: authSecurity,
        parameters: [pathParam('paymentId', 'Payment ID')],
        responses: {
          '200': successResponse('Payment retrieved'),
          ...stdErrors(true, true, true),
        },
      },
    },
    '/api/v1/payments/{paymentId}/verify': {
      get: {
        tags: ['Payments'],
        summary: 'Verify payment status with gateway',
        security: authSecurity,
        parameters: [pathParam('paymentId', 'Payment ID')],
        responses: {
          '200': successResponse('Payment verification result'),
          ...stdErrors(true, true, true),
        },
      },
    },
    '/api/v1/payments/{paymentId}/refunds': {
      get: {
        tags: ['Payments'],
        summary: 'List refunds for a payment',
        security: authSecurity,
        parameters: [pathParam('paymentId', 'Payment ID')],
        responses: {
          '200': successResponse('Payment refunds retrieved'),
          ...stdErrors(true, true, true),
        },
      },
    },
    '/api/v1/payments/{paymentId}/refund': {
      post: {
        tags: ['Payments'],
        summary: 'Initiate a refund for a payment (Admin)',
        security: authSecurity,
        parameters: [pathParam('paymentId', 'Payment ID')],
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            required: ['reason'],
            properties: {
              amount: { type: 'number', minimum: 0.01 },
              reason: { type: 'string', minLength: 3, maxLength: 500 },
              idempotencyKey: { type: 'string', maxLength: 100 },
            },
          }),
        },
        responses: {
          '200': successResponse('Refund initiated'),
          ...stdErrors(true, true, true),
        },
      },
    },
    '/api/v1/refunds/{refundId}': {
      get: {
        tags: ['Payments'],
        summary: 'Get single refund details (Owner or Admin)',
        security: authSecurity,
        parameters: [pathParam('refundId', 'Refund ID')],
        responses: {
          '200': successResponse('Refund details retrieved'),
          ...stdErrors(true, true, true),
        },
      },
    },

    // =========================================================================
    // ADMIN
    // =========================================================================
    '/api/v1/admin/dashboard': {
      get: {
        tags: ['Admin'],
        summary: 'Get admin dashboard metrics',
        security: authSecurity,
        responses: {
          '200': successResponse('Dashboard metrics retrieved'),
          ...stdErrors(true, true),
        },
      },
    },
    '/api/v1/admin/dashboard/overview': {
      get: {
        tags: ['Admin'],
        summary: 'Get admin dashboard overview',
        security: authSecurity,
        parameters: [queryParam('refresh', { type: 'boolean', default: false }, 'Bypass cache')],
        responses: {
          '200': successResponse('Dashboard overview retrieved'),
          ...stdErrors(true, true),
        },
      },
    },
    '/api/v1/admin/dashboard/recent-activities': {
      get: {
        tags: ['Admin'],
        summary: 'Get recent platform activities',
        security: authSecurity,
        parameters: [
          queryParam('page', { type: 'integer', minimum: 1, default: 1 }, 'Page number'),
          queryParam('limit', { type: 'integer', minimum: 1, maximum: 100, default: 20 }, 'Items per page'),
          queryParam('type', { type: 'string' }, 'Activity type filter'),
          queryParam('startDate', { type: 'string', format: 'date-time' }, 'Start date'),
          queryParam('endDate', { type: 'string', format: 'date-time' }, 'End date'),
        ],
        responses: {
          '200': successResponse('Recent activities retrieved', { type: 'array', items: { type: 'object' } }, undefined, true),
          ...stdErrors(true, true),
        },
      },
    },
    '/api/v1/admin/analytics/users': {
      get: {
        tags: ['Admin'],
        summary: 'User analytics',
        security: authSecurity,
        parameters: analyticsQueryParams,
        responses: { '200': successResponse('User analytics retrieved'), ...stdErrors(true, true) },
      },
    },
    '/api/v1/admin/analytics/donors': {
      get: {
        tags: ['Admin'],
        summary: 'Donor analytics',
        security: authSecurity,
        parameters: analyticsQueryParams,
        responses: { '200': successResponse('Donor analytics retrieved'), ...stdErrors(true, true) },
      },
    },
    '/api/v1/admin/analytics/blood-requests': {
      get: {
        tags: ['Admin'],
        summary: 'Blood request analytics',
        security: authSecurity,
        parameters: analyticsQueryParams,
        responses: { '200': successResponse('Blood request analytics retrieved'), ...stdErrors(true, true) },
      },
    },
    '/api/v1/admin/analytics/donations': {
      get: {
        tags: ['Admin'],
        summary: 'Donation analytics',
        security: authSecurity,
        parameters: analyticsQueryParams,
        responses: { '200': successResponse('Donation analytics retrieved'), ...stdErrors(true, true) },
      },
    },
    '/api/v1/admin/analytics/assignments': {
      get: {
        tags: ['Admin'],
        summary: 'Donor assignment analytics',
        security: authSecurity,
        parameters: analyticsQueryParams,
        responses: { '200': successResponse('Assignment analytics retrieved'), ...stdErrors(true, true) },
      },
    },
    '/api/v1/admin/analytics/emergency': {
      get: {
        tags: ['Admin'],
        summary: 'Emergency request analytics',
        security: authSecurity,
        parameters: analyticsQueryParams,
        responses: { '200': successResponse('Emergency analytics retrieved'), ...stdErrors(true, true) },
      },
    },
    '/api/v1/admin/analytics/payments': {
      get: {
        tags: ['Admin'],
        summary: 'Payment analytics',
        security: authSecurity,
        parameters: analyticsQueryParams,
        responses: { '200': successResponse('Payment analytics retrieved'), ...stdErrors(true, true) },
      },
    },
    '/api/v1/admin/analytics/notifications': {
      get: {
        tags: ['Admin'],
        summary: 'Notification analytics',
        security: authSecurity,
        parameters: analyticsQueryParams,
        responses: { '200': successResponse('Notification analytics retrieved'), ...stdErrors(true, true) },
      },
    },
    '/api/v1/admin/analytics/growth': {
      get: {
        tags: ['Admin'],
        summary: 'Platform growth analytics',
        security: authSecurity,
        parameters: analyticsQueryParams,
        responses: { '200': successResponse('Growth analytics retrieved'), ...stdErrors(true, true) },
      },
    },
    '/api/v1/admin/audit-logs': {
      get: {
        tags: ['Admin'],
        summary: 'List audit logs',
        security: authSecurity,
        parameters: [
          ...paginationParams,
          queryParam('action', { type: 'string' }, 'Filter by audit action'),
          queryParam('entity', { type: 'string' }, 'Filter by entity type'),
          queryParam('actorId', { type: 'string' }, 'Filter by actor user ID'),
        ],
        responses: {
          '200': successResponse('Audit logs retrieved', { type: 'array', items: { type: 'object' } }, undefined, true),
          ...stdErrors(true, true),
        },
      },
    },
    '/api/v1/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'Admin: list users',
        security: authSecurity,
        parameters: userQueryParams,
        responses: { '200': successResponse('Users retrieved', undefined, undefined, true), ...stdErrors(true, true) },
      },
    },
    '/api/v1/admin/users/{userId}': {
      get: {
        tags: ['Admin'],
        summary: 'Admin: get user by ID',
        security: authSecurity,
        parameters: [pathParam('userId', 'User ID')],
        responses: { '200': successResponse('User retrieved'), ...stdErrors(true, true, true) },
      },
    },
    '/api/v1/admin/users/{userId}/status': {
      patch: {
        tags: ['Admin'],
        summary: 'Admin: update user status',
        security: authSecurity,
        parameters: [pathParam('userId', 'User ID')],
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            required: ['status'],
            properties: {
              status: { type: 'string', enum: [...USER_STATUSES] },
              reason: { type: 'string', maxLength: 255 },
            },
          }),
        },
        responses: { '200': successResponse('User status updated'), ...stdErrors(true, true, true) },
      },
    },
    '/api/v1/admin/users/{userId}/role': {
      patch: {
        tags: ['Admin'],
        summary: 'Admin: update user role',
        security: authSecurity,
        parameters: [pathParam('userId', 'User ID')],
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            required: ['role'],
            properties: { role: { type: 'string', enum: [...USER_ROLES] } },
          }),
        },
        responses: { '200': successResponse('User role updated'), ...stdErrors(true, true, true) },
      },
    },
    '/api/v1/admin/donors': {
      get: {
        tags: ['Admin'],
        summary: 'Admin: list donors',
        security: authSecurity,
        parameters: donorQueryParams,
        responses: { '200': successResponse('Donors retrieved', undefined, undefined, true), ...stdErrors(true, true) },
      },
    },
    '/api/v1/admin/donors/{donorId}': {
      get: {
        tags: ['Admin'],
        summary: 'Admin: get donor by ID',
        security: authSecurity,
        parameters: [pathParam('donorId', 'Donor UUID', 'uuid')],
        responses: { '200': successResponse('Donor retrieved'), ...stdErrors(true, true, true) },
      },
    },
    '/api/v1/admin/donors/{donorId}/verification': {
      patch: {
        tags: ['Admin'],
        summary: 'Admin: verify or unverify a donor',
        security: authSecurity,
        parameters: [pathParam('donorId', 'Donor UUID', 'uuid')],
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            required: ['isVerified'],
            properties: { isVerified: { type: 'boolean' } },
          }),
        },
        responses: { '200': successResponse('Donor verification updated'), ...stdErrors(true, true, true) },
      },
    },
    '/api/v1/admin/donors/{donorId}/restrictions': {
      patch: {
        tags: ['Admin'],
        summary: 'Admin: set medical restriction on a donor',
        security: authSecurity,
        parameters: [pathParam('donorId', 'Donor UUID', 'uuid')],
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            required: ['hasMedicalRestriction'],
            properties: {
              hasMedicalRestriction: { type: 'boolean' },
              medicalRestrictionReason: { type: 'string', maxLength: 500 },
            },
          }),
        },
        responses: { '200': successResponse('Donor medical restriction updated'), ...stdErrors(true, true, true) },
      },
    },
    '/api/v1/admin/donors/{donorId}/eligibility': {
      get: {
        tags: ['Admin'],
        summary: 'Admin: get donor eligibility details',
        security: authSecurity,
        parameters: [pathParam('donorId', 'Donor UUID', 'uuid')],
        responses: { '200': successResponse('Donor eligibility retrieved'), ...stdErrors(true, true, true) },
      },
    },
    '/api/v1/admin/donors/{donorId}/donation-history': {
      get: {
        tags: ['Admin'],
        summary: 'Admin: get donor donation history',
        security: authSecurity,
        parameters: [pathParam('donorId', 'Donor UUID', 'uuid'), ...donationQueryParams],
        responses: { '200': successResponse('Donor donation history retrieved', undefined, undefined, true), ...stdErrors(true, true, true) },
      },
    },
    '/api/v1/admin/donations': {
      get: {
        tags: ['Admin'],
        summary: 'Admin: list donations',
        security: authSecurity,
        parameters: donationQueryParams,
        responses: { '200': successResponse('Donations retrieved', undefined, undefined, true), ...stdErrors(true, true) },
      },
    },
    '/api/v1/admin/donations/{donationId}': {
      get: {
        tags: ['Admin'],
        summary: 'Admin: get donation by ID',
        security: authSecurity,
        parameters: [pathParam('donationId', 'Donation ID')],
        responses: { '200': successResponse('Donation retrieved'), ...stdErrors(true, true, true) },
      },
    },
    '/api/v1/admin/blood-requests': {
      get: {
        tags: ['Admin'],
        summary: 'Admin: list all blood requests',
        security: authSecurity,
        parameters: adminBloodRequestQueryParams,
        responses: { '200': successResponse('Blood requests retrieved', undefined, undefined, true), ...stdErrors(true, true) },
      },
    },
    '/api/v1/admin/blood-requests/{requestId}': {
      get: {
        tags: ['Admin'],
        summary: 'Admin: get blood request detail',
        security: authSecurity,
        parameters: [pathParam('requestId', 'Blood request UUID', 'uuid')],
        responses: { '200': successResponse('Blood request retrieved'), ...stdErrors(true, true, true) },
      },
    },
    '/api/v1/admin/blood-requests/{requestId}/approve': {
      patch: {
        tags: ['Admin'],
        summary: 'Admin: approve blood request',
        security: authSecurity,
        parameters: [pathParam('requestId', 'Blood request UUID', 'uuid')],
        responses: { '200': successResponse('Blood request approved'), ...stdErrors(true, true, true) },
      },
    },
    '/api/v1/admin/blood-requests/{requestId}/reject': {
      patch: {
        tags: ['Admin'],
        summary: 'Admin: reject blood request',
        security: authSecurity,
        parameters: [pathParam('requestId', 'Blood request UUID', 'uuid')],
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            properties: {
              rejectionReason: { type: 'string', minLength: 3, maxLength: 500 },
              reason: { type: 'string', minLength: 3, maxLength: 500 },
            },
          }),
        },
        responses: { '200': successResponse('Blood request rejected'), ...stdErrors(true, true, true) },
      },
    },
    '/api/v1/admin/blood-requests/{requestId}/urgency': {
      patch: {
        tags: ['Admin'],
        summary: 'Admin: update blood request urgency',
        security: authSecurity,
        parameters: [pathParam('requestId', 'Blood request UUID', 'uuid')],
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            required: ['urgency', 'reason'],
            properties: {
              urgency: { type: 'string', enum: [...REQUEST_URGENCIES] },
              reason: { type: 'string', minLength: 3, maxLength: 500 },
            },
          }),
        },
        responses: { '200': successResponse('Blood request urgency updated'), ...stdErrors(true, true, true) },
      },
    },
    '/api/v1/admin/blood-requests/{requestId}/expire': {
      patch: {
        tags: ['Admin'],
        summary: 'Admin: expire blood request',
        security: authSecurity,
        parameters: [pathParam('requestId', 'Blood request UUID', 'uuid')],
        requestBody: {
          required: false,
          content: jsonContent({
            type: 'object',
            properties: { reason: { type: 'string', maxLength: 500 } },
          }),
        },
        responses: { '200': successResponse('Blood request expired'), ...stdErrors(true, true, true) },
      },
    },
    '/api/v1/admin/payments/statistics': {
      get: {
        tags: ['Admin'],
        summary: 'Admin: payment statistics',
        security: authSecurity,
        responses: { '200': successResponse('Payment statistics retrieved'), ...stdErrors(true, true) },
      },
    },
    '/api/v1/admin/payments': {
      get: {
        tags: ['Admin'],
        summary: 'Admin: list payments',
        security: authSecurity,
        parameters: paymentQueryParams,
        responses: { '200': successResponse('Payments retrieved', undefined, undefined, true), ...stdErrors(true, true) },
      },
    },
    '/api/v1/admin/payments/{paymentId}': {
      get: {
        tags: ['Admin'],
        summary: 'Admin: get payment by ID',
        security: authSecurity,
        parameters: [pathParam('paymentId', 'Payment ID')],
        responses: { '200': successResponse('Payment retrieved'), ...stdErrors(true, true, true) },
      },
    },
    '/api/v1/admin/payments/{paymentId}/refunds': {
      get: {
        tags: ['Admin'],
        summary: 'Admin: list refunds for a payment',
        security: authSecurity,
        parameters: [pathParam('paymentId', 'Payment ID')],
        responses: { '200': successResponse('Payment refunds retrieved'), ...stdErrors(true, true, true) },
      },
    },
    '/api/v1/admin/payments/{paymentId}/refund': {
      post: {
        tags: ['Admin'],
        summary: 'Admin: initiate payment refund',
        security: authSecurity,
        parameters: [pathParam('paymentId', 'Payment ID')],
        requestBody: {
          required: true,
          content: jsonContent({
            type: 'object',
            required: ['reason'],
            properties: {
              amount: { type: 'number', minimum: 0.01 },
              reason: { type: 'string', minLength: 3, maxLength: 500 },
              idempotencyKey: { type: 'string', maxLength: 100 },
            },
          }),
        },
        responses: { '200': successResponse('Refund initiated'), ...stdErrors(true, true, true) },
      },
    },
    '/api/v1/admin/refunds': {
      get: {
        tags: ['Admin'],
        summary: 'Admin: list all refunds',
        security: authSecurity,
        parameters: refundQueryParams,
        responses: { '200': successResponse('Refunds retrieved', undefined, undefined, true), ...stdErrors(true, true) },
      },
    },
    '/api/v1/admin/refunds/{refundId}': {
      get: {
        tags: ['Admin'],
        summary: 'Admin: get refund by ID',
        security: authSecurity,
        parameters: [pathParam('refundId', 'Refund ID')],
        responses: { '200': successResponse('Refund retrieved'), ...stdErrors(true, true, true) },
      },
    },
    '/api/v1/admin/refunds/{refundId}/retry': {
      post: {
        tags: ['Admin'],
        summary: 'Admin: retry a failed refund',
        security: authSecurity,
        parameters: [pathParam('refundId', 'Refund ID')],
        responses: { '200': successResponse('Refund retry initiated'), ...stdErrors(true, true, true) },
      },
    },
  },
};
