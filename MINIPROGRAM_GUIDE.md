
# SitClock 微信小程序开发全指南 (Taro 版 V3.0)

本指南包含完整的源代码，修复了所有缺失页面和图标报错，并实现了**微信登录**、**数据同步**和**勋章展示**功能。

---

## 一、项目结构

在您的 Taro 项目 (`sitclock-mp`) 中，确保目录结构如下：

```
src/
  app.config.ts
  app.scss
  app.ts
  utils/
    request.ts
  pages/
    index/       (监测页)
    workouts/    (课程页)
    stats/       (数据页 - 新增)
    profile/     (我的页 - 新增登录逻辑)
```

---

## 二、文件代码 (请直接复制覆盖)

### 1. 全局配置 `src/app.config.ts`

```typescript
export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/workouts/index',
    'pages/stats/index',
    'pages/profile/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'SitClock',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: "#999",
    selectedColor: "#4f46e5",
    backgroundColor: "#ffffff",
    list: [
      { 
        pagePath: "pages/index/index", 
        text: "监测",
        // iconPath: "assets/home.png", 
        // selectedIconPath: "assets/home_active.png" 
      },
      { 
        pagePath: "pages/workouts/index", 
        text: "课程",
        // iconPath: "assets/gym.png", 
        // selectedIconPath: "assets/gym_active.png" 
      },
      { 
        pagePath: "pages/stats/index", 
        text: "数据",
        // iconPath: "assets/chart.png", 
        // selectedIconPath: "assets/chart_active.png" 
      },
      { 
        pagePath: "pages/profile/index", 
        text: "我的",
        // iconPath: "assets/user.png", 
        // selectedIconPath: "assets/user_active.png" 
      }
    ]
  }
})
```

### 2. 请求封装 `src/utils/request.ts`

```typescript
import Taro from '@tarojs/taro';

// ⚠️ 真机调试需配置合法域名
const BASE_URL = 'https://www.sitclock.com/api'; 

export const request = async (url: string, method: 'GET'|'POST' = 'GET', data?: any) => {
  try {
    const res = await Taro.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: { 'content-type': 'application/json' }
    });
    return res.data;
  } catch (err) {
    Taro.showToast({ title: '网络连接失败', icon: 'none' });
    throw err;
  }
};
```

---

### 3. 首页 (监测) `src/pages/index/index.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './index.scss';

export default function Index() {
  const [sedentaryTime, setSedentaryTime] = useState(0);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [quickTimerLeft, setQuickTimerLeft] = useState(0);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  useEffect(() => {
    let interval: any;
    if (isMonitoring && quickTimerLeft === 0) {
      interval = setInterval(() => {
        setSedentaryTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isMonitoring, quickTimerLeft]);

  useEffect(() => {
    let interval: any;
    if (quickTimerLeft > 0) {
      interval = setInterval(() => {
        setQuickTimerLeft(prev => {
          if (prev <= 1) {
             Taro.showToast({ title: '时间到了！', icon: 'none', duration: 2000 });
             Taro.vibrateLong();
             return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [quickTimerLeft]);

  const handleMoved = () => {
    Taro.showToast({ title: '太棒了！状态已重置', icon: 'success' });
    setSedentaryTime(0);
  };

  const startQuickTimer = (min: number) => {
      setQuickTimerLeft(min * 60);
      Taro.showToast({ title: `开始 ${min} 分钟倒计时`, icon: 'none' });
  };

  return (
    <View className='container'>
      <View className='header'>
         <Text className='title'>SitClock</Text>
         <Text className='subtitle'>{isMonitoring ? '正在监测中...' : '已暂停监测'}</Text>
      </View>

      <View className={`timer-circle ${quickTimerLeft > 0 ? 'timer-active' : ''}`}>
         <View className='timer-content'>
             {quickTimerLeft > 0 ? (
                 <>
                    <Text className='timer-text red'>{formatTime(quickTimerLeft)}</Text>
                    <Text className='timer-label'>倒计时</Text>
                 </>
             ) : (
                 <>
                    <Text className='timer-text'>{formatTime(sedentaryTime)}</Text>
                    <Text className='timer-label'>久坐时长</Text>
                 </>
             )}
         </View>
      </View>

      <View className='quick-actions'>
          <Button className='mini-btn' onClick={() => startQuickTimer(30)}>30分</Button>
          <Button className='mini-btn' onClick={() => startQuickTimer(45)}>45分</Button>
          <Button className='mini-btn' onClick={() => startQuickTimer(60)}>60分</Button>
      </View>

      <View className='main-actions'>
         <Button className={`action-btn ${isMonitoring ? 'outline' : 'primary'}`} onClick={() => setIsMonitoring(!isMonitoring)}>
            {isMonitoring ? '暂停' : '继续'}
         </Button>
         <Button className='action-btn primary' onClick={handleMoved}>
            动一下
         </Button>
      </View>
    </View>
  );
}
```

**`src/pages/index/index.scss`**:
```scss
.container { padding: 40rpx; display: flex; flex-direction: column; align-items: center; min-height: 100vh; background-color: #f3f4f6; }
.header { width: 100%; margin-bottom: 60rpx; }
.title { font-size: 48rpx; font-weight: bold; color: #1f2937; display: block; }
.subtitle { font-size: 28rpx; color: #6b7280; }
.timer-circle {
  width: 480rpx; height: 480rpx; border-radius: 50%; background: white; border: 24rpx solid #e0e7ff;
  display: flex; justify-content: center; align-items: center; margin-bottom: 60rpx;
  box-shadow: 0 20rpx 50rpx rgba(0,0,0,0.05); position: relative;
  &.timer-active { border-color: #fee2e2; animation: pulse 2s infinite; }
}
@keyframes pulse {
  0% { transform: scale(1); } 50% { transform: scale(1.02); } 100% { transform: scale(1); }
}
.timer-content { text-align: center; }
.timer-text { font-size: 100rpx; font-weight: bold; color: #3730a3; font-family: monospace; display: block; &.red { color: #dc2626; } }
.timer-label { font-size: 28rpx; color: #9ca3af; display: block; }
.quick-actions { display: flex; gap: 20rpx; margin-bottom: 40rpx; }
.mini-btn { font-size: 24rpx; padding: 0 30rpx; height: 64rpx; line-height: 64rpx; background: white; color: #4b5563; border-radius: 32rpx; &::after { border: none; } }
.main-actions { width: 100%; display: flex; gap: 30rpx; }
.action-btn { flex: 1; height: 100rpx; line-height: 100rpx; border-radius: 24rpx; font-weight: bold; font-size: 32rpx; &.primary { background: #4f46e5; color: white; } &.outline { background: white; color: #4f46e5; border: 2rpx solid #e0e7ff; } }
```
**`src/pages/index/index.config.ts`**: `export default definePageConfig({ navigationBarTitleText: 'SitClock 监测' })`

---

### 4. 课程页 (AI) `src/pages/workouts/index.tsx`

```tsx
import React, { useState } from 'react';
import { View, Text, Button, Image, ScrollView } from '@tarojs/components';
import { request } from '../../utils/request';
import './index.scss';

export default function Workouts() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('neck');

  const categories = [
      {id: 'neck', label: '肩颈'},
      {id: 'waist', label: '腰部'},
      {id: 'eyes', label: '眼部'},
      {id: 'fullbody', label: '全身'}
  ];

  const generate = async () => {
    setLoading(true);
    try {
      const res = await request('/generate-workout', 'POST', { focusArea: category, language: 'zh' });
      setPlans(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className='page'>
       <ScrollView scrollX className='filters'>
          {categories.map(cat => (
              <View key={cat.id} className={`chip ${category === cat.id ? 'active' : ''}`} onClick={() => setCategory(cat.id)}>
                  <Text className={`chip-text ${category === cat.id ? 'active-text' : ''}`}>{cat.label}</Text>
              </View>
          ))}
       </ScrollView>
       <View className='banner'>
           <Text className='banner-title'>AI 智能计划生成</Text>
           <Text className='banner-desc'>定制 {categories.find(c=>c.id===category)?.label} 放松计划</Text>
           <Button className='gen-btn' onClick={generate} disabled={loading}>{loading ? '生成中...' : '立即生成'}</Button>
       </View>
       <View className='list'>
          {plans.map((item, idx) => (
            <View key={idx} className='card'>
               <Image src={item.imageUrl} className='card-img' mode='aspectFill' />
               <View className='card-body'>
                   <Text className='card-title'>{item.name}</Text>
                   <Text className='card-desc'>{item.description}</Text>
               </View>
            </View>
          ))}
       </View>
    </View>
  );
}
```

**`src/pages/workouts/index.scss`**:
```scss
.page { padding: 32rpx; background: #f9fafb; min-height: 100vh; }
.filters { white-space: nowrap; margin-bottom: 30rpx; }
.chip { display: inline-block; padding: 12rpx 32rpx; background: white; border-radius: 40rpx; margin-right: 20rpx; border: 2rpx solid #eee; &.active { background: #4f46e5; border-color: #4f46e5; } }
.chip-text { font-size: 26rpx; color: #666; &.active-text { color: white; } }
.banner { background: #4f46e5; border-radius: 24rpx; padding: 40rpx; margin-bottom: 40rpx; color: white; }
.banner-title { font-weight: bold; font-size: 36rpx; display: block; margin-bottom: 10rpx; }
.banner-desc { font-size: 24rpx; opacity: 0.8; display: block; margin-bottom: 30rpx; }
.gen-btn { background: white; color: #4f46e5; font-size: 28rpx; border-radius: 16rpx; font-weight: bold; }
.card { background: white; border-radius: 24rpx; overflow: hidden; margin-bottom: 30rpx; box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.05); }
.card-img { width: 100%; height: 280rpx; }
.card-body { padding: 30rpx; }
.card-title { font-weight: bold; font-size: 32rpx; color: #333; display: block; margin-bottom: 10rpx; }
.card-desc { font-size: 26rpx; color: #666; line-height: 1.4; }
```
**`src/pages/workouts/index.config.ts`**: `export default definePageConfig({ navigationBarTitleText: '微健身' })`

---

### 5. 数据统计 `src/pages/stats/index.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { request } from '../../utils/request';
import './index.scss';

export default function Stats() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    // 每次进入页面刷新数据
    const fetchData = async () => {
        const user = Taro.getStorageSync('user');
        if (user && user.id) {
            try {
                const res = await request(`/stats?userId=${user.id}`);
                setStats(res);
            } catch (e) {}
        }
    };
    fetchData();
  }, []);

  const todayMinutes = stats?.activity?.length > 0 ? stats.activity[stats.activity.length-1].sedentary_minutes : 0;
  const percent = Math.min((todayMinutes / 480) * 100, 100); // 8小时预算

  return (
    <View className='page'>
       <View className='section'>
           <Text className='sec-title'>健康久坐预算 (8小时)</Text>
           <View className='progress-bg'>
               <View className='progress-bar' style={{width: `${percent}%`, backgroundColor: percent > 90 ? '#ef4444' : '#22c55e'}}></View>
           </View>
           <Text className='hint'>已使用 {Math.floor(todayMinutes/60)} 小时 {todayMinutes%60} 分钟</Text>
       </View>

       <View className='section'>
           <Text className='sec-title'>周趋势</Text>
           <View className='chart'>
               {(stats?.activity || []).map((day, idx) => {
                   const h = Math.min((day.sedentary_minutes / 60) * 20, 150); // Scale height
                   return (
                       <View key={idx} className='bar-group'>
                           <View className='bar' style={{height: `${h}rpx`}}></View>
                           <Text className='date'>{day.activity_date_str.slice(5)}</Text>
                       </View>
                   )
               })}
           </View>
       </View>
    </View>
  );
}
```

**`src/pages/stats/index.scss`**:
```scss
.page { padding: 32rpx; background: #f9fafb; min-height: 100vh; }
.section { background: white; padding: 32rpx; border-radius: 24rpx; margin-bottom: 30rpx; }
.sec-title { font-weight: bold; font-size: 32rpx; margin-bottom: 20rpx; display: block; }
.progress-bg { height: 24rpx; background: #f3f4f6; border-radius: 12rpx; overflow: hidden; margin-bottom: 10rpx; }
.progress-bar { height: 100%; transition: width 0.5s; }
.hint { font-size: 24rpx; color: #666; }
.chart { display: flex; align-items: flex-end; justify-content: space-between; height: 200rpx; padding-top: 20rpx; }
.bar-group { display: flex; flex-direction: column; align-items: center; }
.bar { width: 30rpx; background: #6366f1; border-radius: 6rpx 6rpx 0 0; }
.date { font-size: 20rpx; color: #999; margin-top: 10rpx; }
```
**`src/pages/stats/index.config.ts`**: `export default definePageConfig({ navigationBarTitleText: '数据统计' })`

---

### 6. 我的 (登录与勋章) `src/pages/profile/index.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Button, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { request } from '../../utils/request';
import './index.scss';

export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [isLoginMode, setIsLoginMode] = useState(true); // false = Email Mode
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const saved = Taro.getStorageSync('user');
    if (saved) setUser(saved);
  }, []);

  const handleWechatLogin = async () => {
    try {
        const { code } = await Taro.login();
        const res = await request('/wechat-login', 'POST', { code });
        if (res.user) {
            Taro.setStorageSync('user', res.user);
            setUser(res.user);
            Taro.showToast({ title: '登录成功' });
        }
    } catch (e) {
        Taro.showToast({ title: '登录失败', icon: 'none' });
    }
  };

  const handleEmailLogin = async () => {
      try {
          const res = await request('/login', 'POST', { email, password });
          if (res.user) {
              Taro.setStorageSync('user', res.user);
              setUser(res.user);
              Taro.showToast({ title: '同步成功' });
          }
      } catch (e) {
          Taro.showToast({ title: '账号或密码错误', icon: 'none' });
      }
  };

  const logout = () => {
      Taro.removeStorageSync('user');
      setUser(null);
  };

  if (!user) {
      return (
          <View className='page login-container'>
             <Text className='logo-text'>SitClock</Text>
             {isLoginMode ? (
                 <View>
                    <Button className='wx-btn' onClick={handleWechatLogin}>微信一键登录</Button>
                    <Text className='switch-link' onClick={() => setIsLoginMode(false)}>使用邮箱账号同步数据 &gt;</Text>
                 </View>
             ) : (
                 <View className='form'>
                     <Input className='input' placeholder='邮箱' onInput={e=>setEmail(e.detail.value)} />
                     <Input className='input' password placeholder='密码' onInput={e=>setPassword(e.detail.value)} />
                     <Button className='email-btn' onClick={handleEmailLogin}>登录并同步</Button>
                     <Text className='switch-link' onClick={() => setIsLoginMode(true)}>&lt; 返回微信登录</Text>
                 </View>
             )}
          </View>
      )
  }

  return (
    <View className='page'>
       <View className='user-card'>
           <View className='avatar'>{user.name[0]}</View>
           <View className='info'>
               <Text className='name'>{user.name}</Text>
               <Text className='email'>{user.email || '微信用户'}</Text>
           </View>
       </View>

       <View className='badges-sec'>
           <Text className='sec-title'>我的勋章</Text>
           <View className='badges-grid'>
               <View className='badge-item unlocked'><Text>🚀</Text><Text>初次启程</Text></View>
               <View className='badge-item'><Text>🔥</Text><Text>3天连胜</Text></View>
               <View className='badge-item'><Text>🏆</Text><Text>健身达人</Text></View>
           </View>
       </View>
       
       <Button className='logout-btn' onClick={logout}>退出登录</Button>
    </View>
  );
}
```

**`src/pages/profile/index.scss`**:
```scss
.page { padding: 32rpx; background: #f9fafb; min-height: 100vh; }
.login-container { display: flex; flex-direction: column; justify-content: center; align-items: center; }
.logo-text { font-size: 60rpx; font-weight: bold; color: #333; margin-bottom: 60rpx; }
.wx-btn { background: #07c160; color: white; width: 500rpx; border-radius: 50rpx; margin-bottom: 30rpx; }
.email-btn { background: #4f46e5; color: white; width: 500rpx; border-radius: 50rpx; margin-bottom: 30rpx; }
.switch-link { color: #666; font-size: 28rpx; text-decoration: underline; margin-top: 20rpx; display: block; text-align: center; }
.input { background: white; width: 500rpx; padding: 20rpx; margin-bottom: 20rpx; border-radius: 12rpx; border: 1px solid #ddd; }
.user-card { background: white; padding: 40rpx; border-radius: 24rpx; display: flex; align-items: center; margin-bottom: 40rpx; }
.avatar { width: 100rpx; height: 100rpx; background: #e0e7ff; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: #4f46e5; font-size: 40rpx; font-weight: bold; margin-right: 30rpx; }
.name { font-size: 36rpx; font-weight: bold; color: #333; display: block; }
.email { font-size: 24rpx; color: #999; }
.badges-sec { background: white; padding: 30rpx; border-radius: 24rpx; margin-bottom: 40rpx; }
.sec-title { font-weight: bold; margin-bottom: 20rpx; display: block; }
.badges-grid { display: flex; gap: 20rpx; }
.badge-item { width: 140rpx; height: 140rpx; background: #f3f4f6; border-radius: 12rpx; display: flex; flex-direction: column; justify-content: center; align-items: center; font-size: 24rpx; color: #999; &.unlocked { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; } }
.logout-btn { background: white; color: #ef4444; }
```
**`src/pages/profile/index.config.ts`**: `export default definePageConfig({ navigationBarTitleText: '个人中心' })`
