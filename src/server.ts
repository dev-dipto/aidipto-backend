import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './db.js'; // initialises the SQLite file and admin user on boot
import { env } from './env.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { leadsRouter } from './routes/leads.js';
import { chatRouter } from './routes/chat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(
  helmet({
    // the admin panel is plain HTML/CSS/JS served from this same server
    contentSecurityPolicy: false,
  }),
);
app.use(compression());
app.use(morgan('tiny'));
app.use(express.json({ limit: '256kb' }));
app.use(
  cors({
    origin: env.corsOrigins,
    credentials: false,
  }),
);

app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api', leadsRouter);
app.use('/api', chatRouter);

// Admin panel — static, no build step, served at /admin
app.use('/admin', express.static(path.join(__dirname, '..', 'public', 'admin')));

app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(env.port, () => {
  console.log(`AIDIPTO backend listening on http://localhost:${env.port}`);
  console.log(`Admin panel: http://localhost:${env.port}/admin`);
});
