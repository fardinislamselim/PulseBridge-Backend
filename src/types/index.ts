export interface ServiceHealthStatus {
  database: 'connected' | 'disconnected';
  redis: 'connected' | 'disconnected';
}

export interface HealthCheckData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  application: string;
  services: ServiceHealthStatus;
}
