const express = require('express');
const router = express.Router();
const facebookService = require('../services/facebookService');
const { Lead, Interaction } = require('../models');

// Webhook verification
router.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Message handling
router.post('/webhook', async (req, res) => {
  try {
    const { body } = req;
    if (body.object === 'page') {
      await facebookService.processMessages(body.entry);
      res.status(200).send('EVENT_RECEIVED');
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('Error processing Facebook message:', error);
    res.status(500).send('Error processing message');
  }
});

// Broadcast message endpoint
router.post('/broadcast', async (req, res) => {
  try {
    const { leadIds, message } = req.body;
    
    if (!leadIds || !message) {
      return res.status(400).json({ error: 'Missing leadIds or message' });
    }

    if (!Array.isArray(leadIds)) {
      return res.status(400).json({ error: 'leadIds must be an array' });
    }

    await facebookService.broadcastMessage(leadIds, message);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error sending broadcast:', error);
    res.status(500).json({ error: 'Failed to send broadcast messages' });
  }
});

module.exports = router;
