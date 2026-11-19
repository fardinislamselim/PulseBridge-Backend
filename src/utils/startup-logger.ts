import chalk from 'chalk';
import { env } from '../config/env.js';

export interface StartupLogOptions {
  port: number;
  dbConnected: boolean;
  redisConnected: boolean;
}

export const printStartupBanner = ({
  port,
  dbConnected,
  redisConnected,
}: StartupLogOptions): void => {
  const isDev = env.NODE_ENV === 'development';
  const envLabel = isDev
    ? chalk.yellow('Development')
    : env.NODE_ENV === 'production'
      ? chalk.green('Production')
      : chalk.magenta(env.NODE_ENV);

  const serverUrl = `http://localhost:${port}`;
  const baseUrl = `http://localhost:${port}${env.API_PREFIX}`;
  const healthUrl = `${baseUrl}/health`;
  const swaggerUrl = `http://localhost:${port}/api-docs`;
  const openApiYamlUrl = `http://localhost:${port}/api-docs.yaml`;
  const postmanDownloadUrl = `http://localhost:${port}/api-docs/postman-collection`;
  const postmanFilePath = `./postman/PulseBridge.postman_collection.json`;

  const dbStatus = dbConnected ? chalk.green('Connected') : chalk.red('Disconnected');
  const redisStatus = redisConnected ? chalk.green('Connected') : chalk.yellow('Disconnected');

  const check = chalk.green('✔');

  const banner = chalk.cyan.bold(`
╔══════════════════════════════════════════════════════╗
║               🩸 PULSEBRIDGE API                     ║
║          Blood Donation & Emergency API              ║
╚══════════════════════════════════════════════════════╝
`);

  console.log(banner);
  console.log(`  ${check} ${chalk.white.bold('Server URL       :')} ${chalk.blue.underline(serverUrl)}`);
  console.log(`  ${check} ${chalk.white.bold('Environment      :')} ${envLabel}`);
  console.log(`  ${check} ${chalk.white.bold('Port             :')} ${chalk.cyan(port.toString())}`);
  console.log(`  ${check} ${chalk.white.bold('API Base URL     :')} ${chalk.blue.underline(baseUrl)}`);
  console.log(`  ${check} ${chalk.white.bold('Health Endpoint  :')} ${chalk.blue.underline(healthUrl)}`);
  console.log(`  ${check} ${chalk.white.bold('Swagger UI URL   :')} ${chalk.blue.underline(swaggerUrl)}`);
  console.log(`  ${check} ${chalk.white.bold('Raw OpenAPI Spec :')} ${chalk.blue.underline(openApiYamlUrl)}`);
  console.log(`  ${check} ${chalk.white.bold('Postman File     :')} ${chalk.yellow(postmanFilePath)}`);
  console.log(`  ${check} ${chalk.white.bold('Postman Download :')} ${chalk.blue.underline(postmanDownloadUrl)}`);
  console.log(`  ${check} ${chalk.white.bold('Database         :')} ${dbStatus}`);
  console.log(`  ${check} ${chalk.white.bold('Redis            :')} ${redisStatus}`);
  console.log('');
  console.log(chalk.green.bold('  🚀 PulseBridge API is ready!\n'));
};
