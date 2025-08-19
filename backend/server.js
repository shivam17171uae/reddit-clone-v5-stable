import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import path from 'path';
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';
import multer from 'multer';
import fs from 'fs';
import { URL } from 'url'; // <--- CHANGE #1: ADDED THIS LINE

const app = express();
const server = http.createServer(app);
const port = 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';
const POSTS_PER_PAGE = 10;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://user:password@db-v6:5432/mydatabase' });
const { window } = new JSDOM('');
const dompurify = DOMPurify(window);

const wss = new WebSocketServer({ noServer: true }); // <--- CHANGE #2: THIS LINE IS MODIFIED
const clients = new Map();

// <--- CHANGE #3: THIS ENTIRE BLOCK IS NEW
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

  if (pathname === '/socket') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});
// --- END OF NEW BLOCK ---

wss.on('connection', (ws, req) => {
    const urlParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
    const token = urlParams.get('token');
  
    if (token) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (!err && user) {
        clients.set(user.id, ws);
        ws.userId = user.id;
      } else {
        ws.close();
      }
    });
  } else {
    ws.close();
  }
  ws.on('close', () => { if (ws.userId) clients.delete(ws.userId); });
});


const sendNotification = (userId, notification) => {
  const client = clients.get(userId);
  if (client && client.readyState === 1) { // 1 is WebSocket.OPEN
    client.send(JSON.stringify({ type: 'NEW_NOTIFICATION', payload: notification }));
  }
};

const initializeDatabase = async () => {
    const queryText = `CREATE TABLE IF NOT EXISTS users ( id SERIAL PRIMARY KEY, username VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ); CREATE TABLE IF NOT EXISTS communities ( id SERIAL PRIMARY KEY, name VARCHAR(50) UNIQUE NOT NULL, creator_id INTEGER REFERENCES users(id), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ); CREATE TABLE IF NOT EXISTS posts ( id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, community_id INTEGER REFERENCES communities(id) ON DELETE CASCADE, title VARCHAR(255) NOT NULL, content TEXT, post_type VARCHAR(10) DEFAULT 'text', url TEXT, image_url TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ); CREATE TABLE IF NOT EXISTS comments ( id SERIAL PRIMARY KEY, post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE, content TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ); CREATE TABLE IF NOT EXISTS votes ( user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE, comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE, vote_value INTEGER NOT NULL CHECK (vote_value IN (-1, 1)), CONSTRAINT unique_vote UNIQUE (user_id, post_id, comment_id) ); CREATE TABLE IF NOT EXISTS notifications ( id SERIAL PRIMARY KEY, recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE, sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE, post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE, comment_id INTEGER REFERENCES comments(id), type VARCHAR(50) NOT NULL, is_read BOOLEAN DEFAULT false, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`;
    try { await pool.query(queryText); console.log("Tables created."); } catch (err) { console.error("Error creating tables", err.stack); }
};

const connectWithRetry = async () => {
    try { await pool.connect(); console.log("Connected to DB."); await initializeDatabase(); } catch (err) { console.error("DB connection failed, retrying...", err); setTimeout(connectWithRetry, 5000); }
};
connectWithRetry();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) { req.user = null; return next(); }
    jwt.verify(token, JWT_SECRET, (err, user) => { req.user = err ? null : user; next(); });
};
app.use(authenticateToken);

const requireAuth = (req, res, next) => { if (!req.user) return res.sendStatus(401); next(); };

app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send('Username and password are required.');
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username', [username, hashedPassword]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).send('Username already exists.');
        res.status(500).send('Server error');
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user || !await bcrypt.compare(password, user.password_hash)) {
            return res.status(401).send('Invalid credentials');
        }
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

app.post('/api/upload', requireAuth, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

app.get('/api/posts', async (req, res) => {
    const { sort = 'hot', communityName, page = 1 } = req.query;
    const userId = req.user ? req.user.id : null;
    const offset = (page - 1) * POSTS_PER_PAGE;

    let orderBy;
    switch (sort) {
        case 'new':
            orderBy = 'p.created_at DESC';
            break;
        case 'top':
            orderBy = 'votes DESC';
            break;
        default: // hot
            orderBy = `LOG(GREATEST(ABS(COALESCE(SUM(v.vote_value), 0)), 1)) * SIGN(COALESCE(SUM(v.vote_value), 0)) + (EXTRACT(EPOCH FROM p.created_at) / 45000) DESC`;
    }

    const communityFilter = communityName ? `WHERE c.name = $2` : '';
    const queryParams = communityName ? [userId, communityName] : [userId];

    const query = `
        SELECT p.id, p.title, p.content, p.post_type, p.url, p.image_url, p.created_at, u.username, c.name as community_name,
        COALESCE(SUM(v.vote_value), 0) AS votes,
        (SELECT vote_value FROM votes WHERE user_id = $1 AND post_id = p.id) as user_vote,
        (SELECT COUNT(*) FROM comments com WHERE com.post_id = p.id) AS comment_count
        FROM posts p
        JOIN users u ON p.user_id = u.id
        JOIN communities c ON p.community_id = c.id
        LEFT JOIN votes v ON p.id = v.post_id
        ${communityFilter}
        GROUP BY p.id, u.username, c.name
        ORDER BY ${orderBy}
        LIMIT ${POSTS_PER_PAGE} OFFSET ${offset};
    `;

    try {
        const { rows } = await pool.query(query, queryParams);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.post('/api/posts', requireAuth, async (req, res) => {
    const { title, content, community_id, post_type, url, image_url } = req.body;
    const sanitizedContent = dompurify.sanitize(content);
    try {
        const r = await pool.query('INSERT INTO posts(user_id, title, content, community_id, post_type, url, image_url) VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *', [req.user.id, title, sanitizedContent, community_id, post_type, url, image_url]);
        res.status(201).json(r.rows[0]);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

app.get('/api/posts/:postId', async (req, res) => {
    const { postId } = req.params;
    const uId = req.user ? req.user.id : null;
    const q = `SELECT p.id, p.title, p.content, p.post_type, p.url, p.image_url, p.created_at, u.username, c.name as community_name,
               COALESCE(SUM(v.vote_value), 0) AS votes,
               (SELECT vote_value FROM votes WHERE user_id = $1 AND post_id = p.id) as user_vote
               FROM posts p
               JOIN users u ON p.user_id = u.id
               JOIN communities c ON p.community_id = c.id
               LEFT JOIN votes v ON p.id = v.post_id
               WHERE p.id = $2
               GROUP BY p.id, u.username, c.name;`;
    try {
        const r = await pool.query(q, [uId, postId]);
        if (r.rows.length === 0) return res.status(404).send('Post not found');
        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

app.post('/api/posts/:postId/comments', requireAuth, async (req, res) => {
    const { postId } = req.params;
    const { content, parentId } = req.body;
    const sanitizedContent = dompurify.sanitize(content);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const commentRes = await client.query('INSERT INTO comments(post_id, user_id, content, parent_id) VALUES($1, $2, $3, $4) RETURNING *', [postId, req.user.id, sanitizedContent, parentId]);
        const newComment = commentRes.rows[0];

        let recipientId;
        if (parentId) {
            const parentCommentRes = await client.query('SELECT user_id FROM comments WHERE id = $1', [parentId]);
            recipientId = parentCommentRes.rows[0]?.user_id;
        } else {
            const postRes = await client.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
            recipientId = postRes.rows[0]?.user_id;
        }

        if (recipientId && recipientId !== req.user.id) {
            const notifRes = await client.query('INSERT INTO notifications(recipient_id, sender_id, post_id, comment_id, type) VALUES($1, $2, $3, $4, $5) RETURNING *', [recipientId, req.user.id, postId, newComment.id, 'comment_reply']);
            sendNotification(recipientId, notifRes.rows[0]);
        }
        await client.query('COMMIT');
        res.status(201).json(newComment);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).send('Server error');
    } finally {
        client.release();
    }
});

app.get('/api/posts/:postId/comments', async (req, res) => {
    const { postId } = req.params;
    const q = `SELECT c.*, u.username FROM comments c JOIN users u ON c.user_id = u.id WHERE c.post_id = $1 ORDER BY c.created_at DESC;`;
    try {
        const { rows } = await pool.query(q, [postId]);
        const nest = (cs, pId = null) => cs.filter(c => c.parent_id === pId).map(c => ({...c, children: nest(cs, c.id) }));
        res.json(nest(rows));
    } catch (err) {
        res.status(500).send('Server error');
    }
});

app.get('/api/users/:username', async (req, res) => {
    const { username } = req.params;
    const query = `SELECT u.id, u.username, u.created_at,
                   (SELECT COALESCE(SUM(v.vote_value), 0) FROM votes v JOIN posts p ON v.post_id = p.id WHERE p.user_id = u.id) as post_karma,
                   (SELECT COALESCE(SUM(v.vote_value), 0) FROM votes v JOIN comments c ON v.comment_id = c.id WHERE c.user_id = u.id) as comment_karma
                   FROM users u WHERE u.username = $1;`;
    try {
        const r = await pool.query(query, [username]);
        if (r.rows.length === 0) return res.status(404).send('User not found');
        res.json(r.rows[0]);
    } catch (e) {
        res.status(500).send('Server Error');
    }
});

app.get('/api/notifications', requireAuth, async (req, res) => {
    const query = `SELECT n.*, u.username as sender_username FROM notifications n JOIN users u ON n.sender_id = u.id WHERE n.recipient_id = $1 ORDER BY n.created_at DESC;`;
    try {
        const { rows } = await pool.query(query, [req.user.id]);
        res.json(rows);
    } catch (e) {
        res.status(500).send('Server error');
    }
});

app.post('/api/notifications/read', requireAuth, async (req, res) => {
    try {
        await pool.query('UPDATE notifications SET is_read = true WHERE recipient_id = $1', [req.user.id]);
        res.sendStatus(204);
    } catch (e) {
        res.status(500).send('Server error');
    }
});

app.post('/api/vote', requireAuth, async (req, res) => {
    const { postId, voteValue } = req.body;
    try {
        if (voteValue === 0) {
            await pool.query('DELETE FROM votes WHERE user_id = $1 AND post_id = $2', [req.user.id, postId]);
        } else {
            const q = `INSERT INTO votes(user_id, post_id, vote_value) VALUES($1, $2, $3)
                       ON CONFLICT(user_id, post_id, comment_id) DO UPDATE SET vote_value = $3;`;
            await pool.query(q, [req.user.id, postId, voteValue]);
        }
        res.sendStatus(200);
    } catch (e) {
        res.status(500).send('Server error');
    }
});

app.get('/api/communities', async (req, res) => {
    try {
        const r = await pool.query('SELECT id, name FROM communities ORDER BY name');
        res.json(r.rows);
    } catch (e) {
        res.status(500).send('Server Error');
    }
});

app.post('/api/communities', requireAuth, async (req, res) => {
    const { name } = req.body;
    try {
        const r = await pool.query('INSERT INTO communities(name, creator_id) VALUES($1, $2) RETURNING *', [name, req.user.id]);
        res.status(201).json(r.rows[0]);
    } catch (e) {
        if (e.code === '23505') return res.status(409).send('Community name exists.');
        res.status(500).send('Server error');
    }
});

app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim() === '') {
    return res.json([]);
  }
  const searchQuery = `%${q}%`;
  try {
    const query = `
      (SELECT 'post' as type, p.id, p.title as name, c.name as context FROM posts p JOIN communities c ON p.community_id = c.id WHERE p.title ILIKE $1 LIMIT 5)
      UNION
      (SELECT 'community' as type, id, name, NULL as context FROM communities WHERE name ILIKE $1 LIMIT 5)
      UNION
      (SELECT 'user' as type, id, username as name, NULL as context FROM users WHERE username ILIKE $1 LIMIT 5)`;
    const { rows } = await pool.query(query, [searchQuery]);
    res.json(rows);
  } catch (err) {
    console.error("Search error", err);
    res.status(500).send('Server error');
  }
});


app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
server.listen(port, () => { console.log(`Server listening on port ${port}`); });