require('dotenv').config();
const express = require('express');
const sequelize = require('./config/database');
const facebookRoutes = require('./routes/facebook');
const whatsappRoutes = require('./routes/whatsapp');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Database connection
sequelize.authenticate()
  .then(() => console.log('Database connected'))
  .catch(err => console.error('Database connection error:', err));

// Routes
app.use('/api/facebook', facebookRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
