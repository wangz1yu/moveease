
# SitClock 微信小程序 V7.1 终极安全版源码

此文件包含了修复“假登录”漏洞的完整代码。请严格按照以下内容覆盖您的文件。

---

## 1. 请求拦截器: `src/utils/request.ts`
*修复点：增加状态码检查，如果后端返回 401（密码错误），直接抛出错误，防止前端误判为成功。*

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

    // [SECURITY FIX] 严格校验 HTTP 状态码
    // 如果是 401 (密码错误) 或 500 (服务器错误)，视为请求失败
    if (res.statusCode >= 400) {
        console.error('API Error:', res.data);
        const errMsg = (res.data && res.data.message) ? res.data.message : '请求失败';
        throw new Error(errMsg);
    }

    return res.data;
  } catch (err: any) {
    console.error('Request Failed:', err);
    // 抛出错误供组件捕获
    throw err;
  }
};
```

---

## 2. 个人中心 (登录页): `src/pages/profile/index.tsx`
*修复点：**彻底删除 Mock 逻辑**。只有 API 成功返回用户对象时，才设置状态。*

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
  const [loginMode, setMode] = useState(true); // true=微信, false=邮箱
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);

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
      } catch(e) {
          console.error('加载数据失败', e);
      }
  };

  const wxLogin = async () => {
      if(loading) return;
      setLoading(true);
      try {
          // 1. 获取用户信息
          const { userInfo } = await Taro.getUserProfile({ desc: '用于完善会员资料' });
          // 2. 获取登录 Code
          const { code } = await Taro.login();
          
          // 3. [真实请求] 发送给后端
          const res = await request('/wechat-login', 'POST', { code, userInfo });
          
          // [SECURITY] 只有后端返回了 user 数据，才算登录成功
          if (res && res.user && res.user.id) {
              Taro.setStorageSync('user', res.user);
              setUser(res.user);
              loadStats(res.user.id);
              Taro.showToast({title:'登录成功', icon:'success'});
          } else {
              throw new Error('登录验证失败');
          }
      } catch(e: any) { 
          // [SECURITY] 登录失败，只弹窗，绝不设置假用户
          const msg = e.message || '登录失败';
          Taro.showToast({title: msg, icon:'none'}); 
      } finally {
          setLoading(false);
      }
  };

  const emailLogin = async () => {
      if(loading) return;
      if (!email || !pass) {
          Taro.showToast({title:'请输入账号密码',icon:'none'});
          return;
      }
      setLoading(true);
      try {
          // [真实请求] 调用后端登录接口
          const res = await request('/login', 'POST', { email, password: pass });
          
          // [SECURITY] 严格校验：后端必须返回 200 且包含 user 对象
          if (res && res.user && res.user.id) {
              Taro.setStorageSync('user', res.user);
              setUser(res.user);
              loadStats(res.user.id); 
              Taro.showToast({title:'同步成功',icon:'success'});
          } else {
              throw new Error('服务端未返回用户信息');
          }
      } catch(e: any) { 
          // [SECURITY] 报错时直接提示错误，绝不 fallback 到本地模拟
          console.error("Email Login Error:", e);
          // 提取后端返回的错误信息 (如 Invalid credentials)
          const msg = e.message === 'Invalid credentials' ? '账号或密码错误' : '登录失败，请检查网络';
          Taro.showToast({title: msg, icon:'none'}); 
      } finally {
          setLoading(false);
      }
  };

  // 渲染登录界面
  if (!user) {
      return (
          <View className='login-box'>
              <Text className='l-title'>SitClock</Text>
              
              {loginMode ? (
                  <>
                    <Button className='wx-btn' onClick={wxLogin} disabled={loading}>
                        {loading ? '登录中...' : '微信一键登录'}
                    </Button>
                    <Text className='link' onClick={()=>setMode(false)}>使用邮箱账号同步 &gt;</Text>
                  </>
              ) : (
                  <>
                    <View className='form'>
                        <Input className='inp' placeholder='请输入邮箱' onInput={e=>setEmail(e.detail.value)} />
                        <Input className='inp' password placeholder='请输入密码' onInput={e=>setPass(e.detail.value)} />
                    </View>
                    <Button className='e-btn' onClick={emailLogin} disabled={loading}>
                        {loading ? '验证中...' : '登录同步'}
                    </Button>
                    <Text className='link' onClick={()=>setMode(true)}>&lt; 返回微信登录</Text>
                  </>
              )}
          </View>
      )
  }

  // 渲染个人中心 (登录后)
  const todayMin = (stats && stats.activity && stats.activity.length > 0) 
      ? stats.activity[stats.activity.length-1].sedentary_minutes 
      : 0;
  
  const badges = getBadges(stats ? stats.stats : null, todayMin);
  const quoteIndex = new Date().getDate() % INSPIRATIONAL_QUOTES.length;
  const quote = INSPIRATIONAL_QUOTES[quoteIndex];

  return (
    <View className='page'>
       <View className='u-card'>
           <Image src={user.avatar || 'https://picsum.photos/100'} className='avi' mode='aspectFill'/>
           <View>
               <Text className='u-name'>{user.name}</Text>
               <Text className='u-quote'>{quote ? quote.zh : '生命在于运动'}</Text>
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
       
       <Button className='out' onClick={()=>{Taro.removeStorageSync('user');setUser(null);setStats(null);}}>退出登录</Button>
    </View>
  );
}
```

---

## 3. 公共逻辑: `src/constants.ts`
*修复点：语法兼容性 (移除 ?.)*

```typescript
export const INSPIRATIONAL_QUOTES = [
  { en: "Motion is the lotion.", zh: "生命在于运动。" },
  { en: "Small steps, big changes.", zh: "不积跬步，无以至千里。" },
  { en: "Your body is your temple.", zh: "身体是革命的本钱。" },
  { en: "Consistency is key.", zh: "坚持就是胜利。" }
];

export const getBadges = (stats: any, todayMinutes: number) => {
  // [FIX] 使用 && 替代 ?. 以兼容所有微信基础库
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

## 4. 播放器: `src/pages/player/index.tsx`
*修复点：修复点击即完成BUG*

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
  const [isReady, setIsReady] = useState(false); 

  useEffect(() => {
      if (router.params.data) {
          try {
              const item = JSON.parse(decodeURIComponent(router.params.data));
              setEx(item);
              // 强制设置时间，防止为0
              const dur = (item.duration && item.duration > 0) ? item.duration : 45;
              setTime(dur); 
              setIsReady(true);
              setActive(true); 
          } catch (e) {
              Taro.navigateBack();
          }
      }
  }, [router]);

  useEffect(() => {
      let interval: any;
      if (isReady && active && time > 0) {
          interval = setInterval(() => {
              setTime(t => t - 1);
          }, 1000);
      } else if (isReady && time === 0 && active) {
          finish();
      }
      return () => clearInterval(interval);
  }, [active, time, isReady]);

  const finish = async () => {
      setActive(false);
      const user = Taro.getStorageSync('user');
      if (user) {
          try {
              await request('/stats', 'POST', {
                  userId: user.id,
                  totalWorkouts: 1, 
                  currentStreak: 0 
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

## 5. 数据页: `src/pages/stats/index.tsx`
*修复点：真实数据，支持滚动*

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

