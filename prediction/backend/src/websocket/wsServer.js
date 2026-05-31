const WebSocket = require('ws');

function createWebSocketServer({ server }) {
  const clients = new Set();
  const wsServer = new WebSocket.Server({ server });

  wsServer.on('connection', (client) => {
    clients.add(client);
    console.log(`[frontend] client connected. activeClients=${clients.size}`);

    client.on('close', () => {
      clients.delete(client);
      console.log(`[frontend] client disconnected. activeClients=${clients.size}`);
    });

    client.on('error', (error) => {
      console.error('[frontend] client error:', error.message);
    });
  });

  wsServer.on('error', (error) => {
    console.error('[frontend] websocket server error:', error.message);
  });

  function broadcast(payload) {
    const message = JSON.stringify(payload);

    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  return {
    server: wsServer,
    broadcast,
  };
}

module.exports = {
  createWebSocketServer,
};
