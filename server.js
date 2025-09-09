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

app.get('/register', (req, res) => {
  const { username, password } = req.query;
  const emailaddress = 'testemail@gmail.com'; // constant or derived

  if (!username || !password) {
    res.status(400).json({ error: 'Missing username or password' });
    return;
  }

  db.run(
    'INSERT INTO Users (username, password, emailaddress) VALUES (?, ?, ?)',
    [username, password, emailaddress],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true, user: { username }, userId: this.lastID });
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

app.get('/getleaguesinformation', (req, res) => {
  const { id } = req.query;
  console.log('getting leagues for', id)

  db.all(`SELECT
      lu.leagueid,
      lu.draftposition,
      lu.userid,
      lu.teamname,
      u.username
    FROM LeagueUser lu
    JOIN Users u ON lu.userid = u.playerid
    WHERE leagueid = ?`, 
    [id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    res.json(rows);
  });
});

app.get('/draftplayer', (req, res) => {
  const { leagueid, userid, playerid } = req.query;
  
  // Validate that each value exists and is a number
  if (!leagueid || !userid || !playerid) {
    res.status(400).json({ error: 'leagueid, userid, and playerid are required.' });
    return;
  }

  const leagueidNum = Number(leagueid);
  const useridNum = Number(userid);
  const playeridNum = Number(playerid);

  db.run(
    `INSERT INTO UserTeam (leagueid, userid, playerid)
     VALUES (?, ?, ?)`,
    [leagueidNum, useridNum, playeridNum],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      // this.lastID gives the auto-incremented id of inserted row
      res.json({ success: true, id: this.lastID });
    }
  );
});

app.get('/getuserteam', (req, res) => {
  console.log('get user team');
  const { leagueid } = req.query;
  if (!leagueid) {
    res.status(400).json({ error: 'leagueid is required.' });
    return;
  }

  const leagueidNum = Number(leagueid);
  db.all(
    `SELECT
      ut.leagueid,
      ut.userid,
      ut.playerid,
      u.username,
      dp.name,
      dp.position,
      pp.wildcard,
      pp.divisional,
      pp.championship,
      pp.superbowl,
      pp.wildcard + pp.divisional + pp.championship + pp.superbowl as totalpoints
    FROM UserTeam ut
    JOIN Users u ON ut.userid = u.playerid
    JOIN DraftablePlayer dp ON ut.playerid = dp.playerid
    JOIN PlayerPoints pp ON dp.playerid = pp.playerid
    WHERE leagueid = ?;`,
    [leagueidNum],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      console.log('Rows returned:', rows.length);
      res.json(rows);
    }
  );
});


const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
