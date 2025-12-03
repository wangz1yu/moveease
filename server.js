
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https'); // Used for WeChat API

// --- CONFIGURATION ---
// ⚠️⚠️⚠️ 必须在这里填入您的 Google Gemini API Key ⚠️⚠️⚠️
const GOOGLE_API_KEY = process.env.API_KEY || "YOUR_REAL_API_KEY_HERE"; 

// ⚠️⚠️⚠️ 微信小程序配置 (上线前请填入真实信息) ⚠️⚠️⚠️
const WX_APP_ID = process.env.WX_APP_ID || ""; 
const WX_APP_SECRET = process.env.WX_APP_SECRET || "";

const app = express();
const PORT = 3000;

// Dynamic import for Google GenAI (ESM package)
let GoogleGenAI, Type;

import('@google/genai').then(m => {
    GoogleGenAI = m.GoogleGenAI;
    Type = m.Type;
    console.log("✅ Google GenAI library loaded successfully.");
}).catch(err => {
    console.error("⚠️ WARNING: Failed to load '@google/genai'.");
    console.error("⚠️ Please run 'npm install @google/genai' on your server.");
});

// 1. Middleware
app.use(cors({
    origin: true, 
    credentials: true
}));
app.use(bodyParser.json());

// Request Logger
app.use((req, res, next) => {
  const time = new Date().toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai' });
  console.log(`[${time}] Request: ${req.method} ${req.url}`);
  next();
});

// --- Image Upload Configuration ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });
app.use('/api/uploads', express.static(uploadDir));

// 2. Database Connection
const db = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  password: 'My8Uilbe@0VsN',
  database: 'moveease_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
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

// 3. Init: Test Connection & Create Tables
db.getConnection(async (err, connection) => {
  if (err) {
    console.error('❌ CRITICAL: Cannot connect to DB.', err.message);
    return;
  }
  console.log('✅ DB Connected (Localhost Mode)!');
  connection.release();

  try {
      // Create user_stats if not exists
      await runQuery(`CREATE TABLE IF NOT EXISTS user_stats (user_id INT PRIMARY KEY, total_workouts INT DEFAULT 0, current_streak INT DEFAULT 0, last_workout_date DATE)`);
      
      // Check and add timer columns
      const checkTimerCol = await runQuery(`
        SELECT count(*) as count FROM information_schema.COLUMNS 
        WHERE (TABLE_SCHEMA = 'moveease_db') AND (TABLE_NAME = 'user_stats') AND (COLUMN_NAME = 'timer_end_at')
      `);
      
      if (checkTimerCol[0].count === 0) {
          console.log('🔄 Migrating: Adding timer columns...');
          await runQuery("ALTER TABLE user_stats ADD COLUMN timer_end_at BIGINT DEFAULT 0");
          await runQuery("ALTER TABLE user_stats ADD COLUMN timer_duration INT DEFAULT 0");
      }

      // Check and add wechat_openid column to users
      const checkWxCol = await runQuery(`
        SELECT count(*) as count FROM information_schema.COLUMNS 
        WHERE (TABLE_SCHEMA = 'moveease_db') AND (TABLE_NAME = 'users') AND (COLUMN_NAME = 'wechat_openid')
      `);

      if (checkWxCol[0].count === 0) {
          console.log('🔄 Migrating: Adding wechat_openid column...');
          await runQuery("ALTER TABLE users ADD COLUMN wechat_openid VARCHAR(255) UNIQUE");
      }

  } catch (e) {
      console.error("Table init error", e);
  }
});

// 4. API Routes

app.get('/', (req, res) => {
  res.send('✅ SitClock Backend is running! v2.1 (WeChat Ready)');
});

app.post('/api/upload-avatar', upload.single('avatar'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const fileUrl = `/api/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
});

// Auth Routes
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length > 0) return res.status(409).json({ message: 'Email exists' });

    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const insertQuery = 'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)';
      db.query(insertQuery, [name, email, hashedPassword], (insertErr, result) => {
        if (insertErr) return res.status(500).json({ error: insertErr.message });
        res.status(201).json({ message: 'Registered', user: { id: result.insertId.toString(), name, email, avatar: '' } });
      });
    } catch (e) { res.status(500).json({ error: 'Server error' }); }
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(401).json({ message: 'Invalid credentials' });
    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
    res.json({ message: 'Login success', user: { id: user.id.toString(), name: user.username, email: user.email, avatar: user.avatar_url || '' } });
  });
});

// --- WECHAT LOGIN (NEW) ---
app.post('/api/wechat-login', async (req, res) => {
    const { code, userInfo } = req.body; // userInfo is optional (nickName, avatarUrl)
    
    // 1. 获取 OpenID
    let openid = null;
    
    if (WX_APP_ID && WX_APP_SECRET) {
        // 真实环境：请求微信服务器
        try {
            const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${WX_APP_ID}&secret=${WX_APP_SECRET}&js_code=${code}&grant_type=authorization_code`;
            const wxRes = await new Promise((resolve, reject) => {
                https.get(wxUrl, (r) => {
                    let data = '';
                    r.on('data', chunk => data += chunk);
                    r.on('end', () => resolve(JSON.parse(data)));
                }).on('error', reject);
            });
            
            if (wxRes.errcode) {
                return res.status(400).json({ error: `WeChat Error: ${wxRes.errmsg}` });
            }
            openid = wxRes.openid;
        } catch (e) {
            console.error("WeChat Login Error", e);
            return res.status(500).json({ error: "Failed to connect to WeChat" });
        }
    } else {
        // 开发环境 / 模拟环境：使用 Code 作为模拟 OpenID
        // ⚠️ 上线前请务必配置真实 AppID
        console.log("⚠️ Dev Mode: Using code as mock OpenID");
        openid = `mock_openid_${code}`; 
    }

    if (!openid) return res.status(400).json({ error: "Failed to get OpenID" });

    // 2. 查找或创建用户
    db.query('SELECT * FROM users WHERE wechat_openid = ?', [openid], async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (results.length > 0) {
            // 用户已存在 -> 登录
            const user = results[0];
            return res.json({ 
                message: 'Login success', 
                user: { id: user.id.toString(), name: user.username, email: user.email || '', avatar: user.avatar_url || '' } 
            });
        } else {
            // 用户不存在 -> 自动注册
            const mockEmail = `${openid}@wechat.com`; // 占位邮箱
            const name = userInfo?.nickName || `WeChat User`;
            const avatar = userInfo?.avatarUrl || '';
            const password = openid; // 这里的密码意义不大，主要靠 openid 登录
            
            try {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(password, salt);
                
                const insertQuery = 'INSERT INTO users (username, email, password_hash, avatar_url, wechat_openid) VALUES (?, ?, ?, ?, ?)';
                db.query(insertQuery, [name, mockEmail, hashedPassword, avatar, openid], (insertErr, result) => {
                    if (insertErr) return res.status(500).json({ error: insertErr.message });
                    res.status(201).json({ 
                        message: 'Registered via WeChat', 
                        user: { id: result.insertId.toString(), name, email: mockEmail, avatar } 
                    });
                });
            } catch (e) { res.status(500).json({ error: 'Server error' }); }
        }
    });
});

app.post('/api/update-profile', (req, res) => {
  const { id, name, avatar } = req.body;
  db.query('UPDATE users SET username = ?, avatar_url = ? WHERE id = ?', [name, avatar, id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Updated', user: { id, name, avatar } });
  });
});

app.get('/api/announcements', (req, res) => {
    db.query('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 10', (err, results) => res.json(results || []));
});
app.post('/api/announcements', (req, res) => {
    const { title, content } = req.body;
    db.query('INSERT INTO announcements (title, content) VALUES (?, ?)', [title, content], (err) => res.json({ message: 'Posted' }));
});

// Stats & Sync
app.get('/api/stats', (req, res) => {
    const { userId } = req.query;
    if(!userId) return res.status(400).json({error: "Missing userId"});

    const statsQuery = `SELECT us.*, u.username, u.avatar_url FROM user_stats us JOIN users u ON us.user_id = u.id WHERE us.user_id = ?`;
    db.query(statsQuery, [userId], (err, statsResults) => {
        if(err) return res.status(500).json({error: err.message});
        
        const activityQuery = `
            SELECT id, user_id, DATE_FORMAT(activity_date, '%Y-%m-%d') as activity_date_str, sedentary_minutes, active_breaks 
            FROM daily_activities WHERE user_id = ? AND activity_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) ORDER BY activity_date ASC
        `;
        db.query(activityQuery, [userId], (err, dailyResults) => {
             if(err) return res.status(500).json({error: err.message});
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
    const statsQuery = `INSERT INTO user_stats (user_id, total_workouts, current_streak, last_workout_date) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE total_workouts = VALUES(total_workouts), current_streak = VALUES(current_streak), last_workout_date = VALUES(last_workout_date)`;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }); 
    const activityQuery = `INSERT INTO daily_activities (user_id, activity_date, sedentary_minutes, active_breaks) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE sedentary_minutes = VALUES(sedentary_minutes), active_breaks = VALUES(active_breaks)`;

    db.getConnection((err, conn) => {
        if(err) return res.status(500).json({error: "DB Connection failed"});
        conn.beginTransaction(err => {
            conn.query(statsQuery, [userId, totalWorkouts, currentStreak, lastWorkoutDate || null], (err) => {
                 if (err) { conn.rollback(() => conn.release()); return res.status(500).send(err); }
                 conn.query(activityQuery, [userId, today, todaySedentaryMinutes, todayBreaks], (err) => {
                     if (err) { conn.rollback(() => conn.release()); return res.status(500).send(err); }
                     conn.commit(err => { conn.release(); res.json({message: "Synced"}); });
                 });
            });
        });
    });
});

app.post('/api/timer', (req, res) => {
    const { userId, endAt, duration } = req.body;
    db.query(`INSERT INTO user_stats (user_id, timer_end_at, timer_duration) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE timer_end_at = VALUES(timer_end_at), timer_duration = VALUES(timer_duration)`, 
    [userId, endAt, duration], (err) => res.json({ message: "Timer saved" }));
});

// --- AI Generation Proxy ---
app.post('/api/generate-workout', async (req, res) => {
    const { focusArea, language } = req.body;
    if (!GoogleGenAI) return res.status(500).json({ error: "AI Service Not Available (Library missing)" });
    
    // VALIDATE API KEY
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY.includes("YOUR_REAL_API_KEY")) {
        console.error("❌ ERROR: API_KEY is not configured in server.js!");
        return res.status(500).json({ error: "Server API Key not configured." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
        const model = "gemini-2.5-flash";
        const langInstruction = language === 'zh' ? 'in Chinese (Simplified)' : 'in English';
        
        const prompt = `
          Create a short "Micro-Fitness" workout plan for: ${focusArea}.
          Generate 3 simple exercises.
          Provide response in raw JSON format (no markdown).
          Content must be ${langInstruction}.
          IMPORTANT: The 'category' field MUST be exactly "${focusArea}".
        `;
    
        const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  duration: { type: Type.NUMBER },
                  category: { type: Type.STRING },
                  description: { type: Type.STRING },
                  imageUrl: { type: Type.STRING }
                },
                required: ["id", "name", "duration", "description", "category"]
              }
            }
          }
        });
    
        let rawText = response.text || "[]";
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const exercises = JSON.parse(rawText);
        
        const exercisesWithImages = exercises.map((ex, index) => ({
            ...ex,
            imageUrl: `https://picsum.photos/400/300?random=${Date.now() + index}`
        }));
        res.json(exercisesWithImages);
    } catch (error) {
        console.error("AI Generation Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`------------------------------------------------`);
    console.log(`🚀 SitClock 后端服务已启动 (SitClock Backend Started)`);
    console.log(`📡 监听地址: http://www.sitclock.com:${PORT}`);
    console.log(`🔑 API Key status: ${GOOGLE_API_KEY.startsWith("AIza") ? "Configured (Starts with AIza...)" : "❌ NOT CONFIGURED"}`);
    console.log(`------------------------------------------------`);
});
