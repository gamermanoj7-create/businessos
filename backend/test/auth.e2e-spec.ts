import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// ---------------------------------------------------------------------------
// These tests exercise the full HTTP stack against a REAL PostgreSQL
// database — they are not run inside the sandbox that produced this file
// (no network/DB access there). To run them yourself:
//
//   docker compose up -d
//   cp .env.example .env.test   # point DATABASE_URL at a disposable test DB
//   npx dotenv -e .env.test -- npx prisma migrate deploy
//   npx dotenv -e .env.test -- npm run test:e2e
//
// Each `describe` block cleans up the rows it creates via PrismaService in
// afterAll, so the suite can be re-run against the same database.
// ---------------------------------------------------------------------------

describe('Auth + Tenant Isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ownerA = {
    ownerName: 'Owner A',
    email: `owner-a-${Date.now()}@example.com`,
    password: 'S3curePass!23',
    businessName: 'Business A',
  };
  const ownerB = {
    ownerName: 'Owner B',
    email: `owner-b-${Date.now()}@example.com`,
    password: 'S3curePass!23',
    businessName: 'Business B',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Clean up everything created by this suite, in FK-safe order.
    await prisma.session.deleteMany({ where: { user: { email: { in: [ownerA.email, ownerB.email] } } } });
    await prisma.businessMember.deleteMany({ where: { user: { email: { in: [ownerA.email, ownerB.email] } } } });
    await prisma.business.deleteMany({ where: { name: { in: [ownerA.businessName, ownerB.businessName] } } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerA.email, ownerB.email] } } });
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('registers a new owner + business and returns tokens', async () => {
      const res = await request(app.getHttpServer()).post('/auth/register').send(ownerA);

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.email).toBe(ownerA.email);
      expect(res.body.business.role).toBe('OWNER');
      expect(res.body.user.passwordHash).toBeUndefined(); // never leak the hash
    });

    it('rejects a duplicate email with 409', async () => {
      const res = await request(app.getHttpServer()).post('/auth/register').send(ownerA);
      expect(res.status).toBe(409);
    });

    it('rejects a weak password with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...ownerA, email: `weak-${Date.now()}@example.com`, password: '123' });
      expect(res.status).toBe(400);
    });

    it('rejects an unexpected extra field (mass-assignment defense)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...ownerA,
          email: `extra-${Date.now()}@example.com`,
          isAdmin: true, // not part of RegisterDto — must be rejected, not silently dropped-and-accepted
        });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    it('logs in with correct credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ownerA.email, password: ownerA.password });
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });

    it('rejects an unknown email with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody-at-all@example.com', password: 'whatever123' });
      expect(res.status).toBe(401);
    });

    it('rejects a wrong password with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ownerA.email, password: 'WrongPassword1' });
      expect(res.status).toBe(401);
    });
  });

  describe('protected routes + refresh + logout', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ownerA.email, password: ownerA.password });
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('rejects an unauthenticated request to a protected route', async () => {
      const res = await request(app.getHttpServer()).get('/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns the profile for an authenticated request', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(ownerA.email);
      expect(res.body.businesses.length).toBeGreaterThan(0);
    });

    it('rotates tokens on refresh, and the OLD refresh token cannot be reused', async () => {
      const first = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken });
      expect(first.status).toBe(200);
      expect(first.body.refreshToken).not.toEqual(refreshToken);

      // Reusing the original (now-rotated-out) refresh token must fail.
      const reuse = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken });
      expect(reuse.status).toBe(401);

      refreshToken = first.body.refreshToken;
      accessToken = first.body.accessToken;
    });

    it('logs out and revokes the session so it cannot be refreshed again', async () => {
      const logoutRes = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });
      expect(logoutRes.status).toBe(204);

      const refreshAfterLogout = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken });
      expect(refreshAfterLogout.status).toBe(401);
    });
  });

  describe('Tenant isolation (mandatory security test)', () => {
    let tokenA: string;
    let tokenB: string;
    let businessIdA: string;
    let businessIdB: string;

    beforeAll(async () => {
      const loginA = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ownerA.email, password: ownerA.password });
      tokenA = loginA.body.accessToken;

      const registerB = await request(app.getHttpServer()).post('/auth/register').send(ownerB);
      tokenB = registerB.body.accessToken;
      businessIdB = registerB.body.business.id;

      const meA = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${tokenA}`);
      businessIdA = meA.body.businesses[0].id;
    });

    it('missing X-Business-Id header is rejected with 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/business')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(400);
    });

    it("user A CANNOT read business B's data by supplying B's ID in X-Business-Id", async () => {
      const res = await request(app.getHttpServer())
        .get('/business')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('X-Business-Id', businessIdB);
      expect(res.status).toBe(403);
    });

    it("user A CANNOT update business B's data by supplying B's ID in X-Business-Id", async () => {
      const res = await request(app.getHttpServer())
        .patch('/business')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('X-Business-Id', businessIdB)
        .send({ name: 'Hijacked Name' });
      expect(res.status).toBe(403);

      // Confirm business B's name was NOT changed.
      const checkB = await request(app.getHttpServer())
        .get('/business')
        .set('Authorization', `Bearer ${tokenB}`)
        .set('X-Business-Id', businessIdB);
      expect(checkB.body.name).toBe(ownerB.businessName);
    });

    it('user A CAN access their own business with their own ID', async () => {
      const res = await request(app.getHttpServer())
        .get('/business')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('X-Business-Id', businessIdA);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe(ownerA.businessName);
    });

    it('a businessId in the request BODY cannot override the header-resolved tenant', async () => {
      // Even if a client tries to sneak businessId into the payload, the
      // controller only ever reads tenant.businessId from TenantGuard —
      // UpdateBusinessDto does not even declare a businessId field, and
      // ValidationPipe's forbidNonWhitelisted rejects it outright.
      const res = await request(app.getHttpServer())
        .patch('/business')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('X-Business-Id', businessIdA)
        .send({ name: 'Legit Update', businessId: businessIdB });
      expect(res.status).toBe(400);
    });
  });
});
