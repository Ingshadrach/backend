const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Get all jobs (with optional filters)
router.get('/', async (req, res) => {
  const prisma = req.prisma;
  const { location, search } = req.query;

  try {
    let whereClause = {};
    if (location) whereClause.location = { contains: location };
    if (search) {
      whereClause.OR = [
        { title: { contains: search } },
        { company: { contains: search } },
        { description: { contains: search } }
      ];
    }

    const jobs = await prisma.job.findMany({
      where: whereClause,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            role: true,
            profile: { select: { picture: true } },
            verification: { select: { status: true } }
          }
        }
      },
      orderBy: [
        { isFeatured: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.json(jobs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recommendations
router.get('/recommendations', authMiddleware(['SEEKER', 'ADMIN', 'CREATOR']), async (req, res) => {
  const prisma = req.prisma;
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user.userId }
    });
    
    let whereClause = {};
    if (profile && profile.skills) {
      const skillsArray = profile.skills.split(',').map(s => s.trim().toLowerCase());
      if (skillsArray.length > 0) {
        whereClause.OR = skillsArray.map(s => ({ requirements: { contains: s } }));
      }
    }

    const jobs = await prisma.job.findMany({
      where: whereClause,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            role: true,
            profile: { select: { picture: true } },
            verification: { select: { status: true } }
          }
        }
      },
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(jobs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single job
router.get('/:id', async (req, res) => {
  const prisma = req.prisma;
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            role: true,
            profile: { select: { picture: true } },
            verification: { select: { status: true } }
          }
        }
      }
    });
    
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a job (CREATOR only)
router.post('/', authMiddleware(['CREATOR', 'ADMIN']), async (req, res) => {
  const prisma = req.prisma;
  const creatorId = req.user.userId;
  const { title, company, location, salary, description, requirements } = req.body;

  if (!title || !company || !location) {
    return res.status(400).json({ error: 'Title, company, and location are required' });
  }

  try {
    // Check subscription limit here in a real app
    
    const job = await prisma.job.create({
      data: {
        creatorId,
        title,
        company,
        location,
        salary,
        description,
        requirements
      }
    });

    res.status(201).json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a job (Creator only)
router.put('/:id', authMiddleware(['CREATOR', 'ADMIN']), async (req, res) => {
  const prisma = req.prisma;
  const { id } = req.params;
  const creatorId = req.user.userId;

  try {
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    
    if (job.creatorId !== creatorId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updatedJob = await prisma.job.update({
      where: { id },
      data: req.body
    });

    res.json(updatedJob);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a job (Creator only)
router.delete('/:id', authMiddleware(['CREATOR', 'ADMIN']), async (req, res) => {
  const prisma = req.prisma;
  const { id } = req.params;
  const creatorId = req.user.userId;

  try {
    console.log(`[DELETE] Request for Job ID: ${id} by User ID: ${creatorId}`);
    const job = await prisma.job.findUnique({ where: { id } });
    
    if (!job) {
      console.log(`[DELETE] Job not found: ${id}`);
      return res.status(404).json({ error: 'Job not found' });
    }
    
    console.log(`[DELETE] Job Creator ID: ${job.creatorId}, Requester ID: ${creatorId}, Role: ${req.user.role}`);
    
    if (job.creatorId !== creatorId && req.user.role !== 'ADMIN') {
      console.log(`[DELETE] Forbidden: User ${creatorId} attempted to delete job ${id} owned by ${job.creatorId}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.job.delete({ where: { id } });
    console.log(`[DELETE] Job ${id} deleted successfully`);
    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('[DELETE] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
