const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Interaction = sequelize.define('Interaction', {
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  intent: {
    type: DataTypes.STRING,
    allowNull: false
  },
  sentiment: {
    type: DataTypes.FLOAT
  },
  metadata: {
    type: DataTypes.JSON
  }
}, {
  timestamps: true
});

module.exports = Interaction;
