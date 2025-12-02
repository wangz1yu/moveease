
# SitClock 微信小程序开发指南 (Taro 版)

本指南将帮助你使用 **Taro** 框架，将 SitClock 复刻为微信小程序，同时共用后端的 AI 和数据接口。

---

## 一、环境准备

1.  **安装 Node.js** (已完成)
2.  **安装 Taro CLI**:
    ```bash
    npm install -g @tarojs/cli
    ```
3.  **新建 Taro 项目** (请在电脑上的新文件夹中操作，**不要**在现有 Web 项目文件夹里):
    ```bash
    taro init sitclock-mp
    ```
    
    ### ⚠️ 初始化选项 (重要)
    *   **项目名称**: sitclock-mp
    *   **使用框架**: **React**
    *   **是否使用 TypeScript**: **是 (Yes)**
    *   **CSS 预处理器**: **Sass** (推荐)
    *   **编译工具**: **Webpack5** (🚨 请选这个，兼容性最稳)
    *   **包管理工具**: npm 或 yarn
    *   **模板源**: Gitee (国内快) 或 Github
    *   **模板**: 默认模板

---

## 二、项目配置

### 1. 配置域名 (src/app.config.ts)
修改 `src/app.config.ts`，配置页面和底部导航栏。

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
    selectedColor: "#4f46e5", // Indigo-600
    backgroundColor: "#ffffff",
    list: [
      { 
        pagePath: "pages/index/index", 
        text: "监测", 
        iconPath: "./assets/home.png", 
        selectedIconPath: "./assets/home_active.png" 
      },
      { 
        pagePath: "pages/workouts/index", 
        text: "课程", 
        iconPath: "./assets/gym.png", 
        selectedIconPath: "./assets/gym_active.png" 
      },
      { 
        pagePath: "pages/profile/index", 
        text: "我的", 
        iconPath: "./assets/user.png", 
        selectedIconPath: "./assets/user_active.png" 
      }
    ]
  }
})
```
*注意：你需要找 6 张小图标放在 `src/assets` 文件夹下才能看到 TabBar 图标，否则只有文字。*

---

## 三、核心代码实现

### 1. 封装请求 (src/utils/request.ts)
新建文件 `src/utils/request.ts`。小程序不能用 fetch，必须封装 `Taro.request`。

```typescript
import Taro from '@tarojs/taro';

// ⚠️ 必须是 HTTPS，且在微信后台配置了合法域名
// 开发时如果不想配置域名，可以在微信开发者工具右上角 "详情" -> "本地设置" -> 勾选 "不校验合法域名"
const BASE_URL = 'https://www.sitclock.com/api'; 

export const request = async (url: string, method: 'GET'|'POST' = 'GET', data?: any) => {
  try {
    const res = await Taro.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: {
        'content-type': 'application/json'
      }
    });
    return res.data;
  } catch (err) {
    Taro.showToast({ title: '网络错误', icon: 'none' });
    throw err;
  }
};
```

### 2. 首页监测 (src/pages/index/index.tsx)
移植计时器逻辑。注意：Taro 中没有 `div/span`，要用 `View/Text`。

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { request } from '../../utils/request';
import './index.scss';

export default function Index() {
  const [sedentaryTime, setSedentaryTime] = useState(0);
  const [isMonitoring, setIsMonitoring] = useState(true);

  // 格式化时间 MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  useEffect(() => {
    let interval: any;
    if (isMonitoring) {
      interval = setInterval(() => {
        setSedentaryTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isMonitoring]);

  const handleMoved = () => {
    // 假设这里 hardcode 一个 userId 用于演示，实际应先做登录逻辑
    // request('/stats', 'POST', { userId: '...', todaySedentaryMinutes: ... })
    
    Taro.showToast({ title: '太棒了！', icon: 'success' });
    setSedentaryTime(0);
  };

  return (
    <View className='container' style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <View style={{ width: '200px', height: '200px', borderRadius: '50%', border: '8px solid #e0e7ff', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '40px 0', position: 'relative' }}>
         <View style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', border: '8px solid #4f46e5', borderTopColor: 'transparent', transform: 'rotate(-45deg)' }}></View>
         <View style={{ textAlign: 'center' }}>
             <Text style={{ fontSize: '48px', fontWeight: 'bold', display: 'block', color: '#333' }}>
                {formatTime(sedentaryTime)}
             </Text>
             <Text style={{ fontSize: '14px', color: '#666' }}>久坐时长</Text>
         </View>
      </View>

      <View style={{ width: '100%', gap: '10px', display: 'flex' }}>
         <Button onClick={() => setIsMonitoring(!isMonitoring)} style={{ flex: 1, backgroundColor: isMonitoring ? '#fff' : '#4f46e5', color: isMonitoring ? '#333' : '#fff' }}>
            {isMonitoring ? '暂停' : '继续'}
         </Button>
         <Button onClick={handleMoved} style={{ flex: 1, backgroundColor: '#fff', color: '#4f46e5', border: '1px solid #e5e7eb' }}>
            动了一下
         </Button>
      </View>
    </View>
  );
}
```

### 3. AI 课程页 (src/pages/workouts/index.tsx)
调用后端 AI 接口。

```tsx
import React, { useState } from 'react';
import { View, Text, Button, Image } from '@tarojs/components';
import { request } from '../../utils/request';

export default function Workouts() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      // 调用我们在 server.js 里写的接口
      const res = await request('/generate-workout', 'POST', {
        focusArea: 'neck',
        language: 'zh'
      });
      setPlans(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: '16px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <Button 
        onClick={generate} 
        disabled={loading}
        style={{ backgroundColor: '#4f46e5', color: 'white', marginBottom: '20px' }}
      >
        {loading ? 'AI 生成中...' : '生成肩颈放松计划'}
      </Button>
      
      {plans.map((item) => (
        <View key={item.id} style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
           <Image src={item.imageUrl} style={{ width: '100%', height: '150px' }} mode='aspectFill' />
           <View style={{ padding: '16px' }}>
               <View style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                   <Text style={{ fontWeight: 'bold', fontSize: '18px' }}>{item.name}</Text>
                   <Text style={{ fontSize: '12px', color: '#4f46e5', backgroundColor: '#e0e7ff', padding: '2px 8px', borderRadius: '4px' }}>{item.category}</Text>
               </View>
               <Text style={{ fontSize: '14px', color: '#666', lineHeight: '1.5' }}>{item.description}</Text>
           </View>
        </View>
      ))}
    </View>
  );
}
```

---

## 四、部署上线

1.  **运行开发模式**:
    ```bash
    npm run dev:weapp
    ```
    这将生成一个 `dist` 目录。

2.  **打开微信开发者工具**:
    *   导入项目目录（选择包含 `dist` 的那个根目录）。
    *   填写你的 AppID。
    *   **重要**: 如果没有配置合法域名，请在工具右上角 "详情" -> "本地设置" -> 勾选 "**不校验合法域名...**" 方便测试。

3.  **配置合法域名 (上线必做)**:
    *   登录微信公众平台 -> 开发 -> 开发管理 -> 开发设置。
    *   request合法域名: `https://www.sitclock.com`
    *   downloadFile合法域名: `https://www.sitclock.com` 和 `https://picsum.photos`
