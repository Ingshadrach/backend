const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Propose interview (Employer only)
router.post('/propose', auth(['CREATOR']), async (req, res) => {
  const prisma = req.prisma;
  try {
    if (req.user.role !== 'CREATOR') return res.status(403).json({ error: 'Creators only' });
    const { jobId, applicantId, proposedSlots } = req.body; // array of time strings

    const interview = await prisma.interview.create({
      data: {
        jobId,
        employerId: req.user.userId,
        applicantId,
        proposedSlots: JSON.stringify(proposedSlots),
        status: 'PENDING'
      }
    });
    res.json(interview);
  } catch (error) {
    res.status(500).json({ error: 'Failed to propose interview' });
  }
});

// Applicant gets their interviews
router.get('/', auth(), async (req, res) => {
  const prisma = req.prisma;
  try {
    const interviews = await prisma.interview.findMany({
      where: { applicantId: req.user.userId },
      include: {
        job: true,
        employer: { select: { id: true, name: true, profile: { select: { picture: true } } } }
      }
    });
    res.json(interviews);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch interviews' });
  }
});

// Accept an interview
router.post('/accept/:id', auth(), async (req, res) => {
  const prisma = req.prisma;
  try {
    const { selectedSlot } = req.body;
    const interview = await prisma.interview.findUnique({ where: { id: req.params.id } });
    if (!interview || interview.applicantId !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updated = await prisma.interview.update({
      where: { id: req.params.id },
      data: {
        selectedSlot: new Date(selectedSlot),
        status: 'ACCEPTED'
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to accept interview' });
  }
});

module.exports = router;
