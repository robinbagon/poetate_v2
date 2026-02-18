require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');

const app = express();
const server = http.createServer(app);

// Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: ['https://poetate.onrender.com', 'http://localhost:5000', 'https://poetate.org', 'https://www.poetate.org'],
    methods: ['GET', 'POST']
  }
});


// MongoDB connection - simplified now that we know it works
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err.message));

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// Routes
const authRoutes = require('./routes/auth');
const annotationsRouter = require('./routes/annotations');
const poemRoutes = require('./routes/poem');
const shareRoutes = require('./routes/shares'); // Moved all share logic here

app.use('/api/auth', authRoutes);
app.use('/api/annotations', annotationsRouter);
app.use('/api/poems', poemRoutes);
app.use('/api/shares', shareRoutes);

app.get('/reset-password/:token', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

// Socket.IO Logic (Moved to bottom for clarity)
io.on('connection', (socket) => {
  console.log('🔌 New connection:', socket.id);

  socket.on('join-poem-room', (poemId) => {
    if (poemId) {
      socket.join(poemId);
      console.log(`👥 Socket ${socket.id} joined room: ${poemId}`);
    }
  });

  // Re-usable emitter that BROADCASTS to everyone in the room EXCEPT the sender
  const handleBroadcast = (event, data) => {
    if (data.poemId) {
      // socket.to() sends to the room excluding the current socket
      socket.to(data.poemId).emit(event, data);
    }
  };

  // Ensure these all call handleBroadcast
  socket.on('new-annotation', (data) => handleBroadcast('new-annotation', data));
  socket.on('update-annotation-text', (data) => handleBroadcast('update-annotation-text', data));
  socket.on('update-annotation-position', (data) => handleBroadcast('update-annotation-position', data));
  socket.on('delete-annotation', (data) => handleBroadcast('delete-annotation', data));

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});