
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 3000;

// 1. 中间件配置
app.use(cors()); // 关键：允许来自任何前端地址的跨域请求
app.use(bodyParser.json());

// 2. 数据库连接配置
// 优化：既然 server.js 和 MySQL 都在同一台服务器上运行，
// 使用 'localhost' 或 '127.0.0.1' 连接数据库是最快且最安全的。
// 不需要通过公网 IP (203.248...) 绕一圈。
const db = mysql.createPool({
  host: '127.0.0.1',          // 内部回环地址
  user: 'root',               // 数据库账号
  password: 'My8Uilbe@0VsN',  // 数据库密码
  database: 'moveease_db',    // 数据库名
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 3. 初始化：测试连接并自动创建用户表
db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ 严重错误: 无法连接到数据库。');
    console.error('错误详情:', err.message);
    return;
  }
  
  console.log('✅ 数据库连接成功 (Localhost Mode)！');

  // 自动创建 users 表
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL,
      email VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      avatar_url VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  connection.query(createTableQuery, (tableErr) => {
    connection.release();
    if (tableErr) {
      console.error('❌ 创建表失败:', tableErr.message);
    } else {
      console.log('✅ 数据表 check 完成');
    }
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

// 5. 启动服务
// 监听 0.0.0.0 表示允许来自外部互联网的连接
app.listen(PORT, '0.0.0.0', () => {
  console.log('------------------------------------------------');
  console.log(`🚀 MoveEase 后端服务已启动`);
  console.log(`📡 监听地址: http://203.248.94.98:${PORT}`);
  console.log('------------------------------------------------');
});
