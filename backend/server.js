// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', require('./routes/api'));


// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Console
const PORT = process.env.PORT || 3000; //  加上 || 3000 作為安全預設值
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
