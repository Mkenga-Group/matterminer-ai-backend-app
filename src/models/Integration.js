const { DataTypes, Model } = require('sequelize');

const sequelize = require('../config/database');

class Integration extends Model {}

Integration.init({
     id: {
	 type: DataTypes.UUID,
	 defaultValue: DataTypes.UUIDV4,
	 primaryKey: true
     },
     tenantId: {
	 type: DataTypes.INTEGER, // Match your Tenant ID type
	 allowNull: false
     },
     provider: {
         type: DataTypes.ENUM('google', 'microsoft', 'apple'),
         allowNull: false
     },
     status: {
	 type: DataTypes.ENUM('active', 'expired', 'revoked'),
         defaultValue: 'active'
     },
     // The "Magic" field: stores resourceId, channelId, etc. */
     metadata: {
	 type: DataTypes.JSON, // Use JSONB if on PostgreSQL
	 allowNull: true,
         defaultValue: {}
     },
     syncToken: {
         type: DataTypes.TEXT, 
	 allowNull: true
     },
     lastSyncAt: {
	 type: DataTypes.DATE,
         allowNull: true 
     }
   },{
	sequelize,
        modal: 'Integration',
	tableName: 'integrations',
	timestamps: true,   
	indexes: [
          { fields: ['tenantId', 'provider'] },
	  // Indexing specific keys inside JSON metadata for performance */
	  { fields: [sequelize.json('metadata.resourceId')] } 
	]
   });

module.exports = Integration;
