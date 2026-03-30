// ============================================================
// Bingo Royale - Auth Routes
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import {
  createGuestUser,
  registerUser,
  loginUser,
} from '../services/auth.js';

const router = Router();

// --------------- Validation schemas ---------------

const guestSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(30, 'Name too long')
    .trim(),
  locale: z.enum(['en', 'es']).optional().default('en'),
});

const registerSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(30, 'Name too long')
    .trim(),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  locale: z.enum(['en', 'es']).optional().default('en'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

// --------------- POST /api/auth/guest ---------------

router.post('/guest', async (req, res) => {
  try {
    const parsed = guestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { name, locale } = parsed.data;
    const result = await createGuestUser(name, locale);

    res.status(201).json(result);
  } catch (err) {
    console.error('[Auth] Guest creation error:', err);
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
});

// --------------- POST /api/auth/register ---------------

router.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { name, email, password, locale } = parsed.data;
    const result = await registerUser(name, email, password, locale);

    res.status(201).json(result);
  } catch (err) {
    console.error('[Auth] Registration error:', err);
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    const status = message === 'Email already registered' ? 409 : 500;
    res.status(status).json({ error: message });
  }
});

// --------------- POST /api/auth/login ---------------

router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { email, password } = parsed.data;
    const result = await loginUser(email, password);

    res.json(result);
  } catch (err) {
    console.error('[Auth] Login error:', err);
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    const status =
      message === 'Invalid credentials' || message === 'Database not available'
        ? 401
        : 500;
    res.status(status).json({ error: message });
  }
});

export default router;
