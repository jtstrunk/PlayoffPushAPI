const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const app = express();
app.use(cors());

const db = new sqlite3.Database('./playoffpush.db', (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Connected to SQLite database');
});

app.get('/', (req, res) => {
  res.send('<h1>Hello, Express.js Server!</h1>');
});

app.get('/getplayers', (req, res) => {
  db.all('SELECT * FROM DraftablePlayer', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
