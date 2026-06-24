"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { QuizSet, QuizQuestion } from "@/types/quiz";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";

type QuestionTypeOption = "multiple" | "ox" | "spelling" | "mixed";
type InputMode = "text" | "image";

export type GradeLevel =
  | "elem_3_4"
  | "elem_5_6"
  | "middle_1"
  | "middle_2"
  | "middle_3"
  | "high_1"
  | "high_2"
  | "high_3";

export const GRADE_LEVELS: { value: GradeLevel; label: string; sub: string; color: string }[] = [
  { value: "elem_3_4",  label: "초등 3-4학년", sub: "알파벳·기초 인사",   color: "#6BCB77" },
  { value: "elem_5_6",  label: "초등 5-6학년", sub: "500단어·현재·과거형", color: "#4CAF50" },
  { value: "middle_1",  label: "중학교 1학년", sub: "750단어·기본 문법",   color: "#6C63FF" },
  { value: "middle_2",  label: "중학교 2학년", sub: "1,000단어·진행·미래형",color: "#5B54E0" },
  { value: "middle_3",  label: "중학교 3학년", sub: "1,200단어·관계사",    color: "#FFD93D" },
  { value: "high_1",   label: "고등 1학년",   sub: "1,800단어·완료·수동태",color: "#FF6B9D" },
  { value: "high_2",   label: "고등 2학년",   sub: "2,500단어·가정법",     color: "#FF4D4D" },
  { value: "high_3",   label: "고등 3학년",   sub: "3,000단어·수능 수준",  color: "#C0392B" },
];

export default function CreateQuizPage() {
  const router = useRouter();
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(10);
  const [type, setType] = useState<QuestionTypeOption>("multiple");
  const [grade, setGrade] = useState<GradeLevel>("elem_5_6");
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState<QuizSet | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [creatingRoom, setCreatingRoom] = useState(false);

  // 이미지 관련
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const instructor = typeof window !== "undefined"
    ? JSON.parse(localStorage.getItem("instructor") || "{}")
    : {};

  const handleImageSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드할 수 있어요.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("파일 크기는 10MB 이하여야 해요.");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImagePreview(result);
      // base64 부분만 추출 (data:image/...;base64, 제거)
      setImageBase64(result.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageSelect(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const canGenerate = inputMode === "text" ? topic.trim().length > 0 : imageBase64 !== null;

  const generateQuiz = async () => {
    if (!canGenerate) return;
    setLoading(true);
    setQuiz(null);
    try {
      const body = inputMode === "image"
        ? { image: imageBase64, imageType: imageFile?.type || "image/jpeg", count, type, grade }
        : { topic, count, type, grade };

      const res = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setQuiz(data);
    } catch (e) {
      alert(`퀴즈 생성에 실패했습니다: ${e instanceof Error ? e.message : "다시 시도해주세요."}`);
    } finally {
      setLoading(false);
    }
  };

  const updateQuestion = (qId: string, field: keyof QuizQuestion, value: string) => {
    if (!quiz) return;
    setQuiz({
      ...quiz,
      questions: quiz.questions.map((q) =>
        q.id === qId ? { ...q, [field]: value } : q
      ),
    });
  };

  const updateOption = (qId: string, idx: number, value: string) => {
    if (!quiz) return;
    setQuiz({
      ...quiz,
      questions: quiz.questions.map((q) =>
        q.id === qId
          ? { ...q, options: q.options?.map((o, i) => (i === idx ? value : o)) }
          : q
      ),
    });
  };

  const createRoom = async () => {
    if (!quiz) return;
    setCreatingRoom(true);
    const pin = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      await setDoc(doc(db, "rooms", pin), {
        pin,
        quiz,
        status: "playing",
        currentQuestion: 0,
        mode: "self",
        timerSeconds,
        instructorName: instructor.nickname || "선생님",
        participants: {},
        createdAt: Date.now(),
      });
      // 현재 활성 방 등록 → 학습자가 자동으로 찾아옴
      await setDoc(doc(db, "config", "activeRoom"), { pin, createdAt: Date.now() });
      router.push(`/instructor/room/${pin}`);
    } catch (e) {
      console.error(e);
      alert("방 생성에 실패했습니다. Firebase Firestore 권한을 확인해주세요.");
      setCreatingRoom(false);
    }
  };

  const typeLabels: Record<QuestionTypeOption, string> = {
    multiple: "4지선다",
    ox: "OX 퀴즈",
    spelling: "스펠링",
    mixed: "혼합",
  };

  return (
    <div className="min-h-screen p-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/")} className="text-gray-400 hover:text-gray-600 text-2xl">←</button>
        <h1 className="text-2xl font-black" style={{ color: "var(--primary)" }}>✨ 퀴즈 만들기</h1>
        <span className="ml-auto text-sm text-gray-400">👋 선생님</span>
      </div>

      {/* 입력 방식 토글 */}
      <div className="flex gap-2 mb-4 p-1 bg-white rounded-2xl shadow-sm">
        <button
          onClick={() => setInputMode("text")}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
            inputMode === "text" ? "text-white shadow-md" : "text-gray-400"
          }`}
          style={inputMode === "text" ? { background: "var(--primary)" } : {}}
        >
          ✏️ 텍스트로 출제
        </button>
        <button
          onClick={() => setInputMode("image")}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
            inputMode === "image" ? "text-white shadow-md" : "text-gray-400"
          }`}
          style={inputMode === "image" ? { background: "var(--secondary)" } : {}}
        >
          📷 교재 이미지로 출제
        </button>
      </div>

      {/* Generation Form */}
      <div className="bg-white rounded-2xl p-6 shadow-md mb-6">
        <div className="space-y-4">

          {/* 텍스트 모드 */}
          {inputMode === "text" && (
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-1">📚 퀴즈 주제</label>
              <input
                type="text"
                placeholder="예: Animals, Food, School life, 과거형 문법..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && generateQuiz()}
                className="w-full border-2 rounded-xl p-3 text-lg focus:outline-none focus:border-amber-400"
                style={{ borderColor: "#FDE68A" }}
              />
            </div>
          )}

          {/* 이미지 모드 */}
          {inputMode === "image" && (
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">
                📷 교재 / 학습지 이미지 업로드
              </label>

              {!imagePreview ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={() => setIsDragging(false)}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-3 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                    isDragging ? "border-amber-400 bg-amber-50 scale-[1.02]" : "border-gray-200 hover:border-amber-300 hover:bg-amber-50"
                  }`}
                  style={{ borderWidth: "3px" }}
                >
                  <div className="text-5xl mb-3">📸</div>
                  <p className="font-bold text-gray-600">이미지를 드래그하거나 클릭해서 업로드</p>
                  <p className="text-sm text-gray-400 mt-1">교재, 학습지, 단어장 등 영어 관련 자료</p>
                  <p className="text-xs text-gray-300 mt-2">JPG, PNG, WEBP · 최대 10MB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
                  />
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="업로드된 교재"
                    className="w-full max-h-72 object-contain rounded-xl border-2 border-amber-200 bg-gray-50"
                  />
                  <button
                    onClick={clearImage}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 text-white text-sm font-bold flex items-center justify-center hover:bg-red-600"
                  >
                    ✕
                  </button>
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                    <span className="text-green-500">✓</span>
                    <span>{imageFile?.name}</span>
                    <span className="text-gray-300">·</span>
                    <span>{((imageFile?.size || 0) / 1024).toFixed(0)}KB</span>
                  </div>
                </div>
              )}

              {imagePreview && (
                <div className="mt-3 p-3 rounded-xl text-sm text-gray-500 flex items-start gap-2"
                  style={{ background: "#FFF8E7" }}>
                  <span>💡</span>
                  <span>AI가 이미지 속 영어 단어, 문장, 문법 요소를 분석하여 퀴즈를 생성합니다.</span>
                </div>
              )}
            </div>
          )}

          {/* 난이도 선택 */}
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-2">🎓 학년 난이도</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {GRADE_LEVELS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGrade(g.value)}
                  className={`px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                    grade === g.value
                      ? "border-transparent text-white shadow-md scale-[1.02]"
                      : "border-gray-100 bg-gray-50 hover:border-gray-200"
                  }`}
                  style={grade === g.value ? { background: g.color } : {}}
                >
                  <div className={`text-xs font-black ${grade === g.value ? "text-white" : "text-gray-700"}`}>
                    {g.label}
                  </div>
                  <div className={`text-[10px] mt-0.5 leading-tight ${grade === g.value ? "text-white opacity-90" : "text-gray-400"}`}>
                    {g.sub}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 공통 설정 */}
          <div className="flex gap-3 flex-wrap">
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-1">📝 문항 수</label>
              <div className="flex gap-2">
                {[10, 30, 50].map((n) => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={`px-4 py-2 rounded-xl font-bold border-2 transition text-sm ${
                      count === n ? "text-white border-transparent" : "text-gray-500 border-gray-200"
                    }`}
                    style={count === n ? { background: "var(--primary)" } : {}}
                  >
                    {n}문제
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-1">🎮 문제 유형</label>
              <div className="flex gap-2 flex-wrap">
                {(["multiple", "ox", "spelling", "mixed"] as QuestionTypeOption[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`px-4 py-2 rounded-xl font-bold border-2 transition text-sm ${
                      type === t ? "text-white border-transparent" : "text-gray-500 border-gray-200"
                    }`}
                    style={type === t ? { background: "var(--secondary)" } : {}}
                  >
                    {typeLabels[t]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={generateQuiz}
            disabled={loading || !canGenerate}
            className="w-full py-4 rounded-xl text-white font-black text-xl disabled:opacity-50 hover:opacity-90 transition shadow-md"
            style={{ background: `linear-gradient(135deg, ${inputMode === "image" ? "var(--secondary), #FF9EC4" : "var(--primary), var(--secondary)"})` }}
          >
            {loading
              ? "🤖 AI가 분석 중..."
              : inputMode === "image"
              ? "🔍 이미지 분석 후 퀴즈 생성!"
              : "🚀 AI 퀴즈 생성!"}
          </button>
        </div>
      </div>

      {/* Loading Animation */}
      {loading && (
        <div className="text-center py-10 animate-pulse">
          <div className="text-6xl mb-4">{inputMode === "image" ? "🔍" : "🤖"}</div>
          <p className="text-gray-500 font-bold">
            {inputMode === "image" ? "교재 이미지를 분석하고 있어요..." : "AI가 퀴즈를 생성하고 있어요..."}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {inputMode === "image" ? "이미지 분석은 10~20초 걸릴 수 있어요" : "보통 5~10초 걸려요"}
          </p>
        </div>
      )}

      {/* Quiz Preview & Edit */}
      {quiz && !loading && (
        <div className="animate-slide-up">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-xl font-bold">{quiz.title}</h2>
            <div className="flex items-center gap-2">
              {quiz.gradeLabel && (
                <span
                  className="text-xs px-2 py-1 rounded-full text-white font-bold"
                  style={{ background: GRADE_LEVELS.find((g) => g.value === quiz.grade)?.color || "var(--primary)" }}
                >
                  🎓 {quiz.gradeLabel}
                </span>
              )}
              <span className="text-gray-400 text-sm">{quiz.questions.length}문제</span>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            {quiz.questions.map((q, idx) => (
              <div key={q.id} className="bg-white rounded-2xl p-5 shadow-md">
                <div className="flex items-start gap-3">
                  <span
                    className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ background: "var(--primary)" }}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full text-white font-bold ${
                        q.type === "multiple" ? "bg-blue-400" : q.type === "ox" ? "bg-green-400" : "bg-orange-400"
                      }`}>
                        {q.type === "multiple" ? "4지선다" : q.type === "ox" ? "OX" : "스펠링"}
                      </span>
                      <button
                        onClick={() => setEditingId(editingId === q.id ? null : q.id)}
                        className="text-xs text-purple-400 hover:text-purple-600"
                      >
                        {editingId === q.id ? "✓ 완료" : "✏️ 편집"}
                      </button>
                    </div>

                    {editingId === q.id ? (
                      <textarea
                        value={q.question}
                        onChange={(e) => updateQuestion(q.id, "question", e.target.value)}
                        className="w-full border rounded-lg p-2 text-sm mb-2"
                        rows={2}
                      />
                    ) : (
                      <p className="font-medium text-gray-800 mb-2">{q.question}</p>
                    )}

                    {q.type === "multiple" && q.options && (
                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map((opt, i) => (
                          <div key={i} className={`rounded-lg px-3 py-2 text-sm ${
                            opt === q.answer ? "font-bold text-green-700 bg-green-50 border border-green-200" : "bg-gray-50 text-gray-600"
                          }`}>
                            {editingId === q.id ? (
                              <input
                                value={opt}
                                onChange={(e) => updateOption(q.id, i, e.target.value)}
                                className="w-full bg-transparent border-b text-sm"
                              />
                            ) : (
                              <>{["①","②","③","④"][i]} {opt} {opt === q.answer && "✓"}</>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {q.type === "ox" && (
                      <div className="flex gap-2">
                        {["O", "X"].map((v) => (
                          <span key={v} className={`px-4 py-1 rounded-lg font-bold text-lg ${
                            v === q.answer ? "text-green-700 bg-green-50" : "text-gray-400 bg-gray-50"
                          }`}>
                            {v} {v === q.answer && "✓"}
                          </span>
                        ))}
                      </div>
                    )}

                    {q.type === "spelling" && (
                      <p className="text-sm text-orange-600">
                        💡 힌트: {q.hint} → 정답: <span className="font-bold">{q.answer}</span>
                      </p>
                    )}

                    <p className="text-xs text-gray-400 mt-2">💬 {q.explanation}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Room Settings */}
          <div className="bg-white rounded-2xl p-6 shadow-md mb-6">
            <h3 className="font-bold text-gray-700 mb-4">⏱️ 문제당 제한 시간</h3>
            <div className="flex gap-2">
              {[20, 30, 60].map((t) => (
                <button
                  key={t}
                  onClick={() => setTimerSeconds(t)}
                  className={`px-5 py-2 rounded-xl font-bold border-2 transition text-sm ${
                    timerSeconds === t ? "text-white border-transparent" : "text-gray-500 border-gray-200"
                  }`}
                  style={timerSeconds === t ? { background: "var(--accent)", color: "#333" } : {}}
                >
                  {t}초
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={createRoom}
            disabled={creatingRoom}
            className="w-full py-4 rounded-xl text-white font-black text-xl disabled:opacity-50 hover:opacity-90 transition shadow-lg"
            style={{ background: "linear-gradient(135deg, var(--success), #4CAF50)" }}
          >
            {creatingRoom ? "방 만드는 중..." : "🎉 방 만들기"}
          </button>
        </div>
      )}
    </div>
  );
}
