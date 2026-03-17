import { jest, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

let mongod;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  mongod = await MongoMemoryServer.create();

  const uri = mongod.getUri();
  await mongoose.connect(uri);
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany();
  }

  // Suppress console.error during tests (auth middleware logs)
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(async () => {
  // Restore console mocks
  jest.restoreAllMocks();

  // Cleanup MongoDB
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongod) {
    await mongod.stop();
  }
});