import app from './app.js';
import http from 'http';
import { initializeWebSocket } from './websocket.js';

const server = http.createServer(app);
const port = 3001;

initializeWebSocket(server);

server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
