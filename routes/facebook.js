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

module.exports = router;
