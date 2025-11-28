
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 3000;

// 1. 中间件配置
app.use(cors()); // 允许跨域
app.use(bodyParser.json());

// 2. 数据库连接配置
const db = mysql.createPool({
  host: '127.0.0.1',          // 内部回环地址
  user: 'root',               // 数据库账号
  password: 'My8Uilbe@0VsN',  // 数据库密码
  database: 'moveease_db',    // 数据库名
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 3. 初始化：测试连接并自动创建表
db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ 严重错误: 无法连接到数据库。');
    console.error('错误详情:', err.message);
    return;
  }
  
  console.log('✅ 数据库连接成功 (Localhost Mode)！');

  // A. 创建 users 表
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

  // B. 创建 announcements 表
  const createAnnouncementsTable = `
    CREATE TABLE IF NOT EXISTS announcements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  connection.query(createUsersTable, (err) => {
    if (err) console.error('❌ 创建 users 表失败:', err.message);
    else console.log('✅ users 表就绪');
  });

  connection.query(createAnnouncementsTable, (err) => {
    if (err) console.error('❌ 创建 announcements 表失败:', err.message);
    else console.log('✅ announcements 表就绪');
    connection.release();
  });
});

// 4. API 路由接口

// [POST] 注册接口
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: '请填写完整信息' });
  }

  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length > 0) return res.status(409).json({ message: '该邮箱已被注册' });

    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const insertQuery = 'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)';
      db.query(insertQuery, [name, email, hashedPassword], (insertErr, result) => {
        if (insertErr) return res.status(500).json({ error: insertErr.message });

        res.status(201).json({ 
          message: '注册成功', 
          user: { id: result.insertId.toString(), name, email, avatar: '' } 
        });
      });
    } catch (hashError) {
      res.status(500).json({ error: '服务器内部错误' });
    }
  });
});

// [POST] 登录接口
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: '请输入邮箱和密码' });
  }

  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (results.length === 0) {
      return res.status(401).json({ message: '邮箱或密码错误' });
    }

    const user = results[0];

    try {
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ message: '邮箱或密码错误' });
      }

      res.json({
        message: '登录成功',
        user: {
          id: user.id.toString(),
          name: user.username,
          email: user.email,
          avatar: user.avatar_url || ''
        }
      });
    } catch (compareError) {
      res.status(500).json({ error: '登录验证失败' });
    }
  });
});

// [POST] 更新个人资料
app.post('/api/update-profile', (req, res) => {
  const { id, name, avatar } = req.body;

  if (!id) {
    return res.status(400).json({ message: 'Missing user ID' });
  }

  const updateQuery = 'UPDATE users SET username = ?, avatar_url = ? WHERE id = ?';
  db.query(updateQuery, [name, avatar, id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    
    res.json({ 
      message: 'Profile updated successfully',
      user: { id, name, avatar }
    });
  });
});

// [GET] 获取公告列表
app.get('/api/announcements', (req, res) => {
  const query = 'SELECT * FROM announcements ORDER BY created_at DESC LIMIT 50';
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// [POST] 发布公告 (Admin)
app.post('/api/announcements', (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ message: 'Missing title or content' });

  const query = 'INSERT INTO announcements (title, content) VALUES (?, ?)';
  db.query(query, [title, content], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Announcement created', id: result.insertId });
  });
});

// 5. 启动服务
app.listen(PORT, '0.0.0.0', () => {
  console.log('------------------------------------------------');
  console.log(`🚀 MoveEase 后端服务已启动`);
  console.log(`📡 监听地址: http://sitclock.cn:${PORT}`);
  console.log('------------------------------------------------');
});
