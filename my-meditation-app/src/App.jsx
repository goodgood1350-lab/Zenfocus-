import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, CheckCircle2, Circle, Plus, X, Volume2, VolumeX, Moon, Sun, Coffee, Brain, Armchair } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// -----------------------------------------------------------------------------
// 聲音合成器 (使用 Web Audio API，無需外部文件，解決跨域和資源加載問題)
// -----------------------------------------------------------------------------
const AudioEngine = () => {
  const audioCtxRef = useRef(null);
  const noiseNodeRef = useRef(null);
  const gainNodeRef = useRef(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioContext();
    }
  };

  const playBrownNoise = () => {
    initAudio();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    // 創建緩衝區
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    // 生成布朗噪聲 (Brown Noise) - 比白噪聲更低沉，適合專注
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5; // 補償增益
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0.05; // 默認音量

    noise.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    noise.start(0);
    
    noiseNodeRef.current = noise;
    gainNodeRef.current = gainNode;
  };

  const stopNoise = () => {
    if (noiseNodeRef.current) {
      noiseNodeRef.current.stop();
      noiseNodeRef.current.disconnect();
      noiseNodeRef.current = null;
    }
  };

  const playAlarm = () => {
    initAudio();
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  };

  return { playBrownNoise, stopNoise, playAlarm };
};

// -----------------------------------------------------------------------------
// 主應用組件
// -----------------------------------------------------------------------------
export default function ZenFocusApp() {
  // 狀態管理
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('focus'); // focus, short, long
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [isDark, setIsDark] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  // 引用 Audio Engine
  const audio = useRef(AudioEngine());

  // 模式配置
  const MODES = {
    focus: { time: 25 * 60, label: '專注', icon: Brain, color: 'text-rose-500', ring: 'stroke-rose-500' },
    short: { time: 5 * 60, label: '短休', icon: Coffee, color: 'text-emerald-500', ring: 'stroke-emerald-500' },
    long: { time: 15 * 60, label: '長休', icon: Armchair, color: 'text-blue-500', ring: 'stroke-blue-500' },
  };

  // 切換模式
  const switchMode = (newMode) => {
    setMode(newMode);
    setTimeLeft(MODES[newMode].time);
    setIsActive(false);
    audio.current.stopNoise();
    setIsMuted(true); // 切換模式時自動靜音
  };

  // 倒計時邏輯
  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      audio.current.playAlarm();
      audio.current.stopNoise();
      setIsMuted(true);
      if (mode === 'focus' && activeTaskId) {
        // 自動增加任務的番茄鐘計數
        setTasks(prev => prev.map(t => t.id === activeTaskId ? { ...t, sessions: t.sessions + 1 } : t));
      }
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, mode, activeTaskId]);

  // 聲音控制
  const toggleSound = () => {
    if (isMuted) {
      audio.current.playBrownNoise();
      setIsMuted(false);
    } else {
      audio.current.stopNoise();
      setIsMuted(true);
    }
  };

  // 任務管理
  const addTask = (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    const task = {
      id: Date.now(),
      text: newTask,
      completed: false,
      sessions: 0
    };
    setTasks([...tasks, task]);
    setNewTask('');
    if (!activeTaskId) setActiveTaskId(task.id);
  };

  const toggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = (id) => {
    setTasks(tasks.filter(t => t.id !== id));
    if (activeTaskId === id) setActiveTaskId(null);
  };

  // 格式化時間 mm:ss
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 計算圓形進度條
  const totalTime = MODES[mode].time;
  const progress = ((totalTime - timeLeft) / totalTime) * 100;
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'} font-sans`}>
      
      {/* 頂部導航 */}
      <nav className="p-6 flex justify-between items-center max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
            <Brain className="w-6 h-6 text-indigo-500" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">ZenFocus</h1>
        </div>
        <button 
          onClick={() => setIsDark(!isDark)}
          className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-600'}`}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </nav>

      <main className="max-w-2xl mx-auto px-6 pb-20">
        
        {/* 模式選擇器 */}
        <div className={`flex justify-center gap-2 mb-12 p-1 rounded-2xl ${isDark ? 'bg-slate-800/50' : 'bg-slate-200/50'} backdrop-blur-sm`}>
          {Object.entries(MODES).map(([key, config]) => (
            <button
              key={key}
              onClick={() => switchMode(key)}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                mode === key 
                  ? `${isDark ? 'bg-slate-700 text-white shadow-lg' : 'bg-white text-slate-900 shadow-md'}` 
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              <config.icon className="w-4 h-4" />
              {config.label}
            </button>
          ))}
        </div>

        {/* 計時器主體 */}
        <div className="relative flex flex-col items-center justify-center mb-16">
          {/* SVG 圓環 */}
          <div className="relative w-80 h-80">
            <svg className="w-full h-full transform -rotate-90">
              {/* 背景圓環 */}
              <circle
                cx="160"
                cy="160"
                r={radius}
                className={`${isDark ? 'stroke-slate-800' : 'stroke-slate-200'}`}
                strokeWidth="12"
                fill="transparent"
              />
              {/* 進度圓環 */}
              <motion.circle
                cx="160"
                cy="160"
                r={radius}
                className={`${MODES[mode].ring} transition-all duration-1000`}
                strokeWidth="12"
                fill="transparent"
                strokeLinecap="round"
                strokeDasharray={circumference}
                animate={{ strokeDashoffset }}
                initial={{ strokeDashoffset: circumference }}
              />
            </svg>
            
            {/* 中間的時間顯示 */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className={`text-7xl font-bold tracking-tighter tabular-nums ${MODES[mode].color}`}>
                {formatTime(timeLeft)}
              </div>
              <p className={`mt-2 text-sm font-medium uppercase tracking-widest opacity-60`}>
                {isActive ? '專注中' : '已暫停'}
              </p>
            </div>
          </div>

          {/* 控制按鈕 */}
          <div className="flex items-center gap-6 mt-8">
            <button 
              onClick={toggleSound}
              className={`p-4 rounded-full transition-all ${
                !isMuted 
                  ? 'bg-indigo-500/10 text-indigo-500' 
                  : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-500'
              }`}
              title="白噪音 (Brown Noise)"
            >
              {!isMuted ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>

            <button
              onClick={() => setIsActive(!isActive)}
              className={`p-6 rounded-3xl shadow-xl transition-transform active:scale-95 flex items-center justify-center ${
                isActive 
                  ? 'bg-amber-500 hover:bg-amber-400 text-white' 
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {isActive ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
            </button>

            <button 
              onClick={() => {
                setIsActive(false);
                setTimeLeft(MODES[mode].time);
                audio.current.stopNoise();
                setIsMuted(true);
              }}
              className={`p-4 rounded-full transition-all ${isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-200 hover:bg-slate-300'}`}
            >
              <RotateCcw className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* 任務列表區域 */}
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-indigo-500" />
              待辦事項
            </h2>
            <span className="text-xs font-medium px-2 py-1 rounded-md bg-indigo-500/10 text-indigo-500">
              {tasks.filter(t => !t.completed).length} 待完成
            </span>
          </div>

          <form onSubmit={addTask} className="relative mb-6 group">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="現在要專注做什麼？"
              className={`w-full p-4 pr-12 rounded-xl outline-none transition-all border-2 ${
                isDark 
                  ? 'bg-slate-800 border-slate-700 focus:border-indigo-500 placeholder-slate-500' 
                  : 'bg-white border-slate-200 focus:border-indigo-500 placeholder-slate-400'
              }`}
            />
            <button 
              type="submit"
              disabled={!newTask.trim()}
              className="absolute right-2 top-2 bottom-2 px-3 rounded-lg bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </form>

          <div className="space-y-3">
            <AnimatePresence>
              {tasks.length === 0 && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                  className="text-center py-8 opacity-40 text-sm"
                >
                  沒有任務。享受當下，或者添加一個新目標。
                </motion.div>
              )}
              {tasks.map((task) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`group relative p-4 rounded-xl border-l-4 transition-all ${
                    activeTaskId === task.id 
                      ? 'border-indigo-500 bg-indigo-500/5' 
                      : task.completed 
                        ? 'border-emerald-500 opacity-60' 
                        : 'border-transparent'
                  } ${isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-white shadow-sm hover:shadow-md'}`}
                >
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => toggleTask(task.id)}
                      className={`flex-shrink-0 transition-colors ${task.completed ? 'text-emerald-500' : 'text-slate-400 hover:text-indigo-500'}`}
                    >
                      {task.completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                    </button>
                    
                    <div 
                      className="flex-grow cursor-pointer"
                      onClick={() => setActiveTaskId(task.id)}
                    >
                      <p className={`font-medium ${task.completed ? 'line-through' : ''}`}>{task.text}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs opacity-60">
                        {activeTaskId === task.id && <span className="text-indigo-500 font-bold">當前專注</span>}
                        <span>{task.sessions} 個番茄鐘</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => deleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-rose-500 transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

