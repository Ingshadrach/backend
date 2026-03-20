const express = require('express');
const authMiddleware = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const router = express.Router();

// Generate and download a CV
router.post('/generate', authMiddleware(['SEEKER']), async (req, res) => {
  const prisma = req.prisma;
  const userId = req.user.userId;
  const { template, templateData } = req.body; 
  // templateData could include parsed profile fields: name, email, phone, bio, education, experience, skills

  // In a real app we'd deduct the 20-40 SLE fee here before generating the CV
  // check balance -> create Payment record -> proceed

  try {
    // Save the CV config
    const cv = await prisma.cV.create({
      data: {
        userId,
        content: JSON.stringify(templateData)
      }
    });

    // Record the download (to track history)
    await prisma.cVDownload.create({
      data: { cvId: cv.id }
    });

    // Create a new PDF document using pdfkit
    const doc = new PDFDocument({ margin: 50 });
    
    // Set headers so the client downloads the PDF
    res.setHeader('Content-disposition', `attachment; filename=cv_${userId}.pdf`);
    res.setHeader('Content-type', 'application/pdf');

    // Pipe the PDF directly to the response
    doc.pipe(res);

    // Build the PDF content based on templateData
    const data = templateData || {};
    
    // Header
    doc.fontSize(24).font('Helvetica-Bold').text(data.name || 'Your Name', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text(`${data.phone || 'Phone'} | ${data.email || 'Email'}`, { align: 'center' });
    doc.moveDown();

    // Bio
    if (data.bio) {
      doc.fontSize(16).font('Helvetica-Bold').text('Professional Summary');
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica').text(data.bio);
      doc.moveDown();
    }

    // Experience
    if (data.experience) {
      doc.fontSize(16).font('Helvetica-Bold').text('Experience');
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica').text(data.experience);
      doc.moveDown();
    }

    // Education
    if (data.education) {
      doc.fontSize(16).font('Helvetica-Bold').text('Education');
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica').text(data.education);
      doc.moveDown();
    }

    // Skills
    if (data.skills) {
      doc.fontSize(16).font('Helvetica-Bold').text('Skills');
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica').text(data.skills);
    }

    // Finalize the PDF and end the stream
    doc.end();

  } catch (error) {
    console.error('CV Generation Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate CV' });
    }
  }
});

// Get CV Download History (Internal)
router.get('/history', authMiddleware(['SEEKER']), async (req, res) => {
  const prisma = req.prisma;
  const userId = req.user.userId;

  try {
    const cvs = await prisma.cV.findMany({
      where: { userId },
      include: { downloads: true },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(cvs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
