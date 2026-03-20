const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Get saved jobs
router.get('/', authMiddleware(), async (req, res) => {
  const prisma = req.prisma;
  const userId = req.user.userId;

  try {
    const savedJobs = await prisma.savedJob.findMany({
      where: { userId },
      include: {
        job: {
          include: { creator: { select: { id: true, role: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Flatten result to match standard job array Structure
    const jobs = savedJobs.map(sj => ({ ...sj.job, savedJobId: sj.id }));
    
    res.json(jobs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save a job
router.post('/', authMiddleware(), async (req, res) => {
  const prisma = req.prisma;
  const userId = req.user.userId;
  const { jobId } = req.body;

  if (!jobId) return res.status(400).json({ error: 'Job ID is required' });

  try {
    const existingSave = await prisma.savedJob.findUnique({
      where: { userId_jobId: { userId, jobId } }
    });
    
    if (existingSave) {
      return res.status(400).json({ error: 'Job already saved' });
    }

    const savedJob = await prisma.savedJob.create({
      data: { userId, jobId }
    });

    res.status(201).json(savedJob);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unsave a job
router.delete('/:jobId', authMiddleware(), async (req, res) => {
  const prisma = req.prisma;
  const userId = req.user.userId;
  const { jobId } = req.params;

  try {
    await prisma.savedJob.delete({
      where: { userId_jobId: { userId, jobId } }
    });
    
    res.json({ message: 'Job removed from saved list' });
  } catch (error) {
    // If not found, ignore or send error
    res.status(404).json({ error: 'Saved job not found' });
  }
});

module.exports = router;
