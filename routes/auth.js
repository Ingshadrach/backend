const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const signToken = (userId, role) =>
  jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Social Login (Google / Apple)
// Frontend passes: { provider: 'google'|'apple', email, socialId, name, role? }
router.post('/social-login', async (req, res) => {
  const { provider, email, socialId, name, role } = req.body;
  const prisma = req.prisma;

  if (!provider || !email || !socialId) {
    return res.status(400).json({ error: 'provider, email and socialId are required' });
  }

  try {
    const idField = provider === 'google' ? 'googleId' : 'appleId';

    // Try to find existing user by socialId or email
    let user = await prisma.user.findFirst({
      where: { OR: [{ [idField]: socialId }, { email }] },
      include: { profile: true }
    });

    if (user) {
      // Update the social ID if it wasn't set (e.g., email-matched)
      if (!user[idField]) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { [idField]: socialId },
          include: { profile: true }
        });
      }
    } else {
      // New user – require role selection
      if (!role || !['SEEKER', 'CREATOR'].includes(role)) {
        return res.status(400).json({ error: 'role_required', message: 'Please select a role to complete signup.' });
      }

      user = await prisma.user.create({
        data: {
          email,
          [idField]: socialId,
          role,
          profile: { create: {} }
        },
        include: { profile: true }
      });
    }

    const token = signToken(user.id, user.role);
    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Traditional Registration
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  const prisma = req.prisma;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password and role are required' });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        profile: { create: {} }
      },
      include: { profile: true }
    });

    const token = signToken(user.id, user.role);
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({ user: userWithoutPassword, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Traditional Login (email + password)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const prisma = req.prisma;

  // Hardcoded Admin Access
  if (email === 'abubakarrshadrachk@gmail.com' && password === 'ABSK101blaze') {
    try {
      let user = await prisma.user.findUnique({
        where: { email },
        include: { profile: true }
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            name: 'Super Admin',
            email,
            role: 'ADMIN',
            profile: { create: {} }
          },
          include: { profile: true }
        });
      } else if (user.role !== 'ADMIN') {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { role: 'ADMIN' },
          include: { profile: true }
        });
      }

      const token = signToken(user.id, user.role);
      const { password: _, ...userWithoutPassword } = user;
      return res.json({ user: userWithoutPassword, token });
    } catch (error) {
      console.error('Admin hardcode login error:', error);
    }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true }
    });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user.id, user.role);
    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Current User
router.get('/me', authMiddleware(), async (req, res) => {
  const prisma = req.prisma;
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { profile: true }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
