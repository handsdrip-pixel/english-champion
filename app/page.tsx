"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [showInstructorForm, setShowInstructorForm] = useState(false);
  const [showLearnerForm, setShowLearnerForm] = useState(false);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [learnerNick, setLearnerNick] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleInstructorEnter = () => {
    if (!nickname.trim() || !password.trim()) {
      setError("닉네임과 비밀번호를 입력해주세요.");
      return;
    }
    localStorage.setItem("instructor", JSON.stringify({ nickname, password }));
    router.push("/instructor/create");
  };

  const handleLearnerEnter = () => {
    if (!learnerNick.trim() || pin.length < 6) {
      setError("닉네임과 6자리 PIN을 입력해주세요.");
      return;
    }
    localStorage.setItem("learner", JSON.stringify({ nickname: learnerNick }));
    router.push(`/learner/quiz/${pin.toUpperCase()}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="text-center mb-10 animate-bounce-in">
        <div className="text-7xl mb-3">🏆</div>
        <h1 className="text-5xl font-black" style={{ color: "var(--primary)" }}>
          영어챔피언
        </h1>
        <p className="text-gray-500 mt-2 text-lg">AI 영어 퀴즈 플랫폼</p>
      </div>

      {!showInstructorForm && !showLearnerForm && (
        <div className="flex flex-col sm:flex-row gap-5 w-full max-w-md animate-slide-up">
          <button
            onClick={() => { setShowInstructorForm(true); setShowLearnerForm(false); setError(""); }}
            className="flex-1 rounded-3xl p-8 text-white font-bold text-xl shadow-lg hover:scale-105 transition-transform"
            style={{ background: "linear-gradient(135deg, var(--primary), #9B8FFF)" }}
          >
            <div className="text-4xl mb-2">👩‍🏫</div>
            <div>교수자</div>
            <div className="text-sm font-normal mt-1 opacity-80">퀴즈 만들기</div>
          </button>
          <button
            onClick={() => { setShowLearnerForm(true); setShowInstructorForm(false); setError(""); }}
            className="flex-1 rounded-3xl p-8 text-white font-bold text-xl shadow-lg hover:scale-105 transition-transform"
            style={{ background: "linear-gradient(135deg, var(--secondary), #FF9EC4)" }}
          >
            <div className="text-4xl mb-2">🧒</div>
            <div>학습자</div>
            <div className="text-sm font-normal mt-1 opacity-80">퀴즈 참여하기</div>
          </button>
        </div>
      )}

      {/* Instructor Form */}
      {showInstructorForm && (
        <div className="bg-white rounded-3xl p-8 shadow-xl w-full max-w-sm animate-bounce-in">
          <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: "var(--primary)" }}>
            👩‍🏫 교수자 입장
          </h2>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="닉네임 (예: 김선생님)"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full border-2 rounded-xl p-3 text-lg focus:outline-none focus:border-purple-400"
              style={{ borderColor: "#E0DBFF" }}
            />
            <input
              type="password"
              placeholder="세션 비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInstructorEnter()}
              className="w-full border-2 rounded-xl p-3 text-lg focus:outline-none focus:border-purple-400"
              style={{ borderColor: "#E0DBFF" }}
            />
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              onClick={handleInstructorEnter}
              className="w-full py-3 rounded-xl text-white font-bold text-lg hover:opacity-90 transition"
              style={{ background: "var(--primary)" }}
            >
              시작하기 →
            </button>
            <button onClick={() => setShowInstructorForm(false)} className="w-full text-gray-400 text-sm">
              ← 돌아가기
            </button>
          </div>
        </div>
      )}

      {/* Learner Form */}
      {showLearnerForm && (
        <div className="bg-white rounded-3xl p-8 shadow-xl w-full max-w-sm animate-bounce-in">
          <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: "var(--secondary)" }}>
            🧒 학습자 입장
          </h2>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="닉네임 (예: 홍길동)"
              value={learnerNick}
              onChange={(e) => setLearnerNick(e.target.value)}
              className="w-full border-2 rounded-xl p-3 text-lg focus:outline-none"
              style={{ borderColor: "#FFE0EE" }}
            />
            <input
              type="text"
              placeholder="6자리 PIN 코드"
              value={pin}
              onChange={(e) => setPin(e.target.value.toUpperCase().slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && handleLearnerEnter()}
              className="w-full border-2 rounded-xl p-3 text-lg text-center tracking-widest font-mono font-bold focus:outline-none"
              style={{ borderColor: "#FFE0EE" }}
              maxLength={6}
            />
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              onClick={handleLearnerEnter}
              className="w-full py-3 rounded-xl text-white font-bold text-lg hover:opacity-90 transition"
              style={{ background: "var(--secondary)" }}
            >
              입장하기 →
            </button>
            <button onClick={() => setShowLearnerForm(false)} className="w-full text-gray-400 text-sm">
              ← 돌아가기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
