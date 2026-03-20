const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const auth = require('../middleware/auth');

// Get reviews for a specific employer user
router.get('/:employerId', async (req, res) => {
  try {
    const reviews = await prisma.companyReview.findMany({
      where: { employerId: req.params.employerId },
      include: {
        reviewer: { select: { id: true, profile: { select: { picture: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Submit a review
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'SEEKER') return res.status(403).json({ error: 'Only seekers can review companies' });
    
    const { employerId, rating, comment } = req.body;
    if (!employerId || !rating || !comment) return res.status(400).json({ error: 'Missing fields' });

    const review = await prisma.companyReview.create({
      data: {
        employerId,
        reviewerId: req.user.userId,
        rating: Number(rating),
        comment
      }
    });
    res.json(review);
  } catch (error) {
    res.status(500).json({ error: 'Failed to post review' });
  }
});

module.exports = router;
