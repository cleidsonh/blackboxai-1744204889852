const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Trend = sequelize.define('Trend', {
  search_term: {
    type: DataTypes.STRING,
    allowNull: false
  },
  frequency: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  category: {
    type: DataTypes.STRING
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['search_term']
    }
  ]
});

module.exports = Trend;
