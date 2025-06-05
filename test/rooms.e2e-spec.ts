/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from '../src/rooms/entities/room.entity';
import { RoomsModule } from '../src/rooms/rooms.module';

describe('RoomsModule (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT!, 10) || 5432,
          username: process.env.DB_USERNAME!,
          password: process.env.DB_PASSWORD!,
          database: process.env.DB_NAME!,
          dropSchema: true,
          entities: [Room],
          synchronize: true,
        }),
        RoomsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/rooms (POST) & GET', async () => {
    const createDto = { name: 'E2E Room' };
    const postRes = await request(app.getHttpServer())
      .post('/rooms')
      .send(createDto)
      .expect(201);
    expect(postRes.body).toMatchObject({ name: 'E2E Room' });

    const getRes = await request(app.getHttpServer()).get('/rooms').expect(200);
    expect(Array.isArray(getRes.body)).toBe(true);
    expect(getRes.body[0]).toMatchObject({ name: 'E2E Room' });
  });
});
