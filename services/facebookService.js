const { Lead, Interaction } = require('./models');
const axios = require('axios');
const natural = require('natural');
const tokenizer = new natural.WordTokenizer();

const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const FB_API_VERSION = process.env.FB_API_VERSION || 'v18.0';

async function processMessages(entries) {
  for (const entry of entries) {
    for (const event of entry.messaging) {
      const senderId = event.sender.id;
      const messageText = event.message?.text;
      
      if (messageText) {
        // Analyze message
        const tokens = tokenizer.tokenize(messageText);
        const intent = analyzeIntent(tokens);
        
        // Save lead and interaction
        const lead = await findOrCreateLead(senderId, 'facebook');
        await Interaction.create({
          leadId: lead.id,
          message: messageText,
          intent,
          metadata: event
        });

        // Generate response
        const response = generateResponse(intent);
        await sendMessage(senderId, response);
      }
    }
  }
}

function analyzeIntent(tokens) {
  // Basic intent analysis
  if (tokens.some(t => ['price', 'cost', 'how much'].includes(t.toLowerCase()))) {
    return 'PRICING_QUERY';
  }
  if (tokens.some(t => ['contact', 'email', 'phone'].includes(t.toLowerCase()))) {
    return 'CONTACT_REQUEST';
  }
  return 'GENERAL_QUERY';
}

async function findOrCreateLead(senderId, platform) {
  return Lead.findOrCreate({
    where: { phone: senderId },
    defaults: { platform }
  });
}

async function sendMessage(recipientId, message) {
  const url = `https://graph.facebook.com/${FB_API_VERSION}/me/messages`;
  const payload = {
    recipient: { id: recipientId },
    message: { text: message }
  };

  await axios.post(url, payload, {
    params: { access_token: FB_ACCESS_TOKEN }
  });
}

module.exports = { processMessages };
