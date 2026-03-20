const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// ----------------------
// VERIFICATION SYSTEM
// ----------------------

// Employer applies for verification badge
router.post('/verify', authMiddleware(['CREATOR']), async (req, res) => {
  const prisma = req.prisma;
  const userId = req.user.userId;
  const { documentsUrl } = req.body;

  try {
    const existing = await prisma.employerVerification.findUnique({
      where: { userId }
    });

    if (existing) {
      return res.status(400).json({ error: 'Verification request already exists' });
    }

    const verification = await prisma.employerVerification.create({
      data: { userId, documentsUrl, status: 'PENDING' }
    });

    res.status(201).json(verification);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin Reviews Verification Requests
router.get('/verifications', authMiddleware(['ADMIN']), async (req, res) => {
  const prisma = req.prisma;

  try {
    const requests = await prisma.employerVerification.findMany({
      include: { user: { select: { id: true, phone: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin Approves/Rejects Verification
router.put('/verifications/:id', authMiddleware(['ADMIN']), async (req, res) => {
  const prisma = req.prisma;
  const { id } = req.params;
  const { status } = req.body; // 'APPROVED', 'REJECTED'

  try {
    const updated = await prisma.employerVerification.update({
      where: { id },
      data: { status }
    });
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ----------------------
// USER MANAGEMENT
// ----------------------

// Admin Lists All Users
router.get('/users', authMiddleware(['ADMIN']), async (req, res) => {
  const prisma = req.prisma;

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        name: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin Deletes a User
router.delete('/users/:id', authMiddleware(['ADMIN']), async (req, res) => {
  const prisma = req.prisma;
  const { id } = req.params;

  console.log(`[Admin] Attempting to delete user ${id} by admin ${req.user.userId}`);

  try {
    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      console.log(`[Admin] Delete failed: User ${id} not found`);
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent admin from deleting themselves
    if (id === req.user.userId) {
      console.log(`[Admin] Delete failed: Admin tried to delete self`);
      return res.status(400).json({ error: 'Cannot delete your own admin account' });
    }

    // Delete user (Prisma cascades will handle associated data)
    await prisma.user.delete({ where: { id } });
    
    console.log(`[Admin] Successfully deleted user ${id}`);
    res.json({ message: 'User and all associated data deleted successfully' });
  } catch (error) {
    console.error(`[Admin] ERROR deleting user ${id}:`, error);
    res.status(500).json({ error: `Failed to delete user: ${error.message}` });
  }
});

module.exports = router;
