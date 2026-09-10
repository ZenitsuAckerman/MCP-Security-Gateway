import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { EventBus } from './events/EventBus';
import { IncomingEvent } from './events/contract';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 34567;
const PUBLIC_DIR = path.join(__dirname, '../public');

const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  if (!filePath) filePath = '/index.html';
  
  const extname = path.extname(filePath);
  let contentType = 'text/html';
  switch (extname) {
    case '.js': contentType = 'text/javascript'; break;
    case '.css': contentType = 'text/css'; break;
    case '.json': contentType = 'application/json'; break;
  }

  const absolutePath = path.join(PUBLIC_DIR, filePath);
  
  if (req.method === 'POST' && req.url === '/approve') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      // Respond 200 OK
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'requested' }));
      
      // Simulate backend emitting an 'approved' event after a delay
      try {
        const payload = JSON.parse(body);
        setTimeout(() => {
          eventBus.emitAuditEvent({
            type: 'approved',
            server: payload.server,
            tool: payload.tool
          });
        }, 1000);
      } catch (err) {}
    });
    return;
  }
  
  if (req.method === 'POST' && req.url === '/attack/calculator-hijack') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'attack_requested' }));
    return;
  }
  
  if (req.method === 'POST' && req.url === '/attack/docgen-injection') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'attack_requested' }));
    return;
  }
  
  fs.readFile(absolutePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

const eventBus = new EventBus();
eventBus.start(PORT, server).then(() => {
  server.listen(PORT, () => {
    console.log(`Dashboard Server & Event Bus running at http://localhost:${PORT}/`);
  });
}).catch(err => {
  console.error('Failed to start EventBus:', err);
});

