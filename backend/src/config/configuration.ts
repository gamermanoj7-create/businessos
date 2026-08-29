export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  openai: { apiKey?: string; model: string };
  jwt: { accessSecret: string; refreshSecret: string; accessExpiresIn: string; refreshExpiresIn: string };
}
function requireEnv(key: string): string { const value=process.env[key]; if(!value?.trim()) throw new Error(`Missing required environment variable: ${key}`); return value; }
export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000',10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: requireEnv('DATABASE_URL'),
  openai: { apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL ?? 'gpt-5' },
  jwt: { accessSecret:requireEnv('JWT_ACCESS_SECRET'), refreshSecret:requireEnv('JWT_REFRESH_SECRET'), accessExpiresIn:process.env.JWT_ACCESS_EXPIRES_IN??'15m', refreshExpiresIn:process.env.JWT_REFRESH_EXPIRES_IN??'30d' },
});
