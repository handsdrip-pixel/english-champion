"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { Room, Participant } from "@/types/quiz";

export default function RoomPage({ params }: { params: Promise<{ pin: string }> }) {
  const { pin } = use(params);
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Record<string, Participant>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const roomRef = doc(db, "rooms", pin);
    const unsub = onSnapshot(roomRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Room & { participants?: Record<string, Participant> };
        setParticipants(data.participants || {});
        setRoom(data);
      }
    });
    return () => unsub();
  }, [pin]);

  const copyPin = () => {
    navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const nextQuestion = () => {
    if (!room) return;
    const next = room.currentQuestion + 1;
    if (next >= room.quiz.questions.length) {
      updateDoc(doc(db, "rooms", pin), { status: "finished" });
    } else {
      updateDoc(doc(db, "rooms", pin), { currentQuestion: next });
    }
  };

  const finishQuiz = () => {
    updateDoc(doc(db, "rooms", pin), { status: "finished" });
  };

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-gray-500">방 정보 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const participantList = Object.entries(participants).map(([, p]) => p);
  const sorted = [...participantList].sort((a, b) => b.score - a.score);
  const currentQ = room.quiz?.questions?.[room.currentQuestion];
  const answeredCount = participantList.filter(
    (p) => p.answers?.[`q${room.currentQuestion + 1}`]
  ).length;

  return (
    <div className="min-h-screen p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push("/")} className="text-gray-400 hover:text-gray-600 text-2xl">←</button>
        <h1 className="text-xl font-black" style={{ color: "var(--primary)" }}>🎯 {room.quiz?.title}</h1>
        <span className={`ml-auto px-3 py-1 rounded-full text-sm font-bold text-white ${room.status === "playing" ? "bg-green-500" : "bg-gray-400"}`}>
          {room.status === "playing" ? "진행중" : "종료"}
        </span>
      </div>

      {/* PIN Display */}
      <div className="bg-white rounded-2xl p-6 shadow-md mb-4 text-center">
        <p className="text-gray-500 text-sm mb-1">학생들에게 알려줄 PIN 코드</p>
        <div
          className="text-5xl font-black tracking-widest cursor-pointer hover:opacity-80 transition"
          style={{ color: "var(--primary)" }}
          onClick={copyPin}
        >
          {pin}
        </div>
        <button onClick={copyPin} className="mt-2 text-sm text-gray-400 hover:text-gray-600">
          {copied ? "✓ 복사됨!" : "📋 클릭해서 복사"}
        </button>
        <p className="text-xs text-gray-400 mt-1">홈에서 '학습자' 선택 후 이 PIN 입력</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Left: Controls */}
        <div>
          {room.status === "playing" && currentQ && (
            <div className="bg-white rounded-2xl p-6 shadow-md mb-4">
              <div className="flex justify-between items-center mb-3">
                <span className="font-bold text-gray-600">
                  {room.currentQuestion + 1} / {room.quiz.questions.length}문제
                </span>
                <span className="text-sm text-gray-400">
                  답변: {answeredCount}/{participantList.length}명
                </span>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="font-bold text-gray-800 text-sm">{currentQ.question}</p>
              </div>
              {room.mode === "teacher" && (
                <button
                  onClick={nextQuestion}
                  className="w-full py-3 rounded-xl text-white font-bold"
                  style={{ background: "var(--primary)" }}
                >
                  {room.currentQuestion + 1 >= room.quiz.questions.length ? "🏁 퀴즈 종료" : "▶ 다음 문제"}
                </button>
              )}
              <button
                onClick={finishQuiz}
                className="w-full mt-2 py-2 rounded-xl text-gray-500 text-sm border border-gray-200"
              >
                강제 종료
              </button>
            </div>
          )}

          {room.status === "finished" && (
            <div className="bg-white rounded-2xl p-6 shadow-md mb-4 text-center">
              <div className="text-5xl mb-2">🏆</div>
              <p className="font-bold text-gray-700">퀴즈 종료!</p>
              <button
                onClick={() => router.push("/instructor/create")}
                className="mt-4 w-full py-3 rounded-xl text-white font-bold"
                style={{ background: "var(--primary)" }}
              >
                새 퀴즈 만들기
              </button>
            </div>
          )}

          {/* Participant list */}
          <div className="bg-white rounded-2xl p-4 shadow-md">
            <h3 className="font-bold text-gray-600 mb-3">👥 참여자 ({participantList.length}명)</h3>
            {participantList.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">아직 참여자가 없어요</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {participantList.map((p) => (
                  <div key={p.nickname} className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-green-400"></span>
                    <span className="flex-1">{p.nickname}</span>
                    <span className="font-bold" style={{ color: "var(--primary)" }}>{p.score}점</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Leaderboard */}
        <div className="bg-white rounded-2xl p-6 shadow-md">
          <h3 className="font-bold text-gray-700 mb-4">🏆 실시간 리더보드</h3>
          {sorted.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">⏳</div>
              <p className="text-gray-400 text-sm">학생들이 참여하면 여기에 순위가 나타나요</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map((p, i) => (
                <div
                  key={p.nickname}
                  className={`flex items-center gap-3 p-3 rounded-xl ${i === 0 ? "bg-yellow-50" : i === 1 ? "bg-gray-50" : i === 2 ? "bg-orange-50" : "bg-white border"}`}
                >
                  <span className="text-xl w-8 text-center">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                  </span>
                  <span className="flex-1 font-medium">{p.nickname}</span>
                  <span className="font-black" style={{ color: "var(--primary)" }}>
                    {p.score}점
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
