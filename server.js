
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// 1. 中间件配置
app.use(cors({
    origin: [
        'http://localhost:5173', 
        'http://localhost:4173', 
        'http://sitclock.com', 
        'https://sitclock.com',
        'http://www.sitclock.com', 
        'https://www.sitclock.com'
    ],
    credentials: true
}));
app.use(bodyParser.json());

// 请求日志
app.use((req, res, next) => {
  // 强制使用中国时间显示日志
  const time = new Date().toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai' });
  console.log(`[${time}] 收到请求: ${req.method} ${req.url}`);
  next();
});

// --- 图片上传配置 (Multer) ---
// 确保 uploads 目录存在
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    // 使用时间戳+扩展名重命名文件，防止重名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });

// 将 uploads 目录挂载到 /api/uploads 路径下
// 这样前端就可以通过 /api/uploads/filename.jpg 访问图片
// 且能复用现有的 ProxyPass /api/ 规则
app.use('/api/uploads', express.static(uploadDir));


// 2. 数据库连接配置
const db = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  password: 'My8Uilbe@0VsN',
  database: 'moveease_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+08:00' // [修复] 设置为中国标准时间
});

// 3. 初始化：测试连接并自动创建表
db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ 严重错误: 无法连接到数据库。', err.message);
    return;
  }
  
  console.log('✅ 数据库连接成功 (Localhost Mode)！');

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

  // [新增] 用户统计表 (勋章、连胜)
  const createUserStatsTable = `
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id INT PRIMARY KEY,
      total_workouts INT DEFAULT 0,
      current_streak INT DEFAULT 0,
      last_workout_date DATE,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;

  // [新增] 每日活动表 (图表数据)
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

  connection.query(createUsersTable, (err) => {
    if (err) console.error('Users表失败:', err.message);
    else console.log('✅ users 表就绪');
  });

  connection.query(createAnnouncementsTable, (err) => {
    if (err) console.error('Announcements表失败:', err.message);
    else console.log('✅ announcements 表就绪');
  });

  connection.query(createUserStatsTable, (err) => {
    if (err) console.error('UserStats表失败:', err.message);
    else console.log('✅ user_stats 表就绪');
  });

  connection.query(createDailyActivitiesTable, (err) => {
    if (err) console.error('DailyActivities表失败:', err.message);
    else console.log('✅ daily_activities 表就绪');
    connection.release();
  });
});

// 4. API 路由

app.get('/', (req, res) => {
  res.send('✅ SitClock Backend is running! v1.2 (Image Uploads)');
});

// --- Upload ---
app.post('/api/upload-avatar', upload.single('avatar'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    // 返回相对路径，前端可以直接使用 /api/uploads/...
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

// --- Stats & Sync ---

// [GET] 获取用户统计数据
app.get('/api/stats', (req, res) => {
    const { userId } = req.query;
    if(!userId) return res.status(400).json({error: "Missing userId"});

    // 1. 获取总统计
    db.query('SELECT * FROM user_stats WHERE user_id = ?', [userId], (err, statsResults) => {
        if(err) return res.status(500).json({error: err.message});
        
        // 2. 获取最近7天的活动数据
        db.query(`SELECT * FROM daily_activities WHERE user_id = ? AND activity_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) ORDER BY activity_date ASC`, [userId], (err, dailyResults) => {
             if(err) return res.status(500).json({error: err.message});
             
             res.json({
                 stats: statsResults[0] || { total_workouts: 0, current_streak: 0, last_workout_date: null },
                 activity: dailyResults
             });
        });
    });
});

// [POST] 同步用户数据 (核心逻辑)
app.post('/api/stats', (req, res) => {
    const { userId, totalWorkouts, currentStreak, lastWorkoutDate, todaySedentaryMinutes, todayBreaks } = req.body;
    
    // 1. 更新或插入 User Stats
    const statsQuery = `
        INSERT INTO user_stats (user_id, total_workouts, current_streak, last_workout_date)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        total_workouts = VALUES(total_workouts),
        current_streak = VALUES(current_streak),
        last_workout_date = VALUES(last_workout_date)
    `;
    
    // 2. 更新或插入 Daily Activity (Today)
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }); // YYYY-MM-DD
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

// --- Announcements ---
app.get('/api/announcements', (req, res) => {
  db.query('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 50', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/announcements', (req, res) => {
  const { title, content } = req.body;
  db.query('INSERT INTO announcements (title, content) VALUES (?, ?)', [title, content], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Created', id: result.insertId });
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SitClock Server running on port ${PORT}`);
});
