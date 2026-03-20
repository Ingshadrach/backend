const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// 1. Featured Jobs (Pay to push job to top)
router.post('/feature-job', authMiddleware(['CREATOR', 'ADMIN']), async (req, res) => {
  const prisma = req.prisma;
  const userId = req.user.userId;
  const { jobId, amount } = req.body; // e.g., 50 SLE

  try {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.creatorId !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Mock Payment processing
    const payment = await prisma.payment.create({
      data: {
        userId,
        amount,
        purpose: 'FEATURE_JOB',
        status: 'COMPLETED'
      }
    });

    // Update job to be featured
    await prisma.job.update({
      where: { id: jobId },
      data: { isFeatured: true }
    });

    res.json({ message: 'Job successfully featured', payment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Subscriptions
router.post('/subscribe', authMiddleware(['CREATOR']), async (req, res) => {
  const prisma = req.prisma;
  const userId = req.user.userId;
  const { plan, amount } = req.body; // "BASIC", "BUSINESS", "PREMIUM"

  const planLimits = {
    BASIC: 3,
    BUSINESS: 10,
    PREMIUM: 999999
  };

  if (!planLimits[plan]) return res.status(400).json({ error: 'Invalid plan' });

  try {
    // Mock Payment processing
    await prisma.payment.create({
      data: { userId, amount, purpose: 'SUBSCRIPTION', status: 'COMPLETED' }
    });

    // Create or Update Subscription
    const existing = await prisma.subscription.findFirst({ where: { userId } });
    let subscription;

    if (existing) {
      subscription = await prisma.subscription.update({
        where: { id: existing.id },
        data: { plan, postsRemaining: planLimits[plan], startDate: new Date() }
      });
    } else {
      subscription = await prisma.subscription.create({
        data: { userId, plan, postsRemaining: planLimits[plan] }
      });
    }

    res.json(subscription);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Pay to Unlock Contacts
router.post('/unlock-contact', authMiddleware(['CREATOR', 'ADMIN']), async (req, res) => {
  const prisma = req.prisma;
  const employerId = req.user.userId;
  const { applicantId, amount } = req.body;

  try {
    // Mock Payment processing
    const payment = await prisma.payment.create({
      data: {
        userId: employerId,
        amount,
        purpose: 'UNLOCK_CONTACT',
        status: 'COMPLETED'
      }
    });

    // Once payment is successful, return the applicant's phone number
    const applicant = await prisma.user.findUnique({
      where: { id: applicantId },
      select: { id: true, phone: true }
    });

    if (!applicant) return res.status(404).json({ error: 'Applicant not found' });

    res.json({
      message: 'Contact unlocked successfully',
      contact: applicant.phone,
      payment
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin insight: Get all payments
router.get('/payments', authMiddleware(['ADMIN']), async (req, res) => {
  const prisma = req.prisma;
  try {
    const payments = await prisma.payment.findMany({
      include: { user: { select: { id: true, role: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
