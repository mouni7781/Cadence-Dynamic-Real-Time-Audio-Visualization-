const serverless = require('serverless-http');
// This line imports the 'app' you exported from your main server.js file
// It goes up two directories (../../) to find it in the root
const { app } = require('../../server.js'); 

// This wraps your Express app and exports it as a Netlify function handler
module.exports.handler = serverless(app);
