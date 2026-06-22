require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const authRoutes = require('./routes/authRoutes');
const recipeRoutes = require('./routes/recipeRoutes');
const ingredientRoutes = require('./routes/ingredientRoutes');
const mealPlanRoutes = require('./routes/mealPlanRoutes');
const mealLogRoutes = require('./routes/mealLogRoutes');
const fridgeRoutes = require('./routes/fridgeRoutes');

const app = express();

const isDev = (process.env.NODE_ENV || 'development') === 'development';
const corsOrigins = isDev
  ? [
      ...new Set([
        'http://localhost:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        process.env.CLIENT_ORIGIN,
      ].filter(Boolean)),
    ]
  : [process.env.CLIENT_ORIGIN || 'http://localhost:5173'];

app.use(
  cors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'planit-meals-backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/meal-plans', mealPlanRoutes);
app.use('/api/meal-logs', mealLogRoutes);
app.use('/api/fridge', fridgeRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 5060;

async function start() {
  if (!process.env.JWT_SECRET) {
    console.error('[Server] Set JWT_SECRET in backend/.env (copy from .env.example).');
    process.exit(1);
  }

  try {
    await connectDB();
  } catch {
    if (process.env.USE_MEMORY_MONGO !== 'true') {
      console.error(
        '[MongoDB] Cannot connect. Options:\n' +
          '  • Set USE_MEMORY_MONGO=true in backend/.env (no Docker; data resets when server stops)\n' +
          '  • Or start Mongo: docker compose up -d   or   brew services start mongodb-community'
      );
    }
    process.exit(1);
  }

  if (process.env.USE_MEMORY_MONGO === 'true') {
    const Recipe = require('./models/Recipe');
    const { runMealDbSeed } = require('./scripts/seedRecipes');
    const n = await Recipe.countDocuments();
    if (n === 0) {
      console.log('[seed] In-memory DB is empty; importing recipes from TheMealDB (one-time, may take a minute)...');
      try {
        await runMealDbSeed({ quiet: false });
      } catch (e) {
        console.error('[seed] Auto-seed failed:', e.message);
        console.error('[seed] You can still run with an empty recipe list or fix the network and restart.');
      }
    }
  }

  const server = app.listen(PORT, () => {
    console.log(`[Server] Running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `[Server] Port ${PORT} is already in use. Either stop the other process or set PORT in backend/.env.\n` +
          `  Find listener:  lsof -nP -iTCP:${PORT} -sTCP:LISTEN\n` +
          `  Kill (example):  kill $(lsof -t -iTCP:${PORT} -sTCP:LISTEN)`
      );
    } else {
      console.error('[Server]', err);
    }
    process.exit(1);
  });
}

start();
