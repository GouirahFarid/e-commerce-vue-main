import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/database.js';
import orderRoutes from './routes/orderRoutes.js';
import { metricsMiddleware, metricsEndpoint } from './middleware/metrics.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3002;

// Connexion à la base de données seulement si pas en mode test
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

// Middleware
app.use(cors());
app.use(express.json());

// Prometheus metrics middleware (only in production)
if (process.env.NODE_ENV === 'production') {
  app.use(metricsMiddleware);
}

// Routes
app.use('/api/orders', orderRoutes);

// Metrics endpoint for Prometheus
if (process.env.NODE_ENV === 'production') {
  app.get('/metrics', metricsEndpoint);
}

// Routes
app.use('/api/orders', orderRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', service: 'order-service' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Order service running on port ${port}`);
  });
}

export default app;