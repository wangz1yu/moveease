
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https'); 

// --- CONFIGURATION ---
// ⚠️⚠️⚠️ 必须在这里填入您的 Google Gemini API Key ⚠️⚠️⚠️
const GOOGLE_API_KEY = process.env.API_KEY || "AIzaSyC2sn2k3fdY-JmJsYnXivy8UPspbjdADq4"; 

// ⚠️⚠️⚠️ 微信小程序配置 (上线前请填入真实信息) ⚠️⚠️⚠️
const WX_APP_ID = process.env.WX_APP_ID || ""; 
const WX_APP_SECRET = process.env.WX_APP_SECRET || "";

const app = express();
const PORT = 3000;

// Dynamic import for Google GenAI
let GoogleGenAI, Type;
import('@google/genai').then(m => {
    GoogleGenAI = m.GoogleGenAI;
    Type = m.Type;
    console.log("✅ Google GenAI library loaded successfully.");
}).catch(err => {
    console.error("⚠️ WARNING: Failed to load '@google/genai'.");
});

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());

// Logger
app.use((req, res, next) => {
  const time = new Date().toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai' });
  console.log(`[${time}] Request: ${req.method} ${req.url}`);
  next();
});

// Uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
});
const upload = multer({ storage: storage });
app.use('/api/uploads', express.static(uploadDir));

// Database
const db = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  password: 'My8Uilbe@0VsN',
  database: 'moveease_db',
  waitForConnections: true,
  connectionLimit: 10,
  timezone: '+08:00' 
});

const runQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.query(query, params, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
};

// Init Tables
db.getConnection(async (err, connection) => {
  if (err) { console.error('❌ DB Connection Failed:', err.message); return; }
  console.log('✅ DB Connected!');
  connection.release();

  try {
      await runQuery(`CREATE TABLE IF NOT EXISTS user_stats (user_id INT PRIMARY KEY, total_workouts INT DEFAULT 0, current_streak INT DEFAULT 0, last_workout_date DATE)`);
      
      // Auto-Migrate Columns
      const checkCol = async (table, col, alterQuery) => {
          const res = await runQuery(`SELECT count(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'moveease_db' AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${col}'`);
          if (res[0].count === 0) {
              console.log(`🔄 Migrating: Adding ${col} to ${table}...`);
              await runQuery(alterQuery);
          }
      };

      await checkCol('user_stats', 'timer_end_at', "ALTER TABLE user_stats ADD COLUMN timer_end_at BIGINT DEFAULT 0");
      await checkCol('user_stats', 'timer_duration', "ALTER TABLE user_stats ADD COLUMN timer_duration INT DEFAULT 0");
      await checkCol('users', 'wechat_openid', "ALTER TABLE users ADD COLUMN wechat_openid VARCHAR(255) UNIQUE");
      
      await runQuery(`CREATE TABLE IF NOT EXISTS announcements (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255) NOT NULL, content TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  } catch (e) { console.error("Table init error", e); }
});

// --- ROUTES ---

app.get('/', (req, res) => res.send('✅ SitClock Backend v5.0 Running'));

app.post('/api/upload-avatar', upload.single('avatar'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    res.json({ url: `/api/uploads/${req.file.filename}` });
});

// Auth
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (results.length > 0) return res.status(409).json({ message: 'Email exists' });
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      db.query('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [name, email, hashedPassword], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Registered', user: { id: result.insertId.toString(), name, email, avatar: '' } });
      });
    } catch (e) { res.status(500).json({ error: 'Server error' }); }
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (results.length === 0) return res.status(401).json({ message: 'Invalid credentials' });
    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
    res.json({ message: 'Login success', user: { id: user.id.toString(), name: user.username, email: user.email, avatar: user.avatar_url || '' } });
  });
});

// WeChat Login
app.post('/api/wechat-login', async (req, res) => {
    const { code, userInfo } = req.body; 
    let openid = null;
    
    if (WX_APP_ID && WX_APP_SECRET && !code.startsWith('mock')) {
        try {
            const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${WX_APP_ID}&secret=${WX_APP_SECRET}&js_code=${code}&grant_type=authorization_code`;
            const wxRes = await new Promise((resolve) => https.get(url, r => { let d=''; r.on('data', c=>d+=c); r.on('end', ()=>resolve(JSON.parse(d))); }));
            if (wxRes.errcode) return res.status(400).json({ error: wxRes.errmsg });
            openid = wxRes.openid;
        } catch (e) { return res.status(500).json({ error: "WeChat connect failed" }); }
    } else {
        openid = `mock_openid_${code}`; 
    }

    db.query('SELECT * FROM users WHERE wechat_openid = ?', [openid], async (err, results) => {
        if (results.length > 0) {
            const user = results[0];
            return res.json({ message: 'Login success', user: { id: user.id.toString(), name: user.username, email: user.email || '', avatar: user.avatar_url || '' } });
        } else {
            const name = userInfo?.nickName || `WeChat User`;
            const avatar = userInfo?.avatarUrl || '';
            const mockEmail = `${openid}@wechat.com`;
            try {
                const hashedPassword = await bcrypt.hash(openid, 10);
                db.query('INSERT INTO users (username, email, password_hash, avatar_url, wechat_openid) VALUES (?, ?, ?, ?, ?)', 
                [name, mockEmail, hashedPassword, avatar, openid], (err, result) => {
                    res.status(201).json({ message: 'Registered', user: { id: result.insertId.toString(), name, email: mockEmail, avatar } });
                });
            } catch (e) { res.status(500).json({ error: 'Server error' }); }
        }
    });
});

// Profile Update
app.post('/api/update-profile', (req, res) => {
  const { id, name, avatar } = req.body;
  db.query('UPDATE users SET username = ?, avatar_url = ? WHERE id = ?', [name, avatar, id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Updated', user: { id, name, avatar } });
  });
});

// Announcements
app.get('/api/announcements', (req, res) => {
    db.query('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 10', (err, r) => res.json(r || []));
});
app.post('/api/announcements', (req, res) => {
    db.query('INSERT INTO announcements (title, content) VALUES (?, ?)', [req.body.title, req.body.content], () => res.json({ message: 'Posted' }));
});

// Stats
app.get('/api/stats', (req, res) => {
    const { userId } = req.query;
    if(!userId) return res.status(400).json({error: "Missing userId"});

    const statsQuery = `SELECT us.*, u.username, u.avatar_url FROM user_stats us JOIN users u ON us.user_id = u.id WHERE us.user_id = ?`;
    db.query(statsQuery, [userId], (err, statsResults) => {
        const activityQuery = `SELECT id, user_id, DATE_FORMAT(activity_date, '%Y-%m-%d') as activity_date_str, sedentary_minutes, active_breaks FROM daily_activities WHERE user_id = ? AND activity_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) ORDER BY activity_date ASC`;
        db.query(activityQuery, [userId], (err, dailyResults) => {
             if (statsResults.length === 0) {
                 db.query('SELECT username, avatar_url FROM users WHERE id = ?', [userId], (err, userRes) => {
                     const userInfo = userRes[0] || {};
                     res.json({ stats: { total_workouts: 0, current_streak: 0, last_workout_date: null, timer_end_at: 0, timer_duration: 0, username: userInfo.username, avatar_url: userInfo.avatar_url }, activity: dailyResults });
                 });
             } else {
                 res.json({ stats: statsResults[0], activity: dailyResults });
             }
        });
    });
});

app.post('/api/stats', (req, res) => {
    const { userId, totalWorkouts, currentStreak, lastWorkoutDate, todaySedentaryMinutes, todayBreaks } = req.body;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }); 
    
    db.getConnection((err, conn) => {
        conn.beginTransaction(err => {
            conn.query(`INSERT INTO user_stats (user_id, total_workouts, current_streak, last_workout_date) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE total_workouts = VALUES(total_workouts), current_streak = VALUES(current_streak), last_workout_date = VALUES(last_workout_date)`, 
            [userId, totalWorkouts, currentStreak, lastWorkoutDate || null], (err) => {
                 if (err) { conn.rollback(() => conn.release()); return res.status(500).send(err); }
                 conn.query(`INSERT INTO daily_activities (user_id, activity_date, sedentary_minutes, active_breaks) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE sedentary_minutes = VALUES(sedentary_minutes), active_breaks = VALUES(active_breaks)`, 
                 [userId, today, todaySedentaryMinutes, todayBreaks], (err) => {
                     conn.commit(err => { conn.release(); res.json({message: "Synced"}); });
                 });
            });
        });
    });
});

app.post('/api/timer', (req, res) => {
    db.query(`INSERT INTO user_stats (user_id, timer_end_at, timer_duration) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE timer_end_at = VALUES(timer_end_at), timer_duration = VALUES(timer_duration)`, 
    [req.body.userId, req.body.endAt, req.body.duration], () => res.json({ message: "Timer saved" }));
});

// AI Gen (With Fallback)
app.post('/api/generate-workout', async (req, res) => {
    const { focusArea, language } = req.body;
    
    const fallbackExercises = [
        { id: 'f1', name: language==='zh'?'颈部拉伸':'Neck Stretch', duration: 45, category: focusArea, description: language==='zh'?'轻轻将头部向左侧倾斜，保持15秒，然后换右侧。':'Tilt head to left, hold 15s, switch.', imageUrl: 'https://picsum.photos/400/300?random=101' },
        { id: 'f2', name: language==='zh'?'肩部环绕':'Shoulder Roll', duration: 60, category: focusArea, description: language==='zh'?'向前滚动肩膀10次，然后向后滚动10次。':'Roll shoulders forward 10 times, then backward.', imageUrl: 'https://picsum.photos/400/300?random=102' },
        { id: 'f3', name: language==='zh'?'深呼吸':'Deep Breath', duration: 30, category: focusArea, description: language==='zh'?'深吸气4秒，屏息4秒，缓慢呼气4秒。':'Inhale 4s, hold 4s, exhale 4s.', imageUrl: 'https://picsum.photos/400/300?random=103' }
    ];

    if (!GoogleGenAI || !GOOGLE_API_KEY || GOOGLE_API_KEY.includes("AIzaSyC")) {
        console.warn("⚠️ AI Service unavailable/unconfigured. Sending fallback.");
        return res.json(fallbackExercises);
    }

    try {
        const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
        const model = "gemini-2.5-flash";
        const prompt = `Create 3 simple exercises for ${focusArea}. JSON format. ${language==='zh'?'Chinese':'English'}. 'category' must be '${focusArea}'.`;
        
        const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });
        
        let rawText = response.text || "[]";
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const exercises = JSON.parse(rawText).map((ex, i) => ({ ...ex, imageUrl: `https://picsum.photos/400/300?random=${Date.now()+i}` }));
        res.json(exercises);
    } catch (error) {
        console.error("AI Error:", error.message);
        res.json(fallbackExercises); // Fallback on error
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔑 API Key: ${GOOGLE_API_KEY.startsWith("AIza") ? "Configured" : "❌ Use fallback mode"}`);
});
