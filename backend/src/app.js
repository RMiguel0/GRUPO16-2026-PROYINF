// Configura Express: JSON, CORS, rutas y manejo de errores.
import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import errorHandler from './middlewares/error.js';
import loansRouter from './routes/loans.routes.js';
import authRoutes from './routes/auth.routes.js';

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*', credentials: true }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/loans', loansRouter);

app.use('/api', routes);

app.use(errorHandler);

export default app;
