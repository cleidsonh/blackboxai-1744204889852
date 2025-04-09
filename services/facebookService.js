const { Lead, Interaction } = require('../models');
const axios = require('axios');
const natural = require('natural');
const tokenizer = new natural.WordTokenizer();
const Sentiment = require('sentiment');
const sentiment = new Sentiment();

const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const FB_API_VERSION = process.env.FB_API_VERSION || 'v18.0';

async function processMessages(entries) {
  for (const entry of entries) {
    for (const event of entry.messaging) {
      const senderId = event.sender.id;
      const messageText = event.message?.text;
      const attachments = event.message?.attachments || [];
      
      if (messageText || attachments.length > 0) {
        // Analyze message text if present
        let tokens = [];
        let intent = 'MEDIA';
        let sentimentResult = {score: 0, comparative: 0, words: []};
        
        if (messageText) {
          tokens = tokenizer.tokenize(messageText);
          intent = analyzeIntent(tokens);
          sentimentResult = sentiment.analyze(messageText);
        }

        // Save lead and interaction
        const lead = await findOrCreateLead(senderId, 'facebook');
        await Interaction.create({
          leadId: lead.id,
          message: messageText || '[media attachment]',
          intent,
          sentimentScore: sentimentResult.score,
          sentimentComparative: sentimentResult.comparative,
          sentimentWords: sentimentResult.words,
          metadata: {
            ...event,
            sentiment: sentimentResult,
            attachments: attachments.map(att => ({
              type: att.type,
              url: att.payload?.url
            }))
          }
        });

        // Generate appropriate response
        let response;
        if (attachments.length > 0) {
          const attachmentTypes = [...new Set(attachments.map(a => a.type))];
          response = generateMediaResponse(attachmentTypes);
        } else {
          response = generateResponse(intent, sentimentResult.score);
        }
        await sendMessage(senderId, response);
      }
    }
  }
}

// Intent patterns and scoring
const INTENT_PATTERNS = {
  PRICING_QUERY: {
    keywords: ['price', 'cost', 'how much', 'value', 'rate', 'fee', 'pricing'],
    synonyms: {
      'price': ['cost', 'rate', 'fee'],
      'how much': ['what does it cost', 'what is the price']
    },
    threshold: 0.7
  },
  CONTACT_REQUEST: {
    keywords: ['contact', 'email', 'phone', 'call', 'reach', 'number'],
    synonyms: {
      'contact': ['get in touch', 'reach out'],
      'phone': ['telephone', 'cell', 'mobile']
    },
    threshold: 0.6
  },
  APPOINTMENT: {
    keywords: ['schedule', 'appointment', 'meeting', 'book', 'reserve'],
    threshold: 0.65
  },
  PRODUCT_INFO: {
    keywords: ['product', 'service', 'feature', 'spec', 'detail'],
    threshold: 0.55
  }
};

function normalizeText(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, '');
}

function expandSynonyms(tokens, intent) {
  return tokens.flatMap(token => {
    const synonyms = INTENT_PATTERNS[intent]?.synonyms?.[token] || [];
    return [token, ...synonyms];
  });
}

function analyzeIntent(tokens) {
  const normalizedTokens = tokens.map(normalizeText);
  let bestIntent = 'GENERAL_QUERY';
  let highestScore = 0;

  for (const [intent, config] of Object.entries(INTENT_PATTERNS)) {
    const expandedTokens = expandSynonyms(normalizedTokens, intent);
    const matches = expandedTokens.filter(token => 
      config.keywords.includes(token)
    ).length;
    
    const score = matches / config.keywords.length;
    if (score > config.threshold && score > highestScore) {
      highestScore = score;
      bestIntent = intent;
    }
  }

  return bestIntent;
}

async function findOrCreateLead(senderId, platform) {
  return Lead.findOrCreate({
    where: { phone: senderId },
    defaults: { platform }
  });
}

async function sendMessage(recipientId, message, attachment = null) {
  const url = `https://graph.facebook.com/${FB_API_VERSION}/me/messages`;
  let payload;

  if (attachment) {
    payload = {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: attachment.type,
          payload: {
            url: attachment.url,
            is_reusable: true
          }
        }
      }
    };
  } else {
    payload = {
      recipient: { id: recipientId },
      message: { text: message }
    };
  }

  await axios.post(url, payload, {
    params: { access_token: FB_ACCESS_TOKEN }
  });
}

async function broadcastMessage(leadIds, message) {
  const url = `https://graph.facebook.com/${FB_API_VERSION}/me/messages`;
  
  for (const leadId of leadIds) {
    try {
      const payload = {
        recipient: { id: leadId },
        message: { text: message }
      };

      await axios.post(url, payload, {
        params: { access_token: FB_ACCESS_TOKEN }
      });

      // Log the broadcast interaction
      const lead = await Lead.findOne({ where: { phone: leadId } });
      if (lead) {
        await Interaction.create({
          leadId: lead.id,
          message: message,
          intent: 'BROADCAST',
          metadata: { type: 'broadcast' }
        });
      }
    } catch (error) {
      console.error(`Failed to send broadcast to ${leadId}:`, error.message);
    }
  }
}

function generateMediaResponse(attachmentTypes) {
  const responses = {
    image: "Thanks for sharing the image! Our team will review it shortly.",
    video: "We've received your video. Thank you for sharing!",
    audio: "We'll listen to your audio message and get back to you.",
    file: "We've received your file and will process it shortly.",
    default: "Thank you for sharing. We'll review your attachment and respond soon."
  };

  // Return the first matching response for the attachment types
  for (const type of attachmentTypes) {
    if (responses[type]) {
      return responses[type];
    }
  }
  return responses.default;
}

function generateResponse(intent, sentimentScore) {
  const positiveResponses = {
    PRICING_QUERY: 'Great! Our premium plans start at $99/month with amazing value. Would you like details?',
    CONTACT_REQUEST: "We'd love to connect! Reach us at contact@example.com or call 555-1234",
    APPOINTMENT: "Excellent! You can schedule an appointment at calendly.com/ourcompany",
    PRODUCT_INFO: "Wonderful! Our product features include... [details]",
    default: "That's great to hear! How else can I assist you today?"
  };

  const neutralResponses = {
    PRICING_QUERY: 'Our pricing starts at $99/month. Would you like more details?',
    CONTACT_REQUEST: 'You can reach us at contact@example.com or call 555-1234',
    APPOINTMENT: 'You can schedule an appointment at calendly.com/ourcompany',
    PRODUCT_INFO: 'Our product features include... [details]',
    default: 'Thanks for your message! How can I help you today?'
  };

  const negativeResponses = {
    PRICING_QUERY: 'I notice some concerns about pricing. Our basic plan starts at just $49/month - would that work better?',
    CONTACT_REQUEST: 'I apologize for any frustration. Please contact support@example.com for immediate assistance',
    APPOINTMENT: 'I understand your frustration. Our manager will contact you shortly to resolve this',
    PRODUCT_INFO: 'I apologize for any confusion. Let me clarify our product details...',
    default: 'I want to help resolve any issues. Could you share more details?'
  };

  if (sentimentScore > 2) {
    return positiveResponses[intent] || positiveResponses.default;
  } else if (sentimentScore < -1) {
    return negativeResponses[intent] || negativeResponses.default;
  }
  return neutralResponses[intent] || neutralResponses.default;
}

module.exports = { processMessages, broadcastMessage };
