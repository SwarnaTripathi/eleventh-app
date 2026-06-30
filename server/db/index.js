/**
 * DB index — selects mock or Firestore based on DEMO_MODE.
 * All services import from here, never directly from mockDb or firestore.
 */
const config = require('../config');

module.exports = config.DEMO_MODE
  ? require('./mockDb')
  : require('./firestore');
