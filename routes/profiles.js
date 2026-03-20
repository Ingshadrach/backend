const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Get profile logic (by user ID)
router.get('/:userId', async (req, res) => {
  const prisma = req.prisma;
  const { userId } = req.params;

  try {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      include: {
        user: {
          select: { id: true, phone: true, role: true, createdAt: true }
        }
      }
    });

    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    res.json(profile);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update own profile
router.put('/me', authMiddleware(), async (req, res) => {
  const prisma = req.prisma;
  const userId = req.user.userId;
  const data = req.body;

  try {
    // Calculate simple completion score based on non-null fields
    let score = 0;
    const fieldsToCheck = ['picture', 'coverPhoto', 'bio', 'skills', 'experience', 'education', 'location'];
    let filledFields = 0;

    fieldsToCheck.forEach(field => {
      if (data[field] && data[field].trim() !== '') filledFields++;
    });

    score = Math.round((filledFields / fieldsToCheck.length) * 100);
    
    // Only allow updating certain fields
    const safeData = {
      picture: data.picture,
      coverPhoto: data.coverPhoto,
      bio: data.bio,
      skills: data.skills,
      experience: data.experience,
      education: data.education,
      location: data.location,
      availableNow: data.availableNow,
      completionScore: score
    };

    const updatedProfile = await prisma.profile.upsert({
      where: { userId },
      update: safeData,
      create: { ...safeData, userId }
    });

    res.json(updatedProfile);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
