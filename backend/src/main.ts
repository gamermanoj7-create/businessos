import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  const config = app.get(ConfigService);
  const nodeEnv = config.get<string>('nodeEnv');
  const port = config.get<number>('port') as number;

  app.use(helmet());

  app.enableCors({
    origin: nodeEnv === 'production' ? false : true, // tighten via allowlist before real prod use
    credentials: true,
  });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Global validation: strips unknown properties (whitelist) and rejects
  // requests that include them (forbidNonWhitelisted) — this is the
  // mass-assignment defense referenced in the security checklist, e.g. a
  // client cannot sneak a `businessId` or `role` field into a body DTO that
  // doesn't declare it.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ERP Backend API')
      .setDescription('Multi-tenant Business Management ERP — Phase 1-4 Foundation')
      .setVersion('0.1.0')
      .addBearerAuth()
      .addApiKey(
        { type: 'apiKey', name: 'X-Business-Id', in: 'header' },
        'X-Business-Id',
      )
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  app.enableShutdownHooks();

  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`ERP backend listening on port ${port} [${nodeEnv}]`);
}

bootstrap();
