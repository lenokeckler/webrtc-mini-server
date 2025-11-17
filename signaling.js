// signaling.js
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');

// Mapa para almacenar clientes conectados con sus IDs de conexión internos
// connectionId -> ws
const clients = new Map();

// Mapa para usuarios de la app (Firebase UID, correo, etc.)
// appUserId -> ws
const appUsers = new Map();

/**
 * Configura toda la lógica de señalización / chat en una instancia del servidor WebSocket.
 * @param {WebSocket.Server} wss - La instancia del servidor WebSocket.
 */
function setupSignaling(wss) {
    wss.on('connection', ws => {
        // ID interno de la conexión (no es el UID de Firebase)
        const connectionId = uuidv4();
        clients.set(connectionId, ws);
        ws.connectionId = connectionId;
        ws.appUserId = null;

        console.log(`Nuevo cliente conectado: ${connectionId}`);

        // Heartbeat para detectar conexiones inactivas
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });

        // 1️⃣ Mandar al cliente su ID de conexión (opcional, la app puede ignorarlo)
        ws.send(JSON.stringify({ type: 'assign-id', userId: connectionId }));

        // 2️⃣ Manejo de mensajes entrantes
        ws.on('message', message => {
            try {
                const parsedMessage = JSON.parse(message);

                switch (parsedMessage.type) {
                    // REGISTRO DEL USUARIO DE LA APP (Firebase UID o correo)
                    case 'register-user': {
                        const appUserId = parsedMessage.appUserId;
                        if (!appUserId) {
                            console.warn(
                                `Mensaje register-user sin appUserId desde conexión ${connectionId}`
                            );
                            return;
                        }

                        // Guardamos el UID en el socket
                        ws.appUserId = appUserId;

                        // Si ya había otro socket con ese UID, lo podemos reemplazar
                        appUsers.set(appUserId, ws);

                        console.log(
                            `Conexión ${connectionId} registrada como appUserId=${appUserId}`
                        );

                        // Opcional: confirmación al cliente
                        ws.send(
                            JSON.stringify({
                                type: 'register-confirmed',
                                appUserId
                            })
                        );
                        break;
                    }

                    // MENSAJE DE CHAT APP-TO-APP
                    case 'chat-message': {
                        const toAppUserId = parsedMessage.toAppUserId;
                        if (!toAppUserId) {
                            console.warn(
                                `chat-message sin toAppUserId desde conexión ${connectionId}`
                            );
                            return;
                        }

                        const targetClient = appUsers.get(toAppUserId);

                        if (targetClient && targetClient.readyState === WebSocket.OPEN) {
                            const payload = {
                                type: 'chat-message',
                                // quién envía (UID de Firebase o correo)
                                fromAppUserId: ws.appUserId,
                                // por si querés usar un id de chat (speaker-5-es, etc.)
                                chatId: parsedMessage.chatId || null,
                                text: parsedMessage.text || '',
                                timestamp:
                                    parsedMessage.timestamp || Date.now(),
                                // debug opcional
                                fromConnectionId: connectionId
                            };

                            targetClient.send(JSON.stringify(payload));
                        } else {
                            console.warn(
                                `No se encontró conexión WebSocket para toAppUserId=${toAppUserId}`
                            );
                        }
                        break;
                    }

                    // OTROS TIPOS (si más adelante querés reusar para WebRTC u otra cosa)
                    default: {
                        console.log(
                            `Tipo de mensaje no manejado (${parsedMessage.type}) desde ${connectionId}`
                        );
                        break;
                    }
                }
            } catch (error) {
                console.error(
                    `Fallo al parsear mensaje o formato inválido de ${connectionId}:`,
                    message.toString(),
                    error
                );
            }
        });

        // 3️⃣ Limpiar al desconectar
        ws.on('close', () => {
            clients.delete(connectionId);

            if (ws.appUserId && appUsers.get(ws.appUserId) === ws) {
                appUsers.delete(ws.appUserId);
            }

            console.log(
                `Cliente desconectado: connectionId=${connectionId}, appUserId=${ws.appUserId}`
            );
        });
    });

    // Heartbeat que limpia conexiones muertas
    const interval = setInterval(() => {
        wss.clients.forEach(ws => {
            if (ws.isAlive === false) {
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => {
        clearInterval(interval);
    });
}

module.exports = { setupSignaling };
