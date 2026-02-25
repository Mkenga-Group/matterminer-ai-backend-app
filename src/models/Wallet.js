// src/models/wallet.model.js

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Wallet extends Model {}

Wallet.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true, // FIXED: Changed from primary_key to primaryKey
    allowNull: false
  },
  tenantId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  balance: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
    allowNull: false
  },
  tier: {
    type: DataTypes.ENUM('free', 'pro', 'enterprise'),
    defaultValue: 'free'
  },
  status: {
    type: DataTypes.ENUM('active', 'suspended', 'depleted'),
    defaultValue: 'active'
  }
},
{
  sequelize,
  modelName: 'Wallet',
  tableName: 'wallets',
  timestamps: true,
  indexes: [
    { fields: ['tenantId'] },
    { fields: ['status'] },
    { fields: ['providerEventId'] },
  ],
});

module.exports = Wallet;
