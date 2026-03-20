const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Startup Validation
if (!process.env.DATABASE_URL) {
  console.warn('⚠️ WARNING: DATABASE_URL is not set. Defaulting to file:./dev.db');
}
if (!process.env.JWT_SECRET) {
  console.error('❌ ERROR: JWT_SECRET is not set. Token signing will fail!');
}

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Expose prisma to req object
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// Import Routes
const authRoutes = require('./routes/auth.js');
const profileRoutes = require('./routes/profiles.js');
const jobRoutes = require('./routes/jobs.js');
const applicationRoutes = require('./routes/applications.js');
const savedJobRoutes = require('./routes/savedJobs.js');
const cvRoutes = require('./routes/cv.js');
const businessRoutes = require('./routes/business.js');
const adminRoutes = require('./routes/admin.js');
const notificationRoutes = require('./routes/notifications.js');
const interviewRoutes = require('./routes/interviews.js');
const reviewRoutes = require('./routes/reviews.js');

app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/saved-jobs', savedJobRoutes);
app.use('/api/cv', cvRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/reviews', reviewRoutes);

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
