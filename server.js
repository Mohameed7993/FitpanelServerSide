//server.js

const express = require('express');
const app = express();
require('dotenv').config();

// Middleware to parse JSON bodies
app.use(express.json());


app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, PUT, POST, PATCH, DELETE, OPTIONS'
  );
  next();
});

const con = require('./routes/index');
app.use('/MoDumbels', con);

app.get('*', function (req, res) {
  res.send('404 not found');
});


app.listen(4000, () => console.log('Server running on port 4000'));
