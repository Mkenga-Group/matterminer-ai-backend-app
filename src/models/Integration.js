const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Integration = sequelize.define('Integration', {
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
   }, {
	indexes: [
          { fields: ['tenantId', 'provider'] },
	  // Indexing specific keys inside JSON metadata for performance */
	  { fields: [sequelize.json('metadata.resourceId')] } 
	]
   });

   return Integration;
};
