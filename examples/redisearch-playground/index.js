const CubejsServer = require('@cubejs-backend/server');

const options = {
  logger: (msg, params) => {
    console.log(`${msg}: ${JSON.stringify(params)}`);
  },
};

const server = new CubejsServer(options);


server.listen().then(({ version, port }) => {
  console.log(`🚀 Cube.js server (${version}) is listening on ${port}`);
}).catch(e => {
  console.error('Fatal error during server start: ');
  console.error(e.stack || e);
});
