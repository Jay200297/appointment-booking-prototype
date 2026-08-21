const express = require('express');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const { swaggerSpec } = require('./swagger');
const { authenticate, requireRole } = require('./middleware/auth');
const { validateAvailability, handleValidation } = require('./middleware/validation');

const authRouter = require('./routes/auth');
const clinicsRouter = require('./routes/clinics');
const availabilityRouter = require('./routes/availability');
const appointmentsRouter = require('./routes/appointments');
const integrationsRouter = require('./routes/integrations');
const notificationsRouter = require('./routes/notifications');
const adminRouter = require('./routes/admin');
const providersRouter = require('./routes/providers');
const { startScheduler } = require('./scheduler/reminderScheduler');

dotenv.config();

const app = express();

app.use((req, res, next) => {
  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:8001';

  res.header('Access-Control-Allow-Origin', allowedOrigin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/auth', authRouter);
app.use('/clinics', clinicsRouter);
app.use('/availability', authenticate, validateAvailability, handleValidation, availabilityRouter);
app.use('/appointments', authenticate, requireRole('patient', 'admin', 'provider'), appointmentsRouter);
app.use('/integrations', authenticate, integrationsRouter);
app.use('/notifications', authenticate, notificationsRouter);
app.use('/admin', authenticate, requireRole('admin'), adminRouter);
app.use('/providers', authenticate, providersRouter);

if (require.main === module) {
  const port = process.env.PORT || 8000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    // kick off scheduler if enabled
    startScheduler();
  });
}

module.exports = { app };
