
# SitClock 微信小程序修复版开发指南 (Taro v3/v4)

**修复说明**：
1.  **编译报错修复**：在 `app.config.ts` 中暂时注释掉了图标路径，防止因找不到图片导致编译失败。
2.  **缺失文件补全**：提供了 `Workouts` (课程) 和 `Profile` (我的) 页面的完整代码。

---

## 一、项目初始化 (如果您还没创建)

```bash
# 1. 安装 CLI
npm install -g @tarojs/cli

# 2. 初始化项目
taro init sitclock-mp

# 3. 选择配置 (推荐)
# 框架: React
# TS: Yes
# CSS: Sass
# 编译工具: Webpack5
```

---

## 二、核心配置修复 (src/app.config.ts)

请直接覆盖 `src/app.config.ts`。我们暂时注释了图标，确保能跑起来。

```typescript
export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/workouts/index',
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
        // ⚠️ 修复：暂时注释图标，防止编译报错 "icon not found"
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
        pagePath: "pages/profile/index", 
        text: "我的",
        // iconPath: "assets/user.png", 
        // selectedIconPath: "assets/user_active.png" 
      }
    ]
  }
})
```

---

## 三、通用请求工具 (src/utils/request.ts)

请新建文件夹 `src/utils`，并新建文件 `request.ts`。

```typescript
import Taro from '@tarojs/taro';

// ⚠️ 注意：真机调试时，需在微信后台配置 request 合法域名为 https://www.sitclock.com
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
    Taro.showToast({ title: '网络错误', icon: 'none' });
    throw err;
  }
};
```

---

## 四、首页 (src/pages/index/)

### 1. src/pages/index/index.config.ts
```typescript
export default definePageConfig({
  navigationBarTitleText: 'SitClock 监测'
})
```

### 2. src/pages/index/index.tsx
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

### 3. src/pages/index/index.scss
```scss
.container { padding: 20px; display: flex; flex-direction: column; align-items: center; min-height: 100vh; background-color: #f3f4f6; }
.header { width: 100%; margin-bottom: 30px; }
.title { font-size: 24px; font-weight: bold; color: #1f2937; display: block; }
.subtitle { font-size: 14px; color: #6b7280; }
.timer-circle {
  width: 240px; height: 240px; border-radius: 50%; background: white; border: 12px solid #e0e7ff;
  display: flex; justify-content: center; align-items: center; margin-bottom: 30px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.05); position: relative;
  &.timer-active { border-color: #fee2e2; animation: pulse 2s infinite; }
}
@keyframes pulse {
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  70% { transform: scale(1.02); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}
.timer-content { text-align: center; }
.timer-text { font-size: 56px; font-weight: bold; color: #3730a3; font-family: monospace; display: block; text-align: center; &.red { color: #dc2626; } }
.timer-label { font-size: 14px; color: #9ca3af; text-align: center; display: block; }
.quick-actions { display: flex; gap: 10px; margin-bottom: 20px; }
.mini-btn { font-size: 12px; padding: 0 15px; height: 32px; line-height: 32px; background: white; color: #4b5563; border-radius: 16px; &::after { border: none; } }
.main-actions { width: 100%; display: flex; gap: 15px; }
.action-btn { flex: 1; height: 50px; line-height: 50px; border-radius: 12px; font-weight: bold; font-size: 16px; &.primary { background: #4f46e5; color: white; } &.outline { background: white; color: #4f46e5; border: 1px solid #e0e7ff; } }
```

---

## 五、课程页 (src/pages/workouts/)

**请务必创建此目录及以下3个文件，否则会报 "pages/workouts/index.js not found"**

### 1. src/pages/workouts/index.config.ts
```typescript
export default definePageConfig({
  navigationBarTitleText: '微健身课程'
})
```

### 2. src/pages/workouts/index.tsx
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
      {id: 'shoulders', label: '肩膀'},
      {id: 'fullbody', label: '全身'}
  ];

  const generate = async () => {
    setLoading(true);
    try {
      // 调用后端 AI 接口
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
           <Text className='banner-title'>智能计划生成</Text>
           <Text className='banner-desc'>针对 {categories.find(c=>c.id===category)?.label} 定制放松计划</Text>
           <Button className='gen-btn' onClick={generate} disabled={loading}>
               {loading ? 'AI 生成中...' : '生成计划'}
           </Button>
       </View>

       <View className='list'>
          {plans.map((item) => (
            <View key={item.id} className='card'>
               <Image src={item.imageUrl} className='card-img' mode='aspectFill' />
               <View className='card-body'>
                   <View className='card-header'>
                       <Text className='card-title'>{item.name}</Text>
                       <Text className='tag'>{item.category}</Text>
                   </View>
                   <Text className='card-desc'>{item.description}</Text>
               </View>
            </View>
          ))}
       </View>
    </View>
  );
}
```

### 3. src/pages/workouts/index.scss
```scss
.page { padding: 16px; background: #f9fafb; min-height: 100vh; }
.filters { white-space: nowrap; margin-bottom: 20px; }
.chip { display: inline-block; padding: 6px 16px; background: white; border-radius: 20px; margin-right: 10px; border: 1px solid #eee; &.active { background: #4f46e5; border-color: #4f46e5; } }
.chip-text { font-size: 14px; color: #666; &.active-text { color: white; } }
.banner { background: #4f46e5; border-radius: 12px; padding: 20px; margin-bottom: 20px; color: white; }
.banner-title { font-weight: bold; font-size: 18px; display: block; margin-bottom: 5px; color: white; }
.banner-desc { font-size: 12px; opacity: 0.8; display: block; margin-bottom: 15px; color: white; }
.gen-btn { background: white; color: #4f46e5; font-size: 14px; border-radius: 8px; font-weight: bold; &::after { border: none; } }
.card { background: white; border-radius: 12px; overflow: hidden; margin-bottom: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
.card-img { width: 100%; height: 140px; }
.card-body { padding: 15px; }
.card-header { display: flex; justify-content: space-between; margin-bottom: 5px; }
.card-title { font-weight: bold; font-size: 16px; color: #333; }
.tag { font-size: 10px; background: #e0e7ff; color: #4f46e5; padding: 2px 6px; border-radius: 4px; }
.card-desc { font-size: 13px; color: #666; line-height: 1.4; display: block; }
```

---

## 六、我的 (src/pages/profile/)

### 1. src/pages/profile/index.config.ts
```typescript
export default definePageConfig({
  navigationBarTitleText: '个人中心'
})
```

### 2. src/pages/profile/index.tsx
```tsx
import React, { useState } from 'react';
import { View, Text, Button, Image } from '@tarojs/components';
import './index.scss';

export default function Profile() {
  const [user, setUser] = useState({ name: 'Guest', avatar: '' });

  return (
    <View className='profile-page'>
       <View className='user-card'>
           <View className='avatar'>
               {user.avatar ? <Image src={user.avatar} className='avatar-img' /> : <Text>U</Text>}
           </View>
           <View className='info'>
               <Text className='name'>{user.name}</Text>
               <Text className='quote'>Keep Moving!</Text>
           </View>
       </View>

       <View className='stats-row'>
           <View className='stat-item'>
               <Text className='val'>3</Text>
               <Text className='label'>连续打卡</Text>
           </View>
           <View className='stat-item'>
               <Text className='val'>12</Text>
               <Text className='label'>总课程</Text>
           </View>
       </View>
       
       <Button className='logout-btn'>退出登录</Button>
    </View>
  );
}
```

### 3. src/pages/profile/index.scss
```scss
.profile-page { padding: 20px; background: #f9fafb; min-height: 100vh; box-sizing: border-box; }
.user-card { background: white; padding: 20px; border-radius: 12px; display: flex; align-items: center; margin-bottom: 20px; }
.avatar { width: 60px; height: 60px; background: #e0e7ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #4f46e5; font-weight: bold; font-size: 24px; margin-right: 15px; overflow: hidden; }
.avatar-img { width: 100%; height: 100%; }
.name { font-weight: bold; font-size: 18px; display: block; color: #333; }
.quote { font-size: 12px; color: #888; display: block; }
.stats-row { display: flex; background: white; padding: 20px; border-radius: 12px; margin-bottom: 30px; }
.stat-item { flex: 1; text-align: center; }
.val { font-size: 20px; font-weight: bold; color: #4f46e5; display: block; }
.label { font-size: 12px; color: #888; display: block; }
.logout-btn { background: white; color: #ef4444; border: 1px solid #fee2e2; font-size: 14px; &::after { border: none; } }
```
