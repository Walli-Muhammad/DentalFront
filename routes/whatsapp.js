/**
 * routes/whatsapp.js — WhatsApp webhook route definitions
 *
 * GET  /webhook  → Meta webhook verification challenge
 * POST /webhook  → Receive incoming WhatsApp messages / status updates
 */

import { Router } from 'express';
import {
  verifyWebhook,
  handleIncomingMessage,
} from '../controllers/whatsappController.js';

const router = Router();

// Meta calls GET to verify the webhook during setup
router.get('/', verifyWebhook);

// Meta sends incoming messages and status updates via POST
router.post('/', handleIncomingMessage);

export default router;
