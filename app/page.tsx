"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function HomePage() {
  const router = useRouter();
  const [showInstructorForm, setShowInstructorForm] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [learnerLoading, setLearnerLoading] = useState(false);

  const INSTRUCTOR_PASSWORD = "1924";

  const handleInstructorEnter = () => {
    if (password !== INSTRUCTOR_PASSWORD) {
      setError("비밀번호가 틀렸습니다.");
      return;
    }
    localStorage.setItem("instructor", JSON.stringify({ nickname: "선생님" }));
    router.push("/instructor/create");
  };

  const handleLearnerEnter = async () => {
    setLearnerLoading(true);
    setError("");
    try {
      const snap = await getDoc(doc(db, "config", "activeRoom"));
      if (!snap.exists()) {
        setError("현재 진행 중인 퀴즈가 없어요. 선생님께 문의하세요.");
        return;
      }
      const { pin } = snap.data();
      // 방 상태 확인
      const roomSnap = await getDoc(doc(db, "rooms", pin));
      if (!roomSnap.exists() || roomSnap.data().status === "finished") {
        setError("퀴즈가 아직 준비 중이거나 이미 종료됐어요. 선생님께 문의하세요.");
        return;
      }
      router.push(`/learner/quiz/${pin}`);
    } catch {
      setError("연결에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLearnerLoading(false);
    }
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

      {!showInstructorForm && (
        <div className="flex flex-col sm:flex-row gap-5 w-full max-w-md animate-slide-up">
          <button
            onClick={() => { setShowInstructorForm(true); setError(""); }}
            className="flex-1 rounded-3xl p-8 text-white font-bold text-xl shadow-lg hover:scale-105 transition-transform"
            style={{ background: "linear-gradient(135deg, var(--primary), #9B8FFF)" }}
          >
            <div className="text-4xl mb-2">👩‍🏫</div>
            <div>선생님</div>
            <div className="text-sm font-normal mt-1 opacity-80">퀴즈 만들기</div>
          </button>

          <button
            onClick={handleLearnerEnter}
            disabled={learnerLoading}
            className="flex-1 rounded-3xl p-8 text-white font-bold text-xl shadow-lg hover:scale-105 transition-transform disabled:opacity-70 disabled:scale-100"
            style={{ background: "linear-gradient(135deg, var(--secondary), #FF9EC4)" }}
          >
            <div className="text-4xl mb-2">{learnerLoading ? "⏳" : "🧒"}</div>
            <div>학생</div>
            <div className="text-sm font-normal mt-1 opacity-80">
              {learnerLoading ? "퀴즈 찾는 중..." : "퀴즈 참여하기"}
            </div>
          </button>
        </div>
      )}

      {error && !showInstructorForm && (
        <div className="mt-4 px-5 py-3 rounded-2xl text-center animate-slide-up" style={{ background: "#FFF0F0" }}>
          <p className="text-red-500 text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Instructor Form */}
      {showInstructorForm && (
        <div className="bg-white rounded-3xl p-8 shadow-xl w-full max-w-sm animate-bounce-in">
          <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: "var(--primary)" }}>
            👩‍🏫 선생님 입장
          </h2>
          <div className="space-y-4">
            <input
              type="password"
              placeholder="비밀번호 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInstructorEnter()}
              className="w-full border-2 rounded-xl p-3 text-lg text-center tracking-widest font-mono font-bold focus:outline-none focus:border-purple-400"
              style={{ borderColor: "#E0DBFF" }}
              autoFocus
            />
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              onClick={handleInstructorEnter}
              className="w-full py-3 rounded-xl text-white font-bold text-lg hover:opacity-90 transition"
              style={{ background: "var(--primary)" }}
            >
              시작하기 →
            </button>
            <button onClick={() => { setShowInstructorForm(false); setError(""); }} className="w-full text-gray-400 text-sm">
              ← 돌아가기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
