
import { Badge, Exercise, Language, Announcement, Quote, UserStats } from './types';

export const TRANSLATIONS = {
  en: {
    common: {
      confirm: 'Confirm',
      cancel: 'Cancel',
      save: 'Save',
      back: 'Back',
      loading: 'Loading...',
      edit: 'Edit',
    },
    auth: {
      welcome: 'Welcome to SitClock',
      subtitle: 'Stay active, stay healthy.',
      login: 'Log In',
      register: 'Sign Up',
      name: 'Full Name',
      email: 'Email Address',
      password: 'Password',
      noAccount: "Don't have an account?",
      hasAccount: 'Already have an account?',
      authError: 'Invalid email or password',
      fillAll: 'Please fill in all fields',
      logout: 'Log Out',
    },
    nav: {
      monitor: 'Monitor',
      workouts: 'Workouts',
      stats: 'Stats',
      profile: 'Profile',
    },
    home: {
      tracking: 'Tracking Movement',
      paused: 'Monitoring Paused',
      dndActive: 'Do Not Disturb',
      sedentaryTime: 'Sedentary Time',
      zzz: 'Zzz...',
      resume: 'Resume',
      pause: 'Pause',
      moved: 'I Moved!',
      timeToMove: 'Time to Move!',
      moveDesc: "You've been sitting for over {min} minutes. Try a quick stretch.",
      autoPaused: 'Reminders are paused automatically.',
    },
    workouts: {
      title: 'Micro-Fitness',
      generatorTitle: 'Smart Plan Generator',
      generatorDesc: 'Feeling sore? Let AI build a custom 2-minute break for you.',
      generateBtn: 'Generate My Plan',
      generating: 'Generating...',
      recommended: 'Recommended for You',
      startActivity: 'Start Activity',
      duration: '{s}s',
    },
    player: {
      timeRemaining: 'Time Remaining',
      paused: 'Paused',
      completed: 'Completed!',
      goodJob: 'Great Job!',
      quitConfirm: 'Quit workout?',
      resume: 'Resume',
      quit: 'Quit',
      done: 'Done',
    },
    stats: {
      title: 'Your Activity',
      todaySedentary: "Today's Sedentary",
      activeBreaks: 'Active Breaks',
      weeklyTrends: 'Weekly Trends',
      units: { hours: 'hrs', times: 'times' },
    },
    profile: {
      streak: 'Day Streak',
      workouts: 'Workouts',
      badges: 'Badges',
      achievements: 'Achievements',
      dndSettings: 'Do Not Disturb & Schedules',
      sensorSettings: 'Sensor Sensitivity',
      language: 'Language / 语言',
      plan: 'Free Plan',
      editProfile: 'Edit Profile',
      avatarUrl: 'Avatar URL',
    },
    dnd: {
      title: 'Do Not Disturb',
      smartControls: 'Smart Controls',
      calendarSync: 'Calendar Sync',
      calendarDesc: "Auto-pause during 'Busy' events",
      smartDetect: 'Smart Detection',
      smartDetectDesc: 'Learn & pause during lunch breaks',
      schedules: 'Scheduled Quiet Hours',
      addNew: 'Add New',
      label: 'Label',
      labelPlaceholder: 'e.g. Deep Work',
      startTime: 'Start Time',
      endTime: 'End Time',
      saveSchedule: 'Save Schedule',
      noSchedules: 'No schedules set',
      noSchedulesDesc: "Tap 'Add New' to create a quiet time.",
      setLabel: 'Set {label}',
    },
    announcements: {
      title: 'Announcements',
      empty: 'No new announcements',
      adminTitle: 'Post New Announcement (Admin)',
      postBtn: 'Post Announcement',
      titlePh: 'Title',
      contentPh: 'Content goes here...',
    }
  },
  zh: {
    common: {
      confirm: '确认',
      cancel: '取消',
      save: '保存',
      back: '返回',
      loading: '加载中...',
      edit: '编辑',
    },
    auth: {
      welcome: '欢迎使用 SitClock',
      subtitle: '拒绝久坐，健康办公。',
      login: '登录',
      register: '注册账号',
      name: '昵称',
      email: '邮箱地址',
      password: '密码',
      noAccount: '还没有账号？',
      hasAccount: '已有账号？',
      authError: '邮箱或密码错误',
      fillAll: '请填写所有信息',
      logout: '退出登录',
    },
    nav: {
      monitor: '监测',
      workouts: '课程',
      stats: '数据',
      profile: '我的',
    },
    home: {
      tracking: '正在监测久坐',
      paused: '监测已暂停',
      dndActive: '勿扰模式',
      sedentaryTime: '久坐时长',
      zzz: '休息中...',
      resume: '继续',
      pause: '暂停',
      moved: '动了一下',
      timeToMove: '该动一动了！',
      moveDesc: "您已经连续坐了超过 {min} 分钟。起来伸个懒腰吧。",
      autoPaused: '提醒已自动暂停。',
    },
    workouts: {
      title: '微健身',
      generatorTitle: '智能计划生成',
      generatorDesc: '哪里酸痛？让AI为您定制2分钟的放松计划。',
      generateBtn: '生成我的计划',
      generating: '生成中...',
      recommended: '为您推荐',
      startActivity: '开始跟练',
      duration: '{s}秒',
    },
    player: {
      timeRemaining: '剩余时间',
      paused: '已暂停',
      completed: '完成！',
      goodJob: '做得好！',
      quitConfirm: '退出训练？',
      resume: '继续',
      quit: '退出',
      done: '完成',
    },
    stats: {
      title: '活动数据',
      todaySedentary: "今日久坐",
      activeBreaks: '活动次数',
      weeklyTrends: '周趋势',
      units: { hours: '小时', times: '次' },
    },
    profile: {
      streak: '连续达标',
      workouts: '完成课程',
      badges: '勋章',
      achievements: '成就墙',
      dndSettings: '勿扰模式与计划',
      sensorSettings: '传感器灵敏度',
      language: '语言 / Language',
      plan: '免费版',
      editProfile: '修改资料',
      avatarUrl: '头像链接',
    },
    dnd: {
      title: '勿扰设置',
      smartControls: '智能控制',
      calendarSync: '日历同步',
      calendarDesc: "在“忙碌”日程期间自动暂停",
      smartDetect: '智能感知',
      smartDetectDesc: '自动学习并暂停（如午休时间）',
      schedules: '计划静音时段',
      addNew: '添加',
      label: '标签',
      labelPlaceholder: '例如：深度工作',
      startTime: '开始时间',
      endTime: '结束时间',
      saveSchedule: '保存计划',
      noSchedules: '暂无计划',
      noSchedulesDesc: "点击“添加”设置您的静音时段。",
      setLabel: '设置{label}',
    },
    announcements: {
      title: '系统公告',
      empty: '暂无新公告',
      adminTitle: '发布新公告 (管理员)',
      postBtn: '发布公告',
      titlePh: '标题',
      contentPh: '公告内容...',
    }
  }
};

export const INSPIRATIONAL_QUOTES: Quote[] = [
  { en: "Motion is the lotion.", zh: "生命在于运动。" },
  { en: "Small steps, big changes.", zh: "不积跬步，无以至千里。" },
  { en: "Your body is your temple.", zh: "身体是革命的本钱。" },
  { en: "Take a break, recharge your mind.", zh: "适度休息，是为了走更远的路。" },
  { en: "Consistency is key.", zh: "坚持就是胜利。" },
  { en: "Move lightly, live brightly.", zh: "轻盈而动，精彩生活。" },
  { en: "Don't watch the clock; do what it does. Keep going.", zh: "不要盯着时钟，像它一样，勇往直前。" },
  { en: "Action is the foundational key to all success.", zh: "行动是所有成功的基石。" },
];

export const getMockExercises = (lang: Language): Exercise[] => {
  const isZh = lang === 'zh';
  return [
    {
      id: '1',
      name: isZh ? '颈部侧倾' : 'Neck Tilts',
      duration: 45,
      category: 'neck',
      description: isZh ? '头部轻轻向肩膀倾斜，保持5秒，然后换另一侧。感受颈部侧面的拉伸。' : 'Gently tilt your head towards your shoulder. Hold for 5 seconds, then switch sides. Feel the stretch along the side of your neck.',
      imageUrl: 'https://picsum.photos/400/300?random=1'
    },
    {
      id: '2',
      name: isZh ? '坐姿转体' : 'Seated Torso Twist',
      duration: 60,
      category: 'waist',
      description: isZh ? '坐在椅子上，双手握住椅背，向右扭转躯干，保持10秒，然后换左边。' : 'Sit in your chair, hold the backrest, and twist your torso to the right. Hold for 10s, then switch.',
      imageUrl: 'https://picsum.photos/400/300?random=2'
    },
    {
      id: '3',
      name: isZh ? '眼球运动' : 'Eye Rolling',
      duration: 30,
      category: 'eyes',
      description: isZh ? '顺时针转动眼球5次，然后逆时针转动5次。有助于缓解眼部疲劳。' : 'Roll your eyes clockwise 5 times, then counter-clockwise 5 times. Helps relieve eye strain.',
      imageUrl: 'https://picsum.photos/400/300?random=3'
    },
    {
      id: '4',
      name: isZh ? '耸肩放松' : 'Shoulder Shrugs',
      duration: 45,
      category: 'neck',
      description: isZh ? '将肩膀提至耳边，保持3秒后用力沉肩放松。重复此动作。' : 'Lift shoulders to ears, hold for 3 seconds, and drop them down to release tension. Repeat.',
      imageUrl: 'https://picsum.photos/400/300?random=4'
    }
  ];
};

export const getBadges = (lang: Language, stats?: UserStats): Badge[] => {
  const isZh = lang === 'zh';
  const total = stats?.totalWorkouts || 0;
  const streak = stats?.currentStreak || 0;

  return [
    { 
        id: '1', 
        name: isZh ? '初次启程' : 'First Step', 
        icon: '🚀', 
        unlocked: total >= 1, 
        description: isZh ? '完成你的第一次微健身。' : 'Complete your 1st micro-workout.' 
    },
    { 
        id: '2', 
        name: isZh ? '3天连胜' : '3-Day Streak', 
        icon: '🔥', 
        unlocked: streak >= 3, 
        description: isZh ? '连续3天至少完成1次课程。' : 'Complete at least 1 workout for 3 days in a row.' 
    },
    { 
        id: '3', 
        name: isZh ? '健身达人' : 'Fitness Pro', 
        icon: '💪', 
        unlocked: total >= 20, 
        description: isZh ? '累计完成20次课程。' : 'Accumulate 20 completed workouts.' 
    },
    { 
        id: '4', 
        name: isZh ? '颈椎救星' : 'Neck Saver', 
        icon: '🦒', 
        unlocked: total >= 50, 
        description: isZh ? '累计完成50次课程。' : 'Accumulate 50 completed workouts.' 
    },
    { 
        id: '5', 
        name: isZh ? '夜猫子' : 'Night Owl', 
        icon: '🦉', 
        unlocked: false, 
        description: isZh ? '在晚上10点后完成一次放松（开发中）。' : 'Complete a session after 10 PM (In Dev).' 
    },
    { 
        id: '6', 
        name: isZh ? '周末战士' : 'Weekend Warrior', 
        icon: '⚔️', 
        unlocked: false, 
        description: isZh ? '在周六和周日都完成了目标（开发中）。' : 'Hit goals on Sat & Sun (In Dev).' 
    },
    { 
        id: '7', 
        name: isZh ? '专注大师' : 'Focus Master', 
        icon: '🧘', 
        unlocked: false, 
        description: isZh ? '累计记录久坐时间超过50小时（开发中）。' : 'Log 50+ hours of sedentary time (In Dev).' 
    },
    { 
        id: '8', 
        name: isZh ? '7天连胜' : '7-Day Streak', 
        icon: '🏆', 
        unlocked: streak >= 7, 
        description: isZh ? '连续7天至少完成1次课程。' : 'Complete at least 1 workout for 7 days in a row.' 
    },
  ];
};

export const MOCK_ANNOUNCEMENTS: Announcement[] = [];
