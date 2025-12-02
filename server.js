
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- CONFIGURATION ---
// ⚠️⚠️⚠️ 必须在这里填入您的 Google Gemini API Key ⚠️⚠️⚠️
// 否则微信小程序和网页版的“生成计划”功能都将无法使用
const GOOGLE_API_KEY = process.env.API_KEY || "YOUR_REAL_API_KEY_HERE"; 

const app = express();
const PORT = 3000;

// Dynamic import for Google GenAI (ESM package)
let GoogleGenAI, Type;

// 尝试加载 AI 库，如果没安装也不要让整个服务器崩溃
import('@google/genai').then(m => {
    GoogleGenAI = m.GoogleGenAI;
    Type = m.Type;
    console.log("✅ Google GenAI library loaded successfully.");
}).catch(err => {
    console.error("⚠️ WARNING: Failed to load '@google/genai'.");
    console.error("⚠️ Please run 'npm install @google/genai' on your server.");
    console.error("⚠️ AI features (Workout Generator) will NOT work until this is fixed.");
});

// 1. Middleware
app.use(cors({
    origin: true, // Allow all origins for simplicity in hybrid app (Web + MiniProgram)
    credentials: true
}));
app.use(bodyParser.json());

// Request Logger
app.use((req, res, next) => {
  const time = new Date().toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai' });
  console.log(`[${time}] Request: ${req.method} ${req.url}`);
  next();
});

// --- Image Upload Configuration (Multer) ---
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

// Serve static files from uploads directory
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
  timezone: '+08:00' // Ensure China Standard Time
});

// Helper to safely run queries
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

  // Define Tables
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL,
      email VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      avatar_url VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createAnnouncementsTable = `
    CREATE TABLE IF NOT EXISTS announcements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createUserStatsTable = `
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id INT PRIMARY KEY,
      total_workouts INT DEFAULT 0,
      current_streak INT DEFAULT 0,
      last_workout_date DATE,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;

  const createDailyActivitiesTable = `
    CREATE TABLE IF NOT EXISTS daily_activities (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      activity_date DATE,
      sedentary_minutes INT DEFAULT 0,
      active_breaks INT DEFAULT 0,
      UNIQUE KEY unique_user_date (user_id, activity_date)
    )
  `;

  try {
      await runQuery(createUsersTable);
      console.log('✅ users table ready');
      await runQuery(createAnnouncementsTable);
      console.log('✅ announcements table ready');
      await runQuery(createUserStatsTable);
      console.log('✅ user_stats table ready');
      await runQuery(createDailyActivitiesTable);
      console.log('✅ daily_activities table ready');

      // --- AUTO MIGRATION: Add timer columns if they don't exist ---
      try {
          await runQuery(`
            SELECT count(*) FROM information_schema.COLUMNS 
            WHERE (TABLE_SCHEMA = 'moveease_db') 
            AND (TABLE_NAME = 'user_stats') 
            AND (COLUMN_NAME = 'timer_end_at')
          `).then(async (results) => {
              if (results[0]['count(*)'] === 0) {
                  console.log('🔄 Migrating: Adding timer_end_at column...');
                  await runQuery("ALTER TABLE user_stats ADD COLUMN timer_end_at BIGINT DEFAULT 0");
                  await runQuery("ALTER TABLE user_stats ADD COLUMN timer_duration INT DEFAULT 0");
                  console.log('✅ Migration complete: Timer columns added.');
              }
          });
      } catch (migErr) {
          console.error("Migration warning:", migErr.message);
      }

  } catch (e) {
      console.error("Table initialization failed:", e);
  }
});

// 4. API Routes

app.get('/', (req, res) => {
  res.send('✅ SitClock Backend is running! v1.7.1 (WeChat MP Ready)');
});

// --- Upload ---
app.post('/api/upload-avatar', upload.single('avatar'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    // Return full URL for Mini Program compatibility if needed, currently relative
    const fileUrl = `/api/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
});

// --- Auth ---
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Missing fields' });

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

app.post('/api/update-profile', (req, res) => {
  const { id, name, avatar } = req.body;
  db.query('UPDATE users SET username = ?, avatar_url = ? WHERE id = ?', [name, avatar, id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Updated', user: { id, name, avatar } });
  });
});

// --- Announcements ---
app.get('/api/announcements', (req, res) => {
    db.query('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 10', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/announcements', (req, res) => {
    const { title, content } = req.body;
    db.query('INSERT INTO announcements (title, content) VALUES (?, ?)', [title, content], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Posted' });
    });
});

// --- Stats & Sync ---

app.get('/api/stats', (req, res) => {
    const { userId } = req.query;
    if(!userId) return res.status(400).json({error: "Missing userId"});

    const statsQuery = `
        SELECT us.*, u.username, u.avatar_url 
        FROM user_stats us 
        JOIN users u ON us.user_id = u.id 
        WHERE us.user_id = ?
    `;

    db.query(statsQuery, [userId], (err, statsResults) => {
        if(err) return res.status(500).json({error: err.message});
        
        const activityQuery = `
            SELECT 
                id, user_id, 
                DATE_FORMAT(activity_date, '%Y-%m-%d') as activity_date_str, 
                sedentary_minutes, active_breaks 
            FROM daily_activities 
            WHERE user_id = ? AND activity_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) 
            ORDER BY activity_date ASC
        `;

        db.query(activityQuery, [userId], (err, dailyResults) => {
             if(err) return res.status(500).json({error: err.message});
             
             if (statsResults.length === 0) {
                 db.query('SELECT username, avatar_url FROM users WHERE id = ?', [userId], (err, userRes) => {
                     const userInfo = userRes[0] || {};
                     res.json({
                        stats: { 
                            total_workouts: 0, current_streak: 0, last_workout_date: null,
                            timer_end_at: 0, timer_duration: 0,
                            username: userInfo.username, avatar_url: userInfo.avatar_url
                        },
                        activity: dailyResults
                     });
                 });
             } else {
                 res.json({
                     stats: statsResults[0],
                     activity: dailyResults
                 });
             }
        });
    });
});

app.post('/api/stats', (req, res) => {
    const { userId, totalWorkouts, currentStreak, lastWorkoutDate, todaySedentaryMinutes, todayBreaks } = req.body;
    
    const statsQuery = `
        INSERT INTO user_stats (user_id, total_workouts, current_streak, last_workout_date)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        total_workouts = VALUES(total_workouts),
        current_streak = VALUES(current_streak),
        last_workout_date = VALUES(last_workout_date)
    `;
    
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }); 
    
    const activityQuery = `
        INSERT INTO daily_activities (user_id, activity_date, sedentary_minutes, active_breaks)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        sedentary_minutes = VALUES(sedentary_minutes),
        active_breaks = VALUES(active_breaks)
    `;

    db.getConnection((err, conn) => {
        if(err) return res.status(500).json({error: "DB Connection failed"});
        
        conn.beginTransaction(err => {
            if (err) { conn.release(); return res.status(500).send(err); }
            
            conn.query(statsQuery, [userId, totalWorkouts, currentStreak, lastWorkoutDate || null], (err) => {
                 if (err) { conn.rollback(() => conn.release()); return res.status(500).send(err); }
                 
                 conn.query(activityQuery, [userId, today, todaySedentaryMinutes, todayBreaks], (err) => {
                     if (err) { conn.rollback(() => conn.release()); return res.status(500).send(err); }
                     
                     conn.commit(err => {
                         if (err) { conn.rollback(() => conn.release()); return res.status(500).send(err); }
                         conn.release();
                         res.json({message: "Synced successfully"});
                     });
                 });
            });
        });
    });
});

app.post('/api/timer', (req, res) => {
    const { userId, endAt, duration } = req.body;
    
    const query = `
        INSERT INTO user_stats (user_id, timer_end_at, timer_duration)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        timer_end_at = VALUES(timer_end_at),
        timer_duration = VALUES(timer_duration)
    `;

    db.query(query, [userId, endAt, duration], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Timer saved" });
    });
});

// --- AI Generation Proxy (REQUIRED for WeChat Mini Program) ---
app.post('/api/generate-workout', async (req, res) => {
    const { focusArea, language } = req.body;
    
    if (!GoogleGenAI) {
        return res.status(500).json({ error: "AI Service Not Available: Server missing @google/genai package." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
        
        const model = "gemini-2.5-flash";
        const langInstruction = language === 'zh' ? 'in Chinese (Simplified)' : 'in English';
        
        const prompt = `
          Create a short "Micro-Fitness" workout plan for an office worker focusing SPECIFICALLY on: ${focusArea}.
          Generate 3 simple exercises that can be done in an office chair or standing at a desk.
          Each exercise should take about 30-60 seconds.
          Provide the response exclusively in raw JSON format (no markdown code blocks).
          The content (name, description) must be written ${langInstruction}.
          IMPORTANT: The 'category' field for each exercise MUST be exactly "${focusArea}".
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
                  duration: { type: Type.NUMBER, description: "Duration in seconds" },
                  category: { type: Type.STRING },
                  description: { type: Type.STRING },
                  imageUrl: { type: Type.STRING, description: "Use a placeholder URL like https://picsum.photos/400/300?random=X" }
                },
                required: ["id", "name", "duration", "description", "category"]
              }
            }
          }
        });
    
        let rawText = response.text || "[]";
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const exercises = JSON.parse(rawText);
        
        // Patch images
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
    console.log(`------------------------------------------------`);
});
