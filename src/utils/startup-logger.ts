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

  const baseUrl = `http://localhost:${port}${env.API_PREFIX}`;
  const swaggerUrl = `http://localhost:${port}/api-docs`;
  const openApiJsonUrl = `http://localhost:${port}/api-docs.json`;
  const openApiYamlUrl = `http://localhost:${port}/api-docs.yaml`;
  const postmanPath = `./postman/PulseBridge.postman_collection.json`;

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
  console.log(`  ${check} ${chalk.white.bold('Server Status    :')} ${chalk.green('Running')}`);
  console.log(`  ${check} ${chalk.white.bold('Environment      :')} ${envLabel}`);
  console.log(
    `  ${check} ${chalk.white.bold('Port             :')} ${chalk.cyan(port.toString())}`
  );
  console.log(
    `  ${check} ${chalk.white.bold('API Base URL     :')} ${chalk.blue.underline(baseUrl)}`
  );
  console.log(
    `  ${check} ${chalk.white.bold('Swagger UI       :')} ${chalk.blue.underline(swaggerUrl)}`
  );
  console.log(`  ${check} ${chalk.white.bold('Database         :')} ${dbStatus}`);
  console.log(`  ${check} ${chalk.white.bold('Redis            :')} ${redisStatus}`);
  console.log('');
  console.log(chalk.green.bold('  🚀 PulseBridge API is ready!\n'));
};
