import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, Schema } from "@google/genai";

// --- Types ---

interface MathProblem {
  question: string;
  answer: number;
  explanation: string;
  type: string; // e.g., "乘法分配律", "凑整法"
}

interface HistoryItem {
  problem: MathProblem;
  userAnswer: string;
  isCorrect: boolean;
}

// --- API Helper ---

const generateDailyProblems = async (): Promise<MathProblem[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    你是中国小学四年级的数学老师，专门负责训练学生的"巧算"（简便运算）能力。
    请生成10道适合四年级水平的巧算数学题。
    
    要求涵盖以下类型：
    1. 加法交换律和结合律 (凑整，如 134 + 258 + 66)
    2. 减法的性质 (如 452 - 198, 或 500 - 123 - 77)
    3. 乘法结合律 (找朋友，如 25 x 13 x 4, 125 x 7 x 8)
    4. 乘法分配律及其逆运算 (如 24 x 101, 37 x 99 + 37, 68 x 101 - 68)
    5. 除法的性质 (如 3600 ÷ 25 ÷ 4)

    难度要求：
    - 数字不要太大，重点在于考察能否看出简便方法。
    - 确保答案是整数。
    
    请严格按照JSON格式返回，包含10个对象。
  `;

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        question: { type: Type.STRING, description: "数学题目表达式，例如 '25 x 44'" },
        answer: { type: Type.NUMBER, description: "题目的正确数字答案" },
        explanation: { type: Type.STRING, description: "详细的巧算思路讲解，分步骤说明如何简便计算" },
        type: { type: Type.STRING, description: "考察的知识点，例如'乘法分配律'" }
      },
      required: ["question", "answer", "explanation", "type"]
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        systemInstruction: "你是一位亲切、鼓励型的小学数学老师。所有的讲解都要通俗易懂。"
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text) as MathProblem[];
  } catch (error) {
    console.error("Error generating problems:", error);
    // Fallback problems in case of API failure or quota issues
    return [
      { question: "25 × 44", answer: 1100, explanation: "把44拆分成4×11，然后25×4=100，100×11=1100", type: "乘法结合律" },
      { question: "135 + 289 + 65", answer: 489, explanation: "利用加法交换律，先算135+65=200，再加289等于489", type: "加法凑整" },
      { question: "47 × 99 + 47", answer: 4700, explanation: "提取公因数47，变成 47 × (99 + 1) = 47 × 100", type: "乘法分配律" }
    ];
  }
};

// --- Components ---

const App = () => {
  const [gameState, setGameState] = useState<'intro' | 'loading' | 'playing' | 'summary'>('intro');
  const [problems, setProblems] = useState<MathProblem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [score, setScore] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  const startTraining = async () => {
    setGameState('loading');
    const newProblems = await generateDailyProblems();
    setProblems(newProblems);
    setCurrentIndex(0);
    setScore(0);
    setHistory([]);
    setUserAnswer('');
    setShowExplanation(false);
    setGameState('playing');
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userAnswer) return;

    const numAnswer = parseFloat(userAnswer);
    const currentProblem = problems[currentIndex];
    const isCorrect = Math.abs(numAnswer - currentProblem.answer) < 0.01;

    if (isCorrect) setScore(s => s + 1);

    const newItem: HistoryItem = {
      problem: currentProblem,
      userAnswer: userAnswer,
      isCorrect
    };

    setHistory([...history, newItem]);
    setShowExplanation(true);
  };

  const handleNext = () => {
    if (currentIndex < problems.length - 1) {
      setCurrentIndex(c => c + 1);
      setUserAnswer('');
      setShowExplanation(false);
      // Auto focus next input
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setGameState('summary');
    }
  };

  // Intro Screen
  if (gameState === 'intro') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-blue-100 to-purple-100">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border-b-8 border-blue-400">
          <div className="text-6xl mb-6 text-blue-500">
            <i className="fa-solid fa-calculator"></i>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">巧算训练营</h1>
          <p className="text-gray-600 mb-8">每天10道题，让计算变得更聪明！<br/>适合小学四年级</p>
          
          <button 
            onClick={startTraining}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white text-xl font-bold py-4 px-8 rounded-2xl transition-all transform hover:scale-105 shadow-lg active:scale-95"
          >
            开始今天的挑战! 🚀
          </button>
        </div>
      </div>
    );
  }

  // Loading Screen
  if (gameState === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-blue-50">
        <div className="text-blue-500 text-5xl mb-4 animate-bounce">
          <i className="fa-solid fa-brain"></i>
        </div>
        <h2 className="text-2xl font-bold text-gray-700">老师正在出题中...</h2>
        <p className="text-gray-500 mt-2">准备好你的巧算技巧了吗？</p>
      </div>
    );
  }

  // Summary Screen
  if (gameState === 'summary') {
    return (
      <div className="min-h-screen py-8 px-4 bg-gradient-to-b from-green-50 to-blue-50">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border-b-8 border-green-400 mb-6">
            <div className="p-8 text-center bg-green-400 text-white">
              <h2 className="text-3xl font-bold mb-2">挑战完成! 🎉</h2>
              <div className="text-6xl font-black my-4">{score} / {problems.length}</div>
              <p className="text-xl opacity-90">
                {score === 10 ? "太棒了！你是巧算大师！🏆" : 
                 score >= 8 ? "非常优秀！继续保持！🌟" : 
                 "干得不错！继续加油哦！💪"}
              </p>
            </div>
            
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-700 mb-4">错题回顾与解析</h3>
              <div className="space-y-4">
                {history.map((item, idx) => (
                  <div key={idx} className={`p-4 rounded-xl border-l-4 ${item.isCorrect ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-lg text-gray-800 math-font">
                        {idx + 1}. {item.problem.question}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${item.isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                        {item.isCorrect ? '正确' : '错误'}
                      </span>
                    </div>
                    {!item.isCorrect && (
                       <div className="text-sm text-red-600 mb-2">
                         你的答案: {item.userAnswer} | 正确答案: {item.problem.answer}
                       </div>
                    )}
                    <div className="text-sm text-gray-600 bg-white/50 p-2 rounded">
                      <span className="font-bold text-blue-600">巧算思路:</span> {item.problem.explanation}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 bg-gray-50 text-center">
              <button 
                onClick={startTraining}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-xl shadow-md transition-colors"
              >
                再做一组练习 🔄
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Playing Screen
  const currentProblem = problems[currentIndex];
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm p-4 flex justify-between items-center">
        <div className="font-bold text-gray-600">
          题目 {currentIndex + 1} / {problems.length}
        </div>
        <div className="font-bold text-blue-600">
          得分: {score}
        </div>
      </div>

      <div className="flex-1 p-4 flex items-center justify-center">
        <div className="max-w-2xl w-full">
          
          {/* Question Card */}
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-6 transition-all">
            <div className="bg-blue-400 h-4 w-full"></div>
            <div className="p-8 text-center">
              <div className="inline-block px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-sm font-bold mb-4">
                {currentProblem.type}
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-800 math-font mb-8 tracking-wide">
                {currentProblem.question} = ?
              </h2>

              {!showExplanation ? (
                <form onSubmit={handleSubmit} className="w-full max-w-xs mx-auto">
                  <input
                    ref={inputRef}
                    type="number"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="输入答案"
                    className="w-full text-center text-3xl p-4 border-2 border-gray-300 rounded-2xl focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all mb-6 math-font"
                    autoFocus
                  />
                  <button 
                    type="submit"
                    disabled={!userAnswer}
                    className="w-full bg-blue-500 disabled:bg-gray-300 hover:bg-blue-600 text-white text-xl font-bold py-4 rounded-2xl shadow-lg transform transition-all active:scale-95"
                  >
                    提交答案
                  </button>
                </form>
              ) : (
                <div className="animate-fade-in">
                  <div className={`text-2xl font-bold mb-4 ${Math.abs(parseFloat(userAnswer) - currentProblem.answer) < 0.01 ? 'text-green-500' : 'text-red-500'}`}>
                    {Math.abs(parseFloat(userAnswer) - currentProblem.answer) < 0.01 ? (
                      <span><i className="fa-solid fa-check-circle mr-2"></i>回答正确!</span>
                    ) : (
                      <span><i className="fa-solid fa-times-circle mr-2"></i>正确答案是: {currentProblem.answer}</span>
                    )}
                  </div>
                  
                  <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 text-left mb-6">
                    <h3 className="font-bold text-yellow-800 mb-2 flex items-center">
                      <i className="fa-regular fa-lightbulb mr-2"></i> 巧算小贴士:
                    </h3>
                    <p className="text-gray-800 text-lg leading-relaxed">
                      {currentProblem.explanation}
                    </p>
                  </div>

                  <button 
                    onClick={handleNext}
                    className="bg-green-500 hover:bg-green-600 text-white text-xl font-bold py-3 px-12 rounded-2xl shadow-lg transition-all transform hover:-translate-y-1"
                  >
                    {currentIndex === problems.length - 1 ? '查看成绩 🏁' : '下一道题 ➡️'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-gray-200 rounded-full h-2.5 w-full">
            <div 
              className="bg-blue-500 h-2.5 rounded-full transition-all duration-500" 
              style={{ width: `${((currentIndex + (showExplanation ? 1 : 0)) / problems.length) * 100}%` }}
            ></div>
          </div>

        </div>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
