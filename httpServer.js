// httpServer.js
const http = require('http');

/**
 * Crea y configura el servidor HTTP.
 * @param {WebSocket.Server} wss - La instancia del servidor WebSocket para obtener métricas.
 * @returns {http.Server} La instancia del servidor HTTP.
 */
function createHttpServer(wss) {
    const NODE_ENV = process.env.NODE_ENV || 'development';

    return http.createServer((req, res) => {
        // Habilitar CORS para despliegues en la nube como Azure
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            return res.end();
        }

        if (req.url === '/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'running',
                environment: NODE_ENV,
                connections: wss.clients.size, // número de clientes WS conectados
                uptime: process.uptime(),
            }));
        } else {
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Servidor WebSocket en funcionamiento para QuickSpeak (chat/tiempo real).');
        }
    });
}

module.exports = { createHttpServer };
