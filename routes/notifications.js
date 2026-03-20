const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Get unread notifications
router.get('/', authMiddleware(), async (req, res) => {
  const prisma = req.prisma;
  const userId = req.user.userId;

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20 // limit to recent 20
    });

    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark notification as read
router.put('/:id/read', authMiddleware(), async (req, res) => {
  const prisma = req.prisma;
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    const notification = await prisma.notification.findUnique({ where: { id } });
    
    if (!notification || notification.userId !== userId) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create generic notification (usually called internally, but exposing for completeness)
router.post('/', authMiddleware(['ADMIN']), async (req, res) => {
  const prisma = req.prisma;
  const { userId, content } = req.body;

  try {
    const notification = await prisma.notification.create({
      data: { userId, content }
    });
    res.status(201).json(notification);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
