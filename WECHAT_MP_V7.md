
# SitClock 微信小程序 V7.0 终极源码 (WECHAT_MP_V7)

**请注意：这是一个全新的指导文件。请按照以下步骤，将代码复制到您的 Taro 项目中。**

---

## 1. 公共逻辑: `src/constants.ts`
*修复点：移除 `?.` 语法，防止报错。*

```typescript
export const INSPIRATIONAL_QUOTES = [
  { en: "Motion is the lotion.", zh: "生命在于运动。" },
  { en: "Small steps, big changes.", zh: "不积跬步，无以至千里。" },
  { en: "Your body is your temple.", zh: "身体是革命的本钱。" },
  { en: "Consistency is key.", zh: "坚持就是胜利。" }
];

export const getBadges = (stats: any, todayMinutes: number) => {
  // [FIX] 使用 && 替代 ?. 以兼容旧版基础库
  const total = (stats && stats.total_workouts) ? stats.total_workouts : 0;
  const streak = (stats && stats.current_streak) ? stats.current_streak : 0;
  const isWithinBudget = todayMinutes <= 480;

  return [
    { id: '1', name: '初次启程', icon: '🚀', unlocked: total >= 1, description: '累计完成1次课程' },
    { id: '2', name: '3天连胜', icon: '🔥', unlocked: streak >= 3, description: '连续3天打卡' },
    { id: 'budget', name: '自律卫士', icon: '⚖️', unlocked: total > 0 && isWithinBudget, description: '今日久坐<8小时且已活动' },
    { id: '3', name: '健身达人', icon: '💪', unlocked: total >= 20, description: '累计完成20次' },
    { id: '4', name: '颈椎救星', icon: '🦒', unlocked: total >= 50, description: '累计完成50次' },
    { id: '8', name: '7天连胜', icon: '🏆', unlocked: streak >= 7, description: '连续7天打卡' },
  ];
};
```

---

## 2. 请求封装: `src/utils/request.ts`

```typescript
import Taro from '@tarojs/taro';

// [重要] 请确保此处为 HTTPS，且已在微信后台配置合法域名
const BASE_URL = 'https://www.sitclock.com/api'; 

export const request = async (url: string, method: 'GET'|'POST' = 'GET', data?: any) => {
  try {
    const res = await Taro.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: { 'content-type': 'application/json' }
    });
    // [重要] 如果后端返回 500/400，视为请求失败
    if (res.statusCode >= 400) {
        throw new Error(res.data.error || 'Server Error');
    }
    return res.data;
  } catch (err) {
    console.error(err);
    Taro.showToast({ title: '网络请求失败', icon: 'none' });
    throw err;
  }
};
```

---

## 3. 全局配置: `src/app.config.ts`

```typescript
export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/workouts/index',
    'pages/player/index', // 确保这个页面存在
    'pages/stats/index',
    'pages/profile/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'SitClock',
    navigationBarTextStyle: 'black'
  },
  // 开启按需注入，提升性能
  lazyCodeLoading: "requiredComponents",
  tabBar: {
    color: "#999",
    selectedColor: "#4f46e5",
    backgroundColor: "#ffffff",
    list: [
      { pagePath: "pages/index/index", text: "监测" },
      { pagePath: "pages/workouts/index", text: "课程" },
      { pagePath: "pages/stats/index", text: "数据" },
      { pagePath: "pages/profile/index", text: "我的" }
    ]
  }
})
```

---

## 4. 监测页 (首页): `src/pages/index/index.tsx`
*修复点：UI 使用 rpx，增加公告弹窗，增加呼吸灯动画。*

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { request } from '../../utils/request';
import './index.scss';

export default function Index() {
  const [sedentaryTime, setSedentaryTime] = useState(0);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [quickTimerLeft, setQuickTimerLeft] = useState(0);
  const [announcement, setAnnouncement] = useState<any>(null);
  const [showAnn, setShowAnn] = useState(false);

  // 每次显示页面时拉取公告
  useDidShow(async () => {
      try {
          const list = await request('/announcements');
          if(list && list.length > 0) setAnnouncement(list[0]);
      } catch(e){}
  });

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // 正计时逻辑
  useEffect(() => {
    let interval: any;
    if (isMonitoring && quickTimerLeft === 0) {
      interval = setInterval(() => setSedentaryTime(p => p + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isMonitoring, quickTimerLeft]);

  // 倒计时逻辑
  useEffect(() => {
    let interval: any;
    if (quickTimerLeft > 0) {
      interval = setInterval(() => {
        setQuickTimerLeft(prev => {
          if (prev <= 1) {
             Taro.showToast({ title: '时间到了！', icon: 'none' });
             Taro.vibrateLong();
             return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [quickTimerLeft]);

  return (
    <View className='container'>
      {/* 公告弹窗 */}
      {showAnn && announcement && (
          <View className='modal-mask' onClick={()=>setShowAnn(false)}>
              <View className='modal' onClick={e=>e.stopPropagation()}>
                  <Text className='m-title'>{announcement.title}</Text>
                  <Text className='m-content'>{announcement.content}</Text>
                  <Button className='m-btn' onClick={()=>setShowAnn(false)}>关闭</Button>
              </View>
          </View>
      )}

      <View className='header'>
          <Text className='title'>SitClock</Text>
          {announcement && <Text className='ann-btn' onClick={()=>setShowAnn(true)}>🔔 公告</Text>}
      </View>
      
      {/* 呼吸灯圆环 */}
      <View className={`circle ${quickTimerLeft > 0 ? 'red' : ''} ${isMonitoring ? 'pulse' : ''}`}>
         <Text className='time'>{formatTime(quickTimerLeft || sedentaryTime)}</Text>
         <Text className='label'>{quickTimerLeft > 0 ? '倒计时' : '久坐时长'}</Text>
      </View>

      <View className='quick-row'>
          {[30, 45, 60].map(m => (
              <Button key={m} className='pill' onClick={() => setQuickTimerLeft(m*60)}>{m}分</Button>
          ))}
          <Button className='pill' onClick={() => setQuickTimerLeft(0)}>重置</Button>
      </View>

      <View className='row'>
         <Button className='btn outline' onClick={() => setIsMonitoring(!isMonitoring)}>{isMonitoring ? '暂停' : '继续'}</Button>
         <Button className='btn primary' onClick={()=>{Taro.showToast({title:'状态重置',icon:'success'});setSedentaryTime(0)}}>动一下</Button>
      </View>
    </View>
  );
}
```

**对应的 `src/pages/index/index.scss`:**
```scss
.container { padding: 40rpx; align-items: center; display: flex; flex-direction: column; }
.header { width: 100%; display: flex; justify-content: space-between; align-items: center; margin-bottom: 40rpx; }
.title { font-size: 48rpx; font-weight: bold; color: #333; }
.ann-btn { font-size: 28rpx; color: #4f46e5; background: #e0e7ff; padding: 10rpx 20rpx; border-radius: 30rpx; }
.circle { width: 480rpx; height: 480rpx; border-radius: 50%; border: 20rpx solid #e0e7ff; display: flex; flex-direction: column; justify-content: center; align-items: center; margin: 40rpx 0; }
.circle.red { border-color: #fee2e2; }
.circle.pulse { animation: pulse 2s infinite; }
@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.02); } 100% { transform: scale(1); } }
.time { font-size: 100rpx; font-weight: bold; font-family: monospace; color: #4f46e5; }
.circle.red .time { color: #dc2626; }
.label { font-size: 28rpx; color: #888; margin-top: 10rpx; }
.quick-row { display: flex; gap: 20rpx; margin-bottom: 40rpx; }
.pill { font-size: 28rpx; padding: 0 30rpx; border-radius: 40rpx; background: white; line-height: 60rpx; height: 60rpx; }
.row { width: 100%; display: flex; gap: 30rpx; }
.btn { flex: 1; border-radius: 24rpx; height: 100rpx; line-height: 100rpx; font-size: 32rpx; }
.primary { background: #4f46e5; color: white; }
.outline { background: white; color: #4f46e5; border: 2rpx solid #4f46e5; }
.modal-mask { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 99; display: flex; align-items: center; justify-content: center; }
.modal { width: 600rpx; background: white; border-radius: 30rpx; padding: 40rpx; display: flex; flex-direction: column; }
.m-title { font-size: 36rpx; font-weight: bold; margin-bottom: 20rpx; }
.m-content { font-size: 28rpx; color: #666; line-height: 1.5; margin-bottom: 40rpx; }
.m-btn { width: 100%; background: #4f46e5; color: white; }
```

---

## 5. 课程页: `src/pages/workouts/index.tsx`
*修复点：分类筛选，AI 调用错误处理。*

```tsx
import React, { useState } from 'react';
import { View, Text, Button, Image, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { request } from '../../utils/request';
import './index.scss';

export default function Workouts() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [cat, setCat] = useState('neck');

  const gen = async () => {
    setLoading(true);
    try {
      // 代理请求后端 AI 接口
      const res = await request('/generate-workout', 'POST', { focusArea: cat, language: 'zh' });
      if (Array.isArray(res)) {
          setPlans(res);
      } else {
          throw new Error('格式错误');
      }
    } catch (e) {
      Taro.showToast({title:'生成失败，请重试',icon:'none'});
    } finally { setLoading(false); }
  };

  const start = (item: any) => {
      // 跳转到播放器，传递课程数据
      Taro.navigateTo({ url: `/pages/player/index?data=${encodeURIComponent(JSON.stringify(item))}` });
  };

  return (
    <View className='page'>
       <ScrollView scrollX className='tabs'>
          {['neck','waist','eyes','fullbody'].map(c => (
              <View key={c} className={`tab ${cat===c?'active':''}`} onClick={()=>setCat(c)}><Text>{c}</Text></View>
          ))}
       </ScrollView>
       <View className='banner'>
           <View>
               <Text className='b-title'>AI 智能计划生成</Text>
               <Text className='b-desc'>定制您的2分钟微健身</Text>
           </View>
           <Button className='b-btn' onClick={gen} disabled={loading}>{loading?'生成中...':'立即生成'}</Button>
       </View>
       {plans.length === 0 && <Text className='empty'>暂无计划，点击上方生成</Text>}
       {plans.map((item, i) => (
           <View key={i} className='card' onClick={() => start(item)}>
               <Image src={item.imageUrl} className='img' mode='aspectFill' />
               <View className='info'>
                   <Text className='name'>{item.name}</Text>
                   <Text className='dur'>{item.duration}秒</Text>
               </View>
               <Button className='play-btn'>开始</Button>
           </View>
       ))}
    </View>
  );
}
```

---

## 6. 播放器页: `src/pages/player/index.tsx`
*修复点：增加 `isReady` 状态，修复进入页面瞬间自动完成的 Bug。*

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Button, Image } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { request } from '../../utils/request';
import './index.scss';

export default function Player() {
  const router = useRouter();
  const [ex, setEx] = useState<any>(null);
  const [time, setTime] = useState(45); 
  const [active, setActive] = useState(false); 
  const [isReady, setIsReady] = useState(false); // [FIX] 新增准备状态

  useEffect(() => {
      if (router.params.data) {
          try {
              const item = JSON.parse(decodeURIComponent(router.params.data));
              setEx(item);
              setTime(item.duration || 45); 
              setIsReady(true); // 数据解析成功后，才标记为 Ready
              setActive(true);  // 开始计时
          } catch (e) {
              Taro.navigateBack();
          }
      }
  }, [router]);

  useEffect(() => {
      let interval: any;
      // [FIX] 必须 isReady 且 time > 0 才能开始倒计时
      if (isReady && active && time > 0) {
          interval = setInterval(() => {
              setTime(t => t - 1);
          }, 1000);
      } else if (isReady && time === 0 && active) {
          // 只有当 isReady 且 time 归零时，才结束
          finish();
      }
      return () => clearInterval(interval);
  }, [active, time, isReady]);

  const finish = async () => {
      setActive(false);
      const user = Taro.getStorageSync('user');
      if (user) {
          try {
              // 自动同步完成数据到后端
              await request('/stats', 'POST', {
                  userId: user.id,
                  totalWorkouts: 1, // 触发后端累加
                  currentStreak: 0 // 后端会处理
              });
          } catch(e) {}
      }
      Taro.showToast({title:'完成！', icon:'success'});
      setTimeout(() => Taro.navigateBack(), 1500);
  };

  if (!isReady || !ex) return <View className='p-loading'>加载中...</View>;

  return (
    <View className='p-page'>
        <Image src={ex.imageUrl} className='p-bg' mode='aspectFill' />
        <View className='overlay'>
            <View className='circle'>
                <Text className='count'>{time}</Text>
                <Text className='status'>{active ? '跟练中' : '已暂停'}</Text>
            </View>
            <Text className='p-name'>{ex.name}</Text>
            <Text className='p-desc'>{ex.description}</Text>
            <View className='p-ctrl'>
                <Button className='c-btn' onClick={() => setActive(!active)}>{active ? '暂停' : '继续'}</Button>
                <Button className='c-btn stop' onClick={() => Taro.navigateBack()}>退出</Button>
            </View>
        </View>
    </View>
  );
}
```

---

## 7. 数据页: `src/pages/stats/index.tsx`
*修复点：使用 ScrollView 支持图表左右拖动，数据真实拉取。*

```tsx
import React, { useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { request } from '../../utils/request';
import './index.scss';

export default function Stats() {
  const [data, setData] = useState<any>(null);

  useDidShow(async () => {
      const user = Taro.getStorageSync('user');
      if (user) {
          try {
              const res = await request(`/stats?userId=${user.id}`);
              setData(res);
          } catch(e) {}
      }
  });

  const todayMinutes = (data && data.activity && data.activity.length > 0) 
      ? data.activity[data.activity.length-1].sedentary_minutes 
      : 0;
  
  const percent = Math.min((todayMinutes / 480) * 100, 100);

  return (
    <View className='s-page'>
        <View className='card'>
            <Text className='head'>健康久坐预算 (8小时)</Text>
            <View className='progress'><View className='fill' style={{width: `${percent}%`}}></View></View>
            <Text className='sub'>已用 {Math.floor(todayMinutes/60)}小时{todayMinutes%60}分</Text>
        </View>
        <View className='card'>
            <Text className='head'>周趋势 (可左右滑动)</Text>
            {/* ScrollView for chart */}
            <ScrollView scrollX className='chart-scroll'>
                <View className='chart'>
                    {(data && data.activity) ? data.activity.map((d, i) => (
                        <View key={i} className='bar-box'>
                            <View className='bar' style={{height: `${Math.min(d.sedentary_minutes, 300)}rpx`}}></View>
                            <Text className='day'>{d.activity_date_str.slice(5)}</Text>
                        </View>
                    )) : <Text className='empty'>暂无数据</Text>}
                </View>
            </ScrollView>
        </View>
    </View>
  );
}
```

---

## 8. 个人中心: `src/pages/profile/index.tsx`
*修复点：**严格安全登录**。通过强制检查 API 返回的 `res.user`，杜绝任何本地模拟登录，确保邮箱账号同步真实有效。*

```tsx
import React, { useState } from 'react';
import { View, Text, Button, Input, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { request } from '../../utils/request';
import { getBadges, INSPIRATIONAL_QUOTES } from '../../constants';
import './index.scss';

export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loginMode, setMode] = useState(true); 
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');

  useDidShow(() => {
     const u = Taro.getStorageSync('user');
     if (u) {
         setUser(u);
         loadStats(u.id);
     }
  });

  const loadStats = async (uid) => {
      try {
          const res = await request(`/stats?userId=${uid}`);
          setStats(res);
      } catch(e) {}
  };

  const wxLogin = async () => {
      try {
          // 1. 获取用户信息 (头像昵称)
          const { userInfo } = await Taro.getUserProfile({ desc: '完善资料' });
          // 2. 获取登录 Code
          const { code } = await Taro.login();
          // 3. 发送给后端验证
          const res = await request('/wechat-login', 'POST', { code, userInfo });
          
          // [STRICT] 只有后端返回 user 对象，才算登录成功
          if (res && res.user) {
              Taro.setStorageSync('user', res.user);
              setUser(res.user);
              loadStats(res.user.id);
          } else {
              throw new Error('Server validation failed');
          }
      } catch(e) { 
          Taro.showToast({title:'微信登录失败',icon:'none'}); 
      }
  };

  const emailLogin = async () => {
      try {
          if (!email || !pass) {
              Taro.showToast({title:'请输入账号密码',icon:'none'});
              return;
          }
          // [STRICT] 调用真实后端登录接口
          const res = await request('/login', 'POST', { email, password: pass });
          
          // [STRICT] 只有后端返回 user 对象，才算登录成功
          if (res && res.user) {
              Taro.setStorageSync('user', res.user);
              setUser(res.user);
              loadStats(res.user.id); // 立即同步 Web 端数据
              Taro.showToast({title:'同步成功',icon:'success'});
          } else {
              throw new Error('Invalid credentials');
          }
      } catch(e) { 
          Taro.showToast({title:'账号或密码错误',icon:'none'}); 
      }
  };

  if (!user) {
      return (
          <View className='login-box'>
              <Text className='l-title'>SitClock</Text>
              {loginMode ? (
                  <>
                    <Button className='wx-btn' onClick={wxLogin}>微信一键登录</Button>
                    <Text className='link' onClick={()=>setMode(false)}>使用邮箱账号同步 &gt;</Text>
                  </>
              ) : (
                  <>
                    <Input className='inp' placeholder='邮箱' onInput={e=>setEmail(e.detail.value)} />
                    <Input className='inp' password placeholder='密码' onInput={e=>setPass(e.detail.value)} />
                    <Button className='e-btn' onClick={emailLogin}>登录同步</Button>
                    <Text className='link' onClick={()=>setMode(true)}>&lt; 返回微信登录</Text>
                  </>
              )}
          </View>
      )
  }

  const todayMin = (stats && stats.activity && stats.activity.length > 0) 
      ? stats.activity[stats.activity.length-1].sedentary_minutes 
      : 0;
  
  const badges = getBadges(stats ? stats.stats : null, todayMin);
  const quote = INSPIRATIONAL_QUOTES[new Date().getDate() % INSPIRATIONAL_QUOTES.length];

  return (
    <View className='page'>
       <View className='u-card'>
           <Image src={user.avatar || ''} className='avi' />
           <View>
               <Text className='u-name'>{user.name}</Text>
               <Text className='u-quote'>{quote.zh}</Text>
           </View>
       </View>
       
       <View className='b-sec'>
           <Text className='st'>勋章墙</Text>
           <View className='grid'>
               {badges.map(b => (
                   <View key={b.id} className={`b-item ${b.unlocked?'on':''}`}>
                       <Text className='icon'>{b.icon}</Text>
                       <Text className='bn'>{b.name}</Text>
                   </View>
               ))}
           </View>
       </View>
       
       <Button className='out' onClick={()=>{Taro.removeStorageSync('user');setUser(null)}}>退出登录</Button>
    </View>
  );
}
```
