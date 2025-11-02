const express = require('express');
const http = require('http');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const upload = multer();
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(cors());

const io = new Server(server, {
  cors: {
    origin: '*', // or restrict to your clients
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

const db = new sqlite3.Database('./playoffpush.db', (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Connected to SQLite database');
});

app.get('/', (req, res) => {
  res.send('<h1>Hello, Express.js Server!</h1>');
});


io.on('connection', (socket) => {
  // Expect client to send joinRoom event with name and id
  socket.on('joinRoom', ({ name, id }) => {
    const roomName = `draft-${name}-${id}`;
    socket.join(roomName);
    console.log(`Socket ${socket.id} joined room ${roomName}`);
  });

  socket.on('draftPlayer', (data) => {
    const roomName = `draft-${data.leaguename}-${data.id}`;
    // Broadcast only to this room except sender:
    socket.to(roomName).emit('playerDrafted', data);
  });
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

app.get('/getuserinformation', (req, res) => {
  const { username } = req.query;
  console.log('getting leagues for', username)

  db.all('SELECT username, emailaddress FROM Users WHERE username = ?', 
    [username], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/getuserprofilepicture', (req, res) => {
  const { username } = req.query;

  db.get(`SELECT image_data FROM UserImages WHERE username = ?`, [username], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (row && row.image_data) {
      res.contentType('image/png'); // or jpg
      res.send(row.image_data);
    } else {
      res.sendFile(path.join(__dirname, 'public', 'profile.png'));
    }
  });
});


app.post('/insertuserprofilepicture', upload.single('profile'), (req, res) => {
  const username = req.query.username;
  const imgBuffer = req.file.buffer;
  db.run(`INSERT OR REPLACE INTO UserImages (username, image_data) VALUES (?, ?)`, [username, imgBuffer], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ success: true });
    }
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

app.get('/changepassword', (req, res) => {
  const { username, currentPassword, newPassword } = req.query;

  db.run(
    'UPDATE Users SET password = ? WHERE password = ? AND username = ?',
    [newPassword, currentPassword, username],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      // No rows updated means incorrect current password or username
      if (this.changes === 0) {
        res.status(400).json({ error: 'Incorrect username or current password' });
        return;
      }
      res.json({ success: true, user: { username }, userId: this.lastID });
    }
  );
});


app.get('/getuserleagues', (req, res) => {
  const { username } = req.query;
  console.log('getting leagues for', username)

  db.all(`SELECT li.id AS leagueid, 
      li.name AS name, 
      li.status AS status 
      FROM LeagueInformation li 
      JOIN LeagueUser lu ON li.id = lu.leagueid 
      JOIN Users u ON lu.userid = u.playerid 
      WHERE u.username = ?`, 
    [username], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    res.json(rows);
  });
});

app.get('/getleagueusers', (req, res) => {
  const { leagueid } = req.query;
  console.log('getting leagues for', leagueid)

  db.all(`select userid, teamname from LeagueUser where leagueid = ? order by draftposition`, 
    [leagueid], (err, rows) => {
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

app.get('/getspecificleagueinformation', (req, res) => {
  const { leagueid } = req.query;
  console.log('getting league information for', leagueid)

  db.all(`SELECT
      id,
      name,
      status
    FROM LeagueInformation
    WHERE id = ?`, 
    [leagueid], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    res.json(rows);
  });
});

app.get('/getleaguepassword', (req, res) => {
  const { leagueid } = req.query;

  db.all(`SELECT
      password
    FROM LeagueInformation
    WHERE id = ?`, 
    [leagueid], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    res.json(rows);
  });
});

app.get('/draftplayer', (req, res) => {
  const { leagueid, userid, playerid, draftpick } = req.query;
  
  // Validate that each value exists and is a number
  if (!leagueid || !userid || !playerid) {
    res.status(400).json({ error: 'leagueid, userid, and playerid are required.' });
    return;
  }

  const leagueidNum = Number(leagueid);
  const useridNum = Number(userid);
  const playeridNum = Number(playerid);
  const draftpickNum = Number(draftpick);

  db.run(
    `INSERT INTO UserTeam (leagueid, userid, playerid, draftpick)
     VALUES (?, ?, ?, ?)`,
    [leagueidNum, useridNum, playeridNum, draftpickNum],
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
      ut.draftpick,
      u.username,
      dp.name,
      dp.position,
      dp.team as teamname,
      COALESCE(pp.wildcard, 0) AS wildcard,
      COALESCE(pp.divisional, 0) AS divisional,
      COALESCE(pp.championship, 0) AS championship,
      COALESCE(pp.superbowl, 0) AS superbowl,
      COALESCE(pp.wildcard, 0) + COALESCE(pp.divisional, 0) + COALESCE(pp.championship, 0) + COALESCE(pp.superbowl, 0) AS totalpoints
    FROM UserTeam ut
    JOIN Users u ON ut.userid = u.playerid
    JOIN DraftablePlayer dp ON ut.playerid = dp.playerid
    LEFT JOIN PlayerPoints pp ON dp.playerid = pp.playerid
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

app.get('/setstatus', (req, res) => {
  const { leagueid, status } = req.query;
  const leagueidNum = Number(leagueid);

  db.run(
    `UPDATE LeagueInformation SET status = ? WHERE id = ?`,
    [status, leagueidNum],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true, id: leagueidNum, leagueStatus: status});
    }
  );
});

app.get('/deleteleague', (req, res) => {
  const { leagueid } = req.query;
  console.log('deleting league');

  db.run('DELETE FROM UserTeam WHERE leagueid = ?', [leagueid], function(err1) {
    if (err1) return res.status(500).json({ error: err1.message });

    db.run('DELETE FROM LeagueUser WHERE leagueid = ?', [leagueid], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });

      db.run('DELETE FROM LeagueInformation WHERE id = ?', [leagueid], function(err3) {
        if (err3) return res.status(500).json({ error: err3.message });

        res.json({ status: 'deleted all league data' });
      });
    });
  });
});


app.get('/createleague', (req, res) => {
  const { leaguename } = req.query;
  const status = 'Pre-Draft'

  const numbers = '0123456789';
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let password = '';
  for (let i = 0; i < 4; i++) {
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  for (let i = 0; i < 4; i++) {
    password += letters.charAt(Math.floor(Math.random() * letters.length));
  }

  console.log('creating league', leaguename, 'with status', status, 'with secure password', password)
  db.run(
    `INSERT INTO LeagueInformation(name, status, password) VALUES (?, ?, ?)`,
    [leaguename, status, password],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true, id: this.lastID });
    }
  );
});

app.get('/leagueadduser', (req, res) => {
  const { leagueid, teamname } = req.query;
  const leagueidNum = Number(leagueid);

  db.get(
    `SELECT playerid FROM users WHERE username = ?`,
    [teamname],
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (!row) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      const userid = row.playerid;

      db.run(
        `INSERT INTO LeagueUser (leagueid, userid, teamname) VALUES (?, ?, ?)`,
        [leagueidNum, userid, teamname],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ success: true, id: this.lastID });
        }
      );
    }
  );
});

app.get('/checkleaguepassword', (req, res) => {
  const { id, inputpassword } = req.query;

  db.get(
    `SELECT * FROM LeagueInformation WHERE id = ? AND password = ?`,
    [id, inputpassword],
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (row) {
        // Password matches league with this id
        res.json({ success: true, leagueId: row.id });
      } else {
        // No matching league found or password incorrect
        res.json({ success: false, message: 'Invalid league ID or password' });
      }
    }
  );
});

app.get('/getdraftedplayers', (req, res) => {
  db.all(
    `SELECT DISTINCT ut.playerid, dp.name, dp.position, dp.team,
       pp.wildcard, pp.divisional, pp.championship, pp.superbowl
      FROM UserTeam ut
      JOIN DraftablePlayer dp ON ut.playerid = dp.playerid
      LEFT JOIN PlayerPoints pp ON ut.playerid = pp.playerid;`,
    [],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      res.json(rows);
    }
  );
});

// Expecting an array of objects { playerid, week, points }
app.post('/updateplayerstats', (req, res) => {
  const updates = req.body;
  const year = '24-25';
  const validWeeks = ['wildcard', 'divisional', 'championship', 'superbowl'];

  if (!Array.isArray(updates)) {
    return res.status(400).json({ error: 'Expected an array of updates' });
  }

  // For each update, run UPSERT SQL
  const updatePromises = updates.map(({ playerid, week, points }) => {
    return new Promise((resolve, reject) => {
      if (!validWeeks.includes(week)) {
        return reject(new Error(`Invalid week value: ${week}`));
      }

      // Default zero points for all weeks except the updated one
      const weeksObj = { wildcard: 0, divisional: 0, championship: 0, superbowl: 0 };
      weeksObj[week] = points;

      // UPSERT SQL: insert or update on conflict on (playerid, year)
      const sql = `
        INSERT INTO PlayerPoints (playerid, year, wildcard, divisional, championship, superbowl)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(playerid, year) DO UPDATE SET
          ${week} = excluded.${week}
      `;

      db.run(
        sql,
        [
          playerid,
          year,
          weeksObj.wildcard,
          weeksObj.divisional,
          weeksObj.championship,
          weeksObj.superbowl,
        ],
        function (err) {
          if (err) {
            console.error('SQLite error:', err.message);
            reject(err);
          } else {
            resolve({ playerid, changes: this.changes });
          }
        }
      );
    });
  });

  Promise.allSettled(updatePromises).then((results) => {
    const errors = results.filter((r) => r.status === 'rejected').map((r) => r.reason.message);
    if (errors.length) {
      return res.status(500).json({ error: errors });
    }
    res.json({ success: true, updates: results.map((r) => r.value) });
  });
});

