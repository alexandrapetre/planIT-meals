const mongoose = require('mongoose');

let memoryServer = null;

async function startMemoryMongo() {
  let MongoMemoryServer;
  try {
    ({ MongoMemoryServer } = require('mongodb-memory-server'));
  } catch {
    throw new Error(
      'USE_MEMORY_MONGO is set but mongodb-memory-server is missing. Run: npm install (from backend/)'
    );
  }
  memoryServer = await MongoMemoryServer.create();
  return memoryServer.getUri();
}

const connectDB = async () => {
  try {
    let uri;
    let options = {};

    if (process.env.USE_MEMORY_MONGO === 'true') {
      console.log(
        '[MongoDB] USE_MEMORY_MONGO=true — starting embedded MongoDB (no Docker). Data is lost when you stop the server.'
      );
      uri = await startMemoryMongo();
      options = { dbName: 'planit-meals' };
    } else {
      uri = process.env.MONGO_URI;
      if (!uri) {
        throw new Error('Set MONGO_URI in .env or USE_MEMORY_MONGO=true for local dev without Docker.');
      }
    }

    const conn = await mongoose.connect(uri, options);
    console.log(`[MongoDB] Connected to: ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    console.error(`[MongoDB] Connection error: ${err.message}`);
    throw err;
  }
};

module.exports = connectDB;
