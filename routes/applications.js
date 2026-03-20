const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Get applications (Seeker sees their own, Creator sees applications for their jobs)
router.get('/', authMiddleware(), async (req, res) => {
  const prisma = req.prisma;
  const user = req.user;

  try {
    if (user.role === 'SEEKER') {
      const applications = await prisma.application.findMany({
        where: { applicantId: user.userId },
        include: {
          job: { select: { id: true, title: true, company: true, location: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.json(applications);
    } else if (user.role === 'CREATOR' || user.role === 'ADMIN') {
      const applications = await prisma.application.findMany({
        where: { job: { creatorId: user.userId } },
        include: {
          applicant: { select: { id: true, phone: true } },
          job: { select: { id: true, title: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      return res.json(applications);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Apply for a job (Seeker only)
router.post('/', authMiddleware(['SEEKER']), async (req, res) => {
  const prisma = req.prisma;
  const applicantId = req.user.userId;
  const { jobId } = req.body;

  if (!jobId) {
    return res.status(400).json({ error: 'Job ID is required' });
  }

  try {
    // Check if job exists
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Check if already applied
    const existingApp = await prisma.application.findUnique({
      where: { jobId_applicantId: { jobId, applicantId } }
    });
    if (existingApp) return res.status(400).json({ error: 'Already applied to this job' });

    const application = await prisma.application.create({
      data: {
        jobId,
        applicantId,
        status: 'PENDING'
      }
    });

    res.status(201).json(application);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update application status (Creator/Admin only)
router.put('/:id/status', authMiddleware(['CREATOR', 'ADMIN']), async (req, res) => {
  const prisma = req.prisma;
  const { id } = req.params;
  const { status } = req.body;
  const userId = req.user.userId;

  const validStatuses = ['PENDING', 'REVIEWED', 'ACCEPTED', 'REJECTED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const application = await prisma.application.findUnique({
      where: { id },
      include: { job: true }
    });

    if (!application) return res.status(404).json({ error: 'Application not found' });
    
    // Ensure creator owns the job
    if (application.job.creatorId !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updatedApp = await prisma.application.update({
      where: { id },
      data: { status }
    });

    res.json(updatedApp);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer storage for CVs
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/cvs';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `cv-${req.params.id}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'), false);
  }
});

// Request CV (Creator only)
router.put('/:id/request-cv', authMiddleware(['CREATOR']), async (req, res) => {
  const prisma = req.prisma;
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    const application = await prisma.application.findUnique({
      where: { id },
      include: { job: true }
    });

    if (!application) return res.status(404).json({ error: 'Application not found' });
    if (application.job.creatorId !== userId) return res.status(403).json({ error: 'Forbidden' });

    const updatedApp = await prisma.application.update({
      where: { id },
      data: { cvRequested: true }
    });

    res.json(updatedApp);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload CV (Seeker only)
router.post('/:id/upload-cv', authMiddleware(['SEEKER']), upload.single('cv'), async (req, res) => {
  const prisma = req.prisma;
  const { id } = req.params;
  const userId = req.user.userId;

  if (!req.file) return res.status(400).json({ error: 'Please upload a PDF file' });

  try {
    const application = await prisma.application.findUnique({ where: { id } });
    if (!application) return res.status(404).json({ error: 'Application not found' });
    if (application.applicantId !== userId) return res.status(403).json({ error: 'Forbidden' });

    const cvUrl = `/uploads/cvs/${req.file.filename}`;

    const updatedApp = await prisma.application.update({
      where: { id },
      data: { cvUrl }
    });

    res.json(updatedApp);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
