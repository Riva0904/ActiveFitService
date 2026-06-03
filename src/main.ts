import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import express from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { SanitizeBodyPipe } from './common/pipes/sanitize-body.pipe';
import { AppLoggerService } from './common/logger/logger.service';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    logger: new AppLoggerService(),
  });
  const configService = app.get(ConfigService);

  // Ensure uploads dir exists
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());

  const corsOrigin = configService.get('CORS_ORIGIN', 'http://localhost:3000');
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  // Serve uploaded files as static assets
  app.useStaticAssets(uploadsDir, { prefix: '/uploads' });

  app.setGlobalPrefix('api/v1', {
    exclude: ['/api/docs', '/swagger', '/swagger/(.*)', '/hello'],
  });
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new RequestIdInterceptor());
  app.useGlobalPipes(
    new SanitizeBodyPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const isProduction = configService.get('NODE_ENV') === 'production';
  const expressApp = app.getHttpAdapter().getInstance();
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('ActiveBoost API')
      .setDescription('Gym Management SaaS Platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    expressApp.get('/swagger', (req, res) => res.redirect('/api/docs'));
  }
  expressApp.get('/hello', (req, res) => res.send('hello'));

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);
  console.log(`ActiveBoost API running on: http://localhost:${port}/api/v1`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
  console.log(`Swagger redirect: http://localhost:${port}/swagger -> /api/docs`);
}
bootstrap();
