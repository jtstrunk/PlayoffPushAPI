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

app.get('/login', (req, res) => {
  const { username, password } = req.query;
  console.log('loggin in with', username, password)

  if (!username || !password) {
    res.status(400).json({ error: 'Missing username or password' });
    return;
  }

  db.all(
    'SELECT * FROM Users WHERE username = ? AND password = ?',
    [username, password],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      if (rows.length > 0) {
        res.json({ success: true, user: rows[0] });
      } else {
        res.status(401).json({ success: false, message: 'Invalid username or password' });
      }
    }
  );
});

app.get('/getuserleagues', (req, res) => {
  const { username } = req.query;
  console.log('getting leagues for', username)

  db.all('SELECT li.id AS leagueid, li.name AS name, li.status AS status FROM LeagueInformation li JOIN LeagueUser lu ON li.id = lu.leagueid JOIN Users u ON lu.userid = u.playerid WHERE u.username = ?', 
    [username], (err, rows) => {
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
