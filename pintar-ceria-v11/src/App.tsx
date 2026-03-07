import React, { useState, useEffect, useRef } from 'react';
import { 
  Calculator, 
  BookOpenText, 
  Leaf, 
  Languages, 
  Flag, 
  Palette, 
  Dumbbell, 
  Star, 
  Settings, 
  Gamepad2, 
  GraduationCap, 
  Rocket, 
  X, 
  CheckCircle2, 
  Play, 
  Wand2, 
  Book, 
  ListOrdered, 
  Loader2, 
  ChevronRight, 
  Home, 
  Trophy, 
  AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import localforage from 'localforage';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { GoogleGenAI } from "@google/genai";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { jsPDF } from 'jspdf';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// PDF.js Worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// Types
interface Question {
  materi: string;
  type: 'pg' | 'isian';
  format: 'text' | 'comic' | 'conversation';
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
  conversation?: { speaker: string; text: string }[];
  illustration?: string;
}

interface MapelData {
  materiText: string;
  kisiText: string;
  images: { mimeType: string; data: string }[];
  questions: Question[];
}

interface Mapel {
  id: string;
  name: string;
  icon: React.ElementType;
  gradient: string;
  emoji: string;
  border: string;
  shadow: string;
}

const MAPEL_LIST: Mapel[] = [
  { id: "indo", name: "Bahasa Indonesia", icon: BookOpenText, gradient: "from-blue-400 to-cyan-500", emoji: "📖", border: "border-blue-200", shadow: "shadow-blue-200" },
  { id: "inggris", name: "Bahasa Inggris", icon: Languages, gradient: "from-purple-400 to-violet-500", emoji: "🔤", border: "border-purple-200", shadow: "shadow-purple-200" },
  { id: "lampung", name: "Bahasa Lampung", icon: Languages, gradient: "from-yellow-400 to-orange-500", emoji: "🌋", border: "border-yellow-200", shadow: "shadow-yellow-200" },
  { id: "ipas", name: "Ilmu Pengetahuan Alam dan Sosial (IPAS)", icon: Leaf, gradient: "from-green-400 to-emerald-500", emoji: "🌿", border: "border-green-200", shadow: "shadow-green-200" },
  { id: "agama", name: "Pendidikan Agama Islam dan Budi Pekerti (PAIBP)", icon: Star, gradient: "from-indigo-400 to-blue-500", emoji: "⭐", border: "border-indigo-200", shadow: "shadow-indigo-200" },
  { id: "mtk", name: "Matematika", icon: Calculator, gradient: "from-pink-400 to-rose-500", emoji: "🧮", border: "border-pink-200", shadow: "shadow-pink-200" },
  { id: "ppkn", name: "Pendidikan Pancasila", icon: Flag, gradient: "from-orange-400 to-amber-500", emoji: "🤝", border: "border-orange-200", shadow: "shadow-orange-200" },
  { id: "pjok", name: "Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)", icon: Dumbbell, gradient: "from-red-400 to-orange-500", emoji: "⚽", border: "border-red-200", shadow: "shadow-red-200" },
  { id: "sbdp", name: "Seni Budaya (SBDP)", icon: Palette, gradient: "from-teal-400 to-cyan-500", emoji: "🎨", border: "border-teal-200", shadow: "shadow-teal-200" }
];

export default function App() {
  const [mode, setMode] = useState<'student' | 'admin' | 'quiz' | 'result'>('student');
  const [studentName, setStudentName] = useState<string>('');
  const [quizQuestionCount, setQuizQuestionCount] = useState<number>(5);
  const [isStudentLoggedIn, setIsStudentLoggedIn] = useState<boolean>(false);
  const [mapelQuestionsCount, setMapelQuestionsCount] = useState<Record<string, number>>({});
  const [activeQuiz, setActiveQuiz] = useState<{
    mapel: Mapel;
    questions: Question[];
    currentIndex: number;
    score: number;
    userAnswer: string;
    isAnswered: boolean;
    isCorrect: boolean;
    attempts: number;
  } | null>(null);

  // Admin State
  const [adminMapelId, setAdminMapelId] = useState<string>('');
  const [adminMateriFiles, setAdminMateriFiles] = useState<FileList | null>(null);
  const [adminSasFiles, setAdminSasFiles] = useState<FileList | null>(null);
  const [adminKisiFile, setAdminKisiFile] = useState<File | null>(null);
  const [adminJumlahSoal, setAdminJumlahSoal] = useState(10);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSuccess, setAdminSuccess] = useState(false);
  const [adminStatus, setAdminStatus] = useState<string>('');
  const [adminFiles, setAdminFiles] = useState<Record<string, { materi: string[], sas: string[], kisi: string | null }>>({});

  // Modal State
  const [modal, setModal] = useState<{ title: string; message: string; icon: string } | null>(null);
  const [showSurvey, setShowSurvey] = useState(false);
  const [hasSubmittedSurvey, setHasSubmittedSurvey] = useState(false);
  const [rankings, setRankings] = useState<Record<string, { name: string; score: number }[]>>({});

  useEffect(() => {
    loadMapelCounts();
    loadRankings();
    loadAdminFiles();
  }, []);

  const loadAdminFiles = async () => {
    const files = await localforage.getItem<Record<string, { materi: string[], sas: string[], kisi: string | null }>>('adminFiles') || {};
    setAdminFiles(files);
  };

  const loadRankings = async () => {
    const r = await localforage.getItem<Record<string, { name: string; score: number }[]>>('rankings') || {};
    setRankings(r);
  };

  const updateRanking = async (mapelId: string, name: string, score: number) => {
    const currentRankings = { ...rankings };
    const mapelRankings = currentRankings[mapelId] || [];
    
    const existingIdx = mapelRankings.findIndex(r => r.name === name);
    if (existingIdx !== -1) {
      if (score > mapelRankings[existingIdx].score) {
        mapelRankings[existingIdx].score = score;
      }
    } else {
      mapelRankings.push({ name, score });
    }
    
    mapelRankings.sort((a, b) => b.score - a.score);
    currentRankings[mapelId] = mapelRankings.slice(0, 5); // Top 5
    
    setRankings(currentRankings);
    await localforage.setItem('rankings', currentRankings);
  };

  const loadMapelCounts = async () => {
    const counts: Record<string, number> = {};
    for (const m of MAPEL_LIST) {
      const data = await localforage.getItem<MapelData>(m.id);
      counts[m.id] = data?.questions?.length || 0;
    }
    setMapelQuestionsCount(counts);
  };

  const showModal = (title: string, message: string, icon: string = "ℹ️") => {
    setModal({ title, message, icon });
  };

  const startQuiz = async (mapelId: string) => {
    const data = await localforage.getItem<MapelData>(mapelId);
    if (!data || !data.questions || data.questions.length === 0) {
      showModal('Level Terkunci!', `Bu Guru belum menyiapkan misi untuk pelajaran ini. Minta Bu Guru isi di panel ya!`, '🔒');
      return;
    }

    const mapel = MAPEL_LIST.find(m => m.id === mapelId)!;
    const shuffledQuestions = [...data.questions].sort(() => Math.random() - 0.5);
    setActiveQuiz({
      mapel,
      questions: shuffledQuestions.slice(0, quizQuestionCount),
      currentIndex: 0,
      score: 0,
      userAnswer: '',
      isAnswered: false,
      isCorrect: false,
      attempts: 0,
    });
    setMode('quiz');
  };

  const handleCheckAnswer = () => {
    if (!activeQuiz) return;
    const q = activeQuiz.questions[activeQuiz.currentIndex];
    
    if (!activeQuiz.userAnswer) {
      showModal('Pilih Jawaban!', 'Ayo pilih atau ketik jawabanmu dulu ya! 👆', '🤔');
      return;
    }

    const isCorrect = activeQuiz.userAnswer.toLowerCase().trim() === q.answer.toLowerCase().trim();
    const newAttempts = activeQuiz.attempts + 1;

    if (isCorrect || newAttempts >= 3) {
      setActiveQuiz({
        ...activeQuiz,
        isAnswered: true,
        isCorrect,
        attempts: newAttempts,
        score: isCorrect ? activeQuiz.score + 1 : activeQuiz.score,
      });
    } else {
      setActiveQuiz({
        ...activeQuiz,
        attempts: newAttempts,
        userAnswer: '',
      });
      showModal('Coba Lagi!', `Jawabanmu belum tepat. Kamu masih punya ${3 - newAttempts} kesempatan lagi!`, '🔄');
    }
  };

  const handleNextQuestion = () => {
    if (!activeQuiz) return;
    if (activeQuiz.currentIndex + 1 < activeQuiz.questions.length) {
      setActiveQuiz({
        ...activeQuiz,
        currentIndex: activeQuiz.currentIndex + 1,
        userAnswer: '',
        isAnswered: false,
        isCorrect: false,
        attempts: 0,
      });
    } else {
      const finalScore = Math.round((activeQuiz.score / activeQuiz.questions.length) * 100);
      updateRanking(activeQuiz.mapel.id, studentName, finalScore);
      setMode('result');
    }
  };

  useEffect(() => {
    setAdminMateriFiles(null);
    setAdminSasFiles(null);
    setAdminKisiFile(null);
  }, [adminMapelId]);

  const generatePDF = () => {
    if (!activeQuiz) return;
    const doc = new jsPDF();
    const finalScore = Math.round((activeQuiz.score / activeQuiz.questions.length) * 100);
    
    // Header
    doc.setFillColor(240, 240, 240);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setFontSize(22);
    doc.setTextColor(50, 50, 50);
    doc.text(`Hasil Kuis: ${activeQuiz.mapel.name}`, 10, 20);
    doc.setFontSize(14);
    doc.text(`Nama: ${studentName}`, 10, 30);
    doc.text(`Tanggal: ${new Date().toLocaleString()}`, 10, 37);
    
    // Score
    doc.setFontSize(30);
    doc.setTextColor(200, 50, 50);
    doc.text(`Skor: ${finalScore}`, 150, 25);
    
    // Questions
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text(`Daftar Soal & Jawaban:`, 10, 50);
    
    let y = 60;
    activeQuiz.questions.forEach((q, i) => {
      // Split text into lines to avoid overflow
      const questionLines = doc.splitTextToSize(`${i + 1}. ${q.question}`, 170);
      const explanationLines = doc.splitTextToSize(`Penjelasan: ${q.explanation}`, 170);
      
      const neededHeight = (questionLines.length * 7) + 14 + (explanationLines.length * 7);
      if (y + neededHeight > 270) { doc.addPage(); y = 20; }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(questionLines, 10, y);
      y += (questionLines.length * 7);
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Jawabanmu: ${activeQuiz.userAnswer || '-'} | Kunci: ${q.answer}`, 10, y);
      y += 7;
      
      doc.text(explanationLines, 10, y);
      y += (explanationLines.length * 7) + 8;
    });
    
    doc.save(`hasil_kuis_${activeQuiz.mapel.id}_${studentName}.pdf`);
  };

  const Chatbot = () => {
    const [messages, setMessages] = useState<{ sender: 'user' | 'bot'; text: string }[]>([{ sender: 'bot', text: 'Halo! Ada yang ingin ditanyakan tentang hasil kuis atau materi? 😊' }]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    const sendMessage = async () => {
      if (!input.trim()) return;
      const userMsg = input;
      setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
      setInput('');
      setIsTyping(true);

      try {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
          setMessages(prev => [...prev, { sender: 'bot', text: 'Maaf, API Key belum dikonfigurasi. Mohon hubungi administrator.' }]);
          setIsTyping(false);
          return;
        }
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: userMsg,
          config: { systemInstruction: "Kamu adalah asisten pengajar yang membantu siswa memahami materi pelajaran SD kelas 5. Gunakan bahasa yang menyenangkan, mudah dipahami, sertakan emoji, dan format jawaban dengan Markdown sederhana (bold, list, italic). Hindari penggunaan LaTeX atau simbol matematika yang rumit (gunakan teks biasa seperti 'x pangkat 2' atau '3 kali 4')." }
        });
        setMessages(prev => [...prev, { sender: 'bot', text: response.text || 'Maaf, saya tidak bisa menjawab itu.' }]);
      } catch (e: any) {
        let msg = 'Terjadi kesalahan saat menghubungi AI. 🤖';
        if (e.message?.includes("429") || e.message?.includes("quota")) {
          msg = 'Kuota API habis. Tunggu sebentar ya! ⏳';
        }
        setMessages(prev => [...prev, { sender: 'bot', text: msg }]);
      } finally {
        setIsTyping(false);
      }
    };

    return (
      <div className="bg-white p-6 rounded-3xl shadow-lg border-2 border-gray-100 mt-8">
        <h3 className="font-bold text-xl mb-4">💬 Tanya Bu Guru AI</h3>
        <div className="h-80 overflow-y-auto mb-4 space-y-3 pr-2">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex flex-col gap-1 w-full", m.sender === 'user' ? "items-end" : "items-start")}>
              {m.sender === 'user' ? (
                <div className="bg-blue-100 p-3 rounded-2xl text-sm max-w-[85%] text-left">
                  {m.text}
                </div>
              ) : (
                <div className="bg-gray-100 p-3 rounded-2xl text-sm max-w-[85%] text-left prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.text}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          ))}
          {isTyping && <div className="p-3 rounded-2xl text-sm bg-gray-100 mr-auto max-w-[85%] animate-pulse">Sedang mengetik... ✍️</div>}
        </div>
        <div className="flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} className="flex-grow border-2 rounded-xl p-3" placeholder="Tanya sesuatu..." />
          <button onClick={sendMessage} className="bg-blue-500 text-white px-6 rounded-xl font-bold">Kirim</button>
        </div>
      </div>
    );
  };

  const Survey = ({ onClose }: { onClose: () => void }) => {
    const [survey, setSurvey] = useState({ ease: 0, relevance: 0, usefulness: 0, comment: '' });
    const submitSurvey = () => {
      if (survey.ease === 0 || survey.relevance === 0 || survey.usefulness === 0) {
        alert('Mohon isi semua bintang!');
        return;
      }
      console.log('Survey Data:', survey);
      setHasSubmittedSurvey(true);
      onClose();
    };
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[200]">
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full">
          <h3 className="font-bold text-2xl mb-6">📝 Evaluasi Aplikasi</h3>
          {(['ease', 'relevance', 'usefulness'] as const).map(key => (
            <div key={key} className="mb-4">
              <label className="block text-sm font-bold mb-1">{key === 'ease' ? 'Kemudahan Penggunaan' : key === 'relevance' ? 'Kesesuaian Soal' : 'Kebermanfaatan'}</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(r => (
                  <button key={r} onClick={() => setSurvey({...survey, [key]: r})} className={cn("text-3xl", survey[key] >= r ? "text-yellow-400" : "text-gray-300")}>★</button>
                ))}
              </div>
            </div>
          ))}
          <textarea value={survey.comment} onChange={(e) => setSurvey({...survey, comment: e.target.value})} className="w-full border-2 rounded-xl p-2 mb-4" placeholder="Saran/Masukan..." />
          <button onClick={submitSurvey} className="w-full bg-purple-500 text-white p-4 rounded-2xl font-bold">Kirim & Selesai</button>
        </div>
      </div>
    );
  };
  // AI Logic
  const generateQuestions = async () => {
    if (!adminMapelId) {
      showModal('Perhatian', 'Pilih Mata Pelajaran terlebih dahulu. 👆', '⚠️');
      return;
    }

    setAdminLoading(true);
    setAdminStatus('🤖 AI sedang membaca materi dan meracik soal-soal seru...');
    setAdminSuccess(false);

    try {
      const selectedMapel = MAPEL_LIST.find(m => m.id === adminMapelId)!;
      let materiText = '';
      let sasText = '';
      let kisiText = '';
      let materiNames: string[] = [];
      let sasNames: string[] = [];

      const readFile = async (f: File) => {
        if (f.name.endsWith('.pdf')) {
          const arrayBuffer = await f.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let text = '';
          for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            text += content.items.map((item: any) => item.str).join(' ') + '\n';
          }
          return text;
        } else if (f.name.endsWith('.docx')) {
          const result = await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() });
          return result.value;
        } else {
          return await f.text();
        }
      };

      if (adminMateriFiles) {
        for (let i = 0; i < adminMateriFiles.length; i++) {
          materiText += await readFile(adminMateriFiles[i]) + '\n';
          materiNames.push(adminMateriFiles[i].name);
        }
      }
      if (adminSasFiles) {
        for (let i = 0; i < adminSasFiles.length; i++) {
          sasText += await readFile(adminSasFiles[i]) + '\n';
          sasNames.push(adminSasFiles[i].name);
        }
      }
      if (adminKisiFile) {
        kisiText = await readFile(adminKisiFile);
      }

      const newAdminFiles = { ...adminFiles, [adminMapelId]: { materi: materiNames, sas: sasNames, kisi: adminKisiFile?.name || null } };
      setAdminFiles(newAdminFiles);
      await localforage.setItem('adminFiles', newAdminFiles);

      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        alert("API Key belum dikonfigurasi!");
        setAdminLoading(false);
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      const model = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        config: {
          responseMimeType: "application/json",
          systemInstruction: `Kamu adalah 'Bu Guru Ceria', pembuat soal ahli untuk SD kelas 5 Kurikulum Merdeka.
          Buatkan soal ujian mapel ${selectedMapel.name}. Jumlah: ${adminJumlahSoal} SOAL.
          Gunakan 'Contoh Soal (SAS)' sebagai referensi utama format dan tingkat kesulitan.
          Validasi soal agar sesuai dengan 'Kisi-kisi' yang diberikan.
          Variasi Tipe harus campuran: "pg" (Pilihan Ganda 4 opsi acak dalam array "options") dan "isian" (Isian singkat).
          Variasi Format harus campuran: "text", "comic" (deskripsikan adegan komik), "conversation" (array field "conversation" berisi {speaker, text}).
          Khusus untuk soal Matematika, WAJIB sertakan field "illustration" yang berisi deskripsi visual singkat (contoh: "Segitiga siku-siku alas 3cm tinggi 4cm") untuk membantu siswa.
          Setiap soal butuh field: "materi", "type", "format", "question", "options", "answer", "explanation", "conversation", "illustration".
          Keluarkan HANYA JSON VALID format array.`
        },
        contents: [
          {
            role: 'user',
            parts: [
              { text: `Buatkan ${adminJumlahSoal} soal mapel ${selectedMapel.name} Kelas 5 SD.
              ${kisiText ? `\n\n[KISI-KISI]:\n${kisiText.substring(0, 3000)}` : ''}
              ${sasText ? `\n\n[CONTOH SOAL (SAS)]:\n${sasText.substring(0, 5000)}` : ''}
              ${materiText ? `\n\n[MATERI]:\n${materiText.substring(0, 8000)}` : 'Buat soal berdasarkan pengetahuan umum tingkat kelas 5 SD.'}` }
            ]
          }
        ]
      });

      const response = await model;
      const questions = JSON.parse(response.text || '[]');

      await localforage.setItem(adminMapelId, {
        questions: Array.isArray(questions) ? questions : (questions.questions || [])
      });

      setAdminSuccess(true);
      loadMapelCounts();
    } catch (err: any) {
      console.error(err);
      let msg = err.message || "Terjadi kesalahan saat menghubungi AI.";
      if (msg.includes("429") || msg.includes("quota")) {
        msg = "Kuota API Google habis (Error 429). Mohon tunggu 1-2 menit atau gunakan API Key baru di pengaturan Vercel.";
      }
      showModal("Gagal Menyiapkan Soal ❌", msg, "🤖");
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-blue-50 text-slate-800 font-sans selection:bg-pink-300 selection:text-white pb-10">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md shadow-sm p-3 sticky top-0 z-50 border-b border-blue-100">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-pink-400 to-orange-400 p-2 rounded-xl shadow-md transform -rotate-6">
              <GraduationCap className="text-white w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 tracking-wide">
              Pintar Ceria
            </h1>
          </div>
          <div className="flex bg-gray-100 rounded-full p-1 border-2 border-gray-200">
            <button 
              onClick={() => { setMode('student'); setActiveQuiz(null); }}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-bold transition-all",
                mode === 'student' || mode === 'quiz' || mode === 'result' ? "bg-white shadow-md text-blue-600" : "text-gray-500 hover:text-gray-700"
              )}
            >
              🎮 Main
            </button>
            <button 
              onClick={() => { setMode('admin'); setActiveQuiz(null); }}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-bold transition-all",
                mode === 'admin' ? "bg-white shadow-md text-purple-600" : "text-gray-500 hover:text-gray-700"
              )}
            >
              ⚙️ Guru
            </button>
          </div>
        </div>
      </nav>

      <main className="p-4 md:p-6 w-full max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          {/* Dashboard Siswa */}
          {mode === 'student' && (
            <motion.div 
              key="student"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {!isStudentLoggedIn ? (
                <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-xl border-4 border-blue-100 max-w-lg mx-auto">
                  <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Halo! Siapa namamu? 👋</h2>
                  <input 
                    type="text" 
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Masukkan namamu..."
                    className="w-full border-4 border-gray-200 rounded-3xl p-4 text-xl font-semibold text-center focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all outline-none shadow-inner bg-gray-50 mb-6"
                  />
                  <button 
                    onClick={() => studentName && setIsStudentLoggedIn(true)}
                    disabled={!studentName}
                    className="w-full bg-gradient-to-b from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-bold text-xl py-4 rounded-3xl shadow-[0_6px_0_rgb(29,78,216)] transition-all disabled:opacity-50"
                  >
                    Mulai Petualangan! 🚀
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-gradient-to-br from-blue-400 via-indigo-400 to-purple-500 rounded-[2.5rem] p-8 md:p-12 text-white shadow-xl relative overflow-hidden border-4 border-white/50 mb-8">
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 justify-between">
                      <div className="text-center md:text-left">
                        <h2 className="text-4xl md:text-5xl font-bold mb-3 drop-shadow-md">Halo, {studentName}! 🌟</h2>
                        <p className="text-blue-50 text-xl font-medium opacity-95">Ayo pilih petualangan belajarmu hari ini!</p>
                      </div>
                      <motion.div 
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        className="text-7xl md:text-9xl drop-shadow-2xl"
                      >
                        🚀
                      </motion.div>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-6 shadow-md border-2 border-gray-100 mb-8">
                    <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Jumlah Soal</label>
                    <input 
                      type="number" 
                      value={quizQuestionCount}
                      onChange={(e) => setQuizQuestionCount(Math.max(1, parseInt(e.target.value) || 1))}
                      min="1" max="20"
                      className="w-full border-4 border-gray-200 rounded-3xl p-4 text-xl font-bold text-center focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all outline-none shadow-inner bg-gray-50"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {MAPEL_LIST.map((m) => {
                      const count = mapelQuestionsCount[m.id] || 0;
                      const isLocked = count === 0;
                      return (
                        <motion.div
                          key={m.id}
                          whileHover={!isLocked ? { y: -8 } : {}}
                          onClick={() => startQuiz(m.id)}
                          className={cn(
                            "rounded-[2rem] p-6 border-4 shadow-lg transition-all cursor-pointer relative overflow-hidden group",
                            isLocked ? "bg-gray-50 border-gray-200 border-dashed opacity-80 grayscale" : `bg-white ${m.border} ${m.shadow}`
                          )}
                        >
                          <div className="absolute -right-4 -bottom-4 text-8xl opacity-10 group-hover:scale-110 transition-transform">{m.emoji}</div>
                          <div className="relative z-10 flex flex-col h-full">
                            <div className={cn(
                              "w-16 h-16 rounded-2xl flex items-center justify-center text-white text-3xl mb-4 shadow-md transform -rotate-6 group-hover:rotate-0 transition-transform",
                              isLocked ? "bg-gray-300" : `bg-gradient-to-br ${m.gradient}`
                            )}>
                              <m.icon className="w-8 h-8" />
                            </div>
                            <h3 className="font-bold text-2xl text-gray-800 mb-2 leading-tight">{m.name}</h3>
                            <div className="mt-auto pt-4 flex items-center justify-between">
                              <span className={cn(
                                "text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider",
                                isLocked ? "bg-gray-200 text-gray-500" : "bg-green-100 text-green-700"
                              )}>
                                {isLocked ? "🔒 Belum Siap" : `🌟 ${count} Misi`}
                              </span>
                              {!isLocked && (
                                <div className="bg-gray-100 p-2 rounded-full group-hover:bg-blue-500 group-hover:text-white text-gray-400 transition-colors">
                                  <Play className="w-5 h-5 fill-current" />
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Quiz View */}
          {mode === 'quiz' && activeQuiz && (
            <motion.div 
              key="quiz"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between bg-white p-4 rounded-3xl shadow-sm border-2 border-gray-100">
                <button 
                  onClick={() => setMode('student')}
                  className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-2xl font-bold transition-all"
                >
                  <X className="w-5 h-5" /> Keluar
                </button>
                <div className="flex-grow mx-4">
                  <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden border-2 border-gray-200">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-green-400 to-blue-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${(activeQuiz.currentIndex / activeQuiz.questions.length) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="bg-blue-100 px-5 py-2 rounded-2xl font-bold text-blue-700 border-2 border-blue-200">
                  Soal <span className="text-lg">{activeQuiz.currentIndex + 1}</span> / {activeQuiz.questions.length}
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] p-6 md:p-10 shadow-xl border-4 border-gray-100 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 text-9xl opacity-5">❓</div>
                <div className="flex flex-wrap gap-2 items-center mb-6 relative z-10">
                  <span className="bg-purple-100 text-purple-700 text-sm font-bold px-4 py-1.5 rounded-2xl">
                    {activeQuiz.mapel.emoji} {activeQuiz.mapel.name}
                  </span>
                  <span className="bg-blue-100 text-blue-700 text-sm font-bold px-4 py-1.5 rounded-2xl">
                    Materi: {activeQuiz.questions[activeQuiz.currentIndex].materi}
                  </span>
                  <span className="bg-pink-100 text-pink-700 text-sm font-bold px-4 py-1.5 rounded-2xl">
                    {activeQuiz.questions[activeQuiz.currentIndex].type === 'pg' ? 'Pilihan Ganda' : 'Isian Singkat'}
                  </span>
                  <span className="bg-yellow-100 text-yellow-700 text-sm font-bold px-4 py-1.5 rounded-2xl">
                    Format: {activeQuiz.questions[activeQuiz.currentIndex].format}
                  </span>
                </div>
                
                {activeQuiz.questions[activeQuiz.currentIndex].illustration && (
                  <div className="mb-8 bg-gray-50 p-6 rounded-3xl border-2 border-gray-100 flex flex-col items-center relative z-10">
                    <div className="w-full max-w-lg h-64 bg-white rounded-2xl flex items-center justify-center mb-4 overflow-hidden relative shadow-sm border border-gray-200">
                       <img 
                         src={`https://placehold.co/800x400/f1f5f9/475569?text=Ilustrasi+Soal&font=montserrat`} 
                         alt="Ilustrasi Soal" 
                         className="w-full h-full object-cover opacity-90 hover:scale-105 transition-transform duration-500"
                       />
                       <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                         <span className="text-6xl opacity-20">🖼️</span>
                       </div>
                    </div>
                    <div className="bg-white px-6 py-3 rounded-2xl border border-gray-200 shadow-sm max-w-2xl">
                      <p className="text-base text-gray-600 italic text-center font-medium">
                        <span className="not-italic mr-2">💡</span>
                        "{activeQuiz.questions[activeQuiz.currentIndex].illustration}"
                      </p>
                    </div>
                  </div>
                )}

                <h3 className="text-2xl md:text-4xl font-semibold text-gray-800 leading-snug mb-8 relative z-10">
                  {activeQuiz.questions[activeQuiz.currentIndex].question}
                </h3>

                {activeQuiz.questions[activeQuiz.currentIndex].format === 'conversation' && (
                  <div className="space-y-4 mb-8 bg-gray-100 p-6 rounded-3xl">
                    {activeQuiz.questions[activeQuiz.currentIndex].conversation?.map((c, i) => (
                      <div key={i} className="flex flex-col items-start">
                        <span className="text-xs font-bold text-gray-500 mb-1">{c.speaker}</span>
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                          {c.text}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeQuiz.questions[activeQuiz.currentIndex].type === 'pg' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                    {activeQuiz.questions[activeQuiz.currentIndex].options?.map((opt, idx) => {
                      const colors = ["bg-red-500", "bg-blue-500", "bg-yellow-400", "bg-green-500"];
                      const isSelected = activeQuiz.userAnswer === opt;
                      return (
                        <button
                          key={idx}
                          disabled={activeQuiz.isAnswered}
                          onClick={() => setActiveQuiz({ ...activeQuiz, userAnswer: opt })}
                          className={cn(
                            "relative flex items-center justify-center p-6 rounded-3xl transition-all text-white font-bold text-xl md:text-2xl",
                            colors[idx % 4],
                            isSelected && "ring-4 ring-white ring-offset-4 scale-[1.02]",
                            activeQuiz.isAnswered && opt !== activeQuiz.questions[activeQuiz.currentIndex].answer && !isSelected && "opacity-50 grayscale-[50%]",
                            activeQuiz.isAnswered && opt === activeQuiz.questions[activeQuiz.currentIndex].answer && "ring-4 ring-green-400 ring-offset-4"
                          )}
                        >
                          {isSelected && <div className="absolute top-3 right-3 bg-white text-gray-900 rounded-full w-8 h-8 flex items-center justify-center font-bold">✓</div>}
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="relative z-10">
                    <input 
                      type="text" 
                      disabled={activeQuiz.isAnswered}
                      value={activeQuiz.userAnswer}
                      onChange={(e) => setActiveQuiz({ ...activeQuiz, userAnswer: e.target.value })}
                      placeholder="Ketik jawabanmu di sini ya..." 
                      className="w-full border-4 border-gray-200 rounded-3xl p-6 text-2xl font-semibold text-center focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all outline-none shadow-inner bg-gray-50"
                    />
                  </div>
                )}

                {activeQuiz.isAnswered && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "mt-8 p-8 rounded-[2rem] text-white shadow-lg relative overflow-hidden",
                      activeQuiz.isCorrect ? "bg-gradient-to-br from-green-400 to-green-500" : "bg-gradient-to-br from-red-400 to-red-500"
                    )}
                  >
                    <h4 className="font-bold text-2xl md:text-3xl mb-2 flex items-center gap-3">
                      {activeQuiz.isCorrect ? "🎉 Horeee! Jawabanmu Benar!" : "😅 Ups, Hampir Benar!"}
                    </h4>
                    {!activeQuiz.isCorrect && (
                      <div className="bg-black/20 p-4 rounded-2xl mt-3 mb-3 border border-white/20">
                        <span className="block text-sm uppercase tracking-wider opacity-80 mb-1">Jawaban yang benar:</span>
                        <b className="text-2xl">{activeQuiz.questions[activeQuiz.currentIndex].answer}</b>
                      </div>
                    )}
                    <p className="text-lg opacity-95">{activeQuiz.questions[activeQuiz.currentIndex].explanation}</p>
                  </motion.div>
                )}
              </div>

              <div className="flex justify-center mt-6">
                {!activeQuiz.isAnswered ? (
                  <button 
                    onClick={handleCheckAnswer}
                    className="bg-gradient-to-b from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white font-bold text-2xl px-12 py-4 rounded-[2rem] shadow-[0_8px_0_rgb(21,128,61)] transition-all flex items-center gap-3 hover:-translate-y-1 border-2 border-green-300"
                  >
                    Kunci Jawaban! 🔒
                  </button>
                ) : (
                  <button 
                    onClick={handleNextQuestion}
                    className="bg-gradient-to-b from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-bold text-2xl px-12 py-4 rounded-[2rem] shadow-[0_8px_0_rgb(29,78,216)] transition-all flex items-center gap-3 hover:-translate-y-1 border-2 border-blue-300"
                  >
                    Lanjut Soal Berikutnya ➡️
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Result View */}
          {mode === 'result' && activeQuiz && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="min-h-[70vh] flex items-center justify-center"
            >
              <div className="bg-white rounded-[3rem] p-10 md:p-16 shadow-2xl border-4 border-yellow-200 text-center max-w-2xl mx-auto relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#fde047_3px,transparent_3px)] bg-[length:30px_30px]"></div>
                <div className="relative z-10 space-y-6">
                  <div className="text-9xl drop-shadow-lg">🏆</div>
                  <h2 className="text-4xl md:text-5xl font-bold text-gray-800">Kuis Selesai!</h2>
                  <p className="text-xl text-gray-600 font-medium">Luar biasa! Ini dia hasil kerja kerasmu:</p>
                  <div className="py-6">
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-widest block mb-2">NILAI KAMU</span>
                    <div className="text-8xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-400 to-orange-500 drop-shadow-sm pb-2">
                      {Math.round((activeQuiz.score / activeQuiz.questions.length) * 100)}
                    </div>
                  </div>
                  <div className="flex gap-4 justify-center">
                    <button 
                      onClick={() => {
                        if (!hasSubmittedSurvey) setShowSurvey(true);
                        else setMode('student');
                      }}
                      className="bg-gradient-to-b from-blue-400 to-blue-600 text-white font-bold text-xl px-10 py-4 rounded-3xl shadow-[0_6px_0_rgb(29,78,216)] hover:-translate-y-1 transition-all"
                    >
                      🏠 Main Lagi!
                    </button>
                    <button 
                      onClick={generatePDF}
                      className="bg-gradient-to-b from-green-400 to-green-600 text-white font-bold text-xl px-10 py-4 rounded-3xl shadow-[0_6px_0_rgb(21,128,61)] hover:-translate-y-1 transition-all"
                    >
                      📄 Download PDF
                    </button>
                  </div>
                  
                  <div className="mt-8 bg-white p-6 rounded-3xl shadow-md">
                    <h3 className="font-bold text-xl mb-4">🏆 Ranking {activeQuiz.mapel.name}</h3>
                    {rankings[activeQuiz.mapel.id]?.map((r, i) => (
                      <div key={i} className="flex justify-between p-2 border-b">
                        <span>{i + 1}. {r.name}</span>
                        <span className="font-bold">{r.score}</span>
                      </div>
                    ))}
                  </div>

                  <Chatbot />
                  {showSurvey && <Survey onClose={() => { setShowSurvey(false); setMode('student'); }} />}
                </div>
              </div>
            </motion.div>
          )}

          {/* Admin Panel */}
          {mode === 'admin' && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-md">
                <div className="flex items-center gap-4 mb-8 border-b border-gray-100 pb-6">
                  <div className="bg-purple-100 p-4 rounded-2xl text-purple-600 shadow-sm">
                    <Wand2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Generator Soal AI (Guru)</h2>
                    <p className="text-gray-500 font-medium mt-1">Unggah bahan ajar, AI akan membuatkan soal interaktif secara otomatis.</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">1. Pilih Mata Pelajaran</label>
                    <select 
                      value={adminMapelId}
                      onChange={(e) => setAdminMapelId(e.target.value)}
                      className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 text-lg font-semibold text-gray-700 focus:border-purple-400 focus:bg-white focus:outline-none transition-all shadow-sm"
                    >
                      <option value="" disabled>-- Klik di sini untuk memilih --</option>
                      {[...MAPEL_LIST].sort((a,b) => a.name.localeCompare(b.name)).map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.id.toUpperCase()})</option>
                      ))}
                    </select>
                  </div>

                  {adminMapelId && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-6 pt-4 border-t-2 border-dashed border-gray-100"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Referensi Utama */}
                        <div className="bg-blue-50/50 p-6 rounded-3xl border-2 border-blue-100 hover:border-blue-300 transition-all">
                          <label className="flex items-center gap-3 font-bold text-blue-800 mb-3 text-lg">
                            <div className="bg-blue-200 p-2 rounded-xl"><Book className="w-5 h-5 text-blue-600" /></div> Referensi Utama (Buku)
                          </label>
                          <input type="file" multiple accept=".txt,.pdf,.docx" onChange={(e) => setAdminMateriFiles(e.target.files)} className="block w-full text-sm text-gray-600 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer shadow-sm transition-all" />
                          <div className="mt-2 text-xs text-gray-500">
                            {adminFiles[adminMapelId]?.materi.map(f => <div key={f}>{f}</div>)}
                          </div>
                        </div>

                        {/* Contoh Soal */}
                        <div className="bg-yellow-50/50 p-6 rounded-3xl border-2 border-yellow-100 hover:border-yellow-300 transition-all">
                          <label className="flex items-center gap-3 font-bold text-yellow-800 mb-3 text-lg">
                            <div className="bg-yellow-200 p-2 rounded-xl"><ListOrdered className="w-5 h-5 text-yellow-600" /></div> Contoh Soal (SAS)
                          </label>
                          <input type="file" multiple accept=".txt,.pdf,.docx" onChange={(e) => setAdminSasFiles(e.target.files)} className="block w-full text-sm text-gray-600 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-yellow-600 file:text-white hover:file:bg-yellow-700 cursor-pointer shadow-sm transition-all" />
                          <div className="mt-2 text-xs text-gray-500">
                            {adminFiles[adminMapelId]?.sas.map(f => <div key={f}>{f}</div>)}
                          </div>
                        </div>

                        {/* Kisi-kisi */}
                        <div className="bg-green-50/50 p-6 rounded-3xl border-2 border-green-100 hover:border-green-300 transition-all">
                          <label className="flex items-center gap-3 font-bold text-green-800 mb-3 text-lg">
                            <div className="bg-green-200 p-2 rounded-xl"><ListOrdered className="w-5 h-5 text-green-600" /></div> Kisi-kisi Materi
                          </label>
                          <input type="file" accept=".txt,.pdf,.docx" onChange={(e) => setAdminKisiFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} className="block w-full text-sm text-gray-600 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-green-600 file:text-white hover:file:bg-green-700 cursor-pointer shadow-sm transition-all" />
                          <div className="mt-2 text-xs text-gray-500">
                            {adminFiles[adminMapelId]?.kisi}
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 p-6 rounded-3xl border-2 border-gray-200 flex flex-col md:flex-row gap-6 items-end shadow-sm">
                        <div className="w-full md:w-1/3">
                          <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Jumlah Soal</label>
                          <input 
                            type="number" 
                            value={adminJumlahSoal}
                            onChange={(e) => setAdminJumlahSoal(parseInt(e.target.value))}
                            min="1" max="50" 
                            className="w-full border-2 border-gray-300 rounded-2xl p-4 text-xl font-bold text-center focus:border-purple-500 focus:outline-none transition-all" 
                          />
                        </div>
                        <div className="w-full md:w-2/3">
                          <button 
                            disabled={adminLoading}
                            onClick={generateQuestions}
                            className="w-full bg-gray-900 hover:bg-black text-white font-bold text-lg py-4 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg disabled:opacity-50"
                          >
                            {adminLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Rocket className="w-6 h-6" />}
                            Mulai Buat Soal Otomatis
                          </button>
                        </div>
                      </div>

                      {adminLoading && (
                        <div className="bg-purple-50 border-2 border-purple-200 text-purple-800 p-6 rounded-3xl font-bold flex flex-col items-center justify-center gap-4 animate-pulse shadow-inner">
                          <Loader2 className="w-10 h-10 animate-spin" />
                          <span className="text-lg">{adminStatus}</span>
                        </div>
                      )}

                      {adminSuccess && (
                        <motion.div 
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="bg-green-50 border-2 border-green-400 text-green-800 p-6 rounded-3xl font-bold flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm"
                        >
                          <div className="flex items-center gap-3 text-lg">
                            <CheckCircle2 className="w-10 h-10 text-green-500" />
                            <div>
                              <span className="block">Berhasil Membuat Soal!</span>
                              <span className="text-sm font-medium text-green-600">Soal baru telah disimpan dan siap dimainkan.</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => setMode('student')}
                            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                          >
                            Coba Mainkan <Play className="w-4 h-4 fill-current" />
                          </button>
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Global Modal */}
      <AnimatePresence>
        {modal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border-4 border-gray-100"
            >
              <div className="flex flex-col items-center text-center gap-4 mb-6">
                <div className="text-6xl drop-shadow-md">{modal.icon}</div>
                <h3 className="text-2xl font-bold text-gray-800">{modal.title}</h3>
              </div>
              <p className="text-gray-600 text-center font-medium leading-relaxed mb-8 bg-gray-50 p-4 rounded-2xl border border-gray-100 text-sm">
                {modal.message}
              </p>
              <button 
                onClick={() => setModal(null)}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold text-xl py-4 rounded-2xl transition-all shadow-lg"
              >
                OK, Mengerti! 👍
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
