require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((error) => console.error('Failed to connect to MongoDB:', error));

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/socket.io', express.static('node_modules/socket.io/client-dist'));

const shareRoutes = require('./routes/shares');
app.use('/api/shares', shareRoutes);


// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'Ahr%$Okk54stQQ',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24
  }
}));

// Routes
const authRoutes = require('./routes/auth');
const annotationsRouter = require('./routes/annotations');
const poemRoutes = require('./routes/poem');

app.use('/api/auth', authRoutes);
app.use('/api/annotations', annotationsRouter);
app.use('/api/poems', poemRoutes);

// Serve HTML pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/annotation.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'annotation.html')));

// Socket.IO
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('new-annotation', (data) => {
    socket.broadcast.emit('new-annotation', data);
  });

  socket.on('update-annotation-position', (data) => {
    socket.broadcast.emit('update-annotation-position', data);
  });

  socket.on('delete-annotation', (data) => {
    socket.broadcast.emit('delete-annotation', data);
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
