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
  const [joinUrl, setJoinUrl] = useState("");

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/learner/quiz/${pin}`);
  }, [pin]);

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

  const copyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

      {/* 입장 링크 */}
      <div className="bg-white rounded-2xl p-6 shadow-md mb-4">
        <p className="text-sm font-bold text-gray-500 mb-3">🔗 학생 입장 링크 — 아래 링크를 공유하세요</p>
        <div
          className="flex items-center gap-3 p-4 rounded-xl cursor-pointer hover:opacity-90 transition"
          style={{ background: "linear-gradient(135deg, var(--primary), #9B8FFF)" }}
          onClick={copyLink}
        >
          <span className="text-white text-sm font-mono flex-1 truncate">{joinUrl}</span>
          <span className="text-white text-xl shrink-0">{copied ? "✓" : "📋"}</span>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          {copied ? "✓ 클립보드에 복사됐습니다!" : "클릭하면 링크가 복사됩니다 · 카카오톡, 문자 등으로 공유하세요"}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Left: 현황 & 컨트롤 */}
        <div className="space-y-4">
          {/* 퀴즈 현황 */}
          <div className="bg-white rounded-2xl p-5 shadow-md">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-600">📊 퀴즈 현황</h3>
              <span className="text-sm text-gray-400">{room.quiz?.questions?.length}문제</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-purple-50 rounded-xl p-3">
                <p className="text-2xl font-black" style={{ color: "var(--primary)" }}>{participantList.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">참여자</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-2xl font-black text-green-600">
                  {participantList.filter((p) => p.finished).length}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">완료</p>
              </div>
            </div>
          </div>

          {/* 참여자 목록 */}
          <div className="bg-white rounded-2xl p-4 shadow-md">
            <h3 className="font-bold text-gray-600 mb-3">👥 참여자 ({participantList.length}명)</h3>
            {participantList.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-400 text-sm">아직 참여자가 없어요</p>
                <p className="text-gray-300 text-xs mt-1">위 링크를 공유해보세요</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {participantList.map((p) => (
                  <div key={p.nickname} className="flex items-center gap-2 text-sm">
                    <span className={`w-2 h-2 rounded-full ${p.finished ? "bg-gray-300" : "bg-green-400"}`}></span>
                    <span className="flex-1">{p.nickname}</span>
                    <span className="text-xs text-gray-400">{p.finished ? "완료" : "풀이중"}</span>
                    <span className="font-bold" style={{ color: "var(--primary)" }}>{p.score}점</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 종료 버튼 */}
          {room.status === "playing" && (
            <button
              onClick={finishQuiz}
              className="w-full py-3 rounded-xl font-bold text-white"
              style={{ background: "var(--danger)" }}
            >
              🏁 퀴즈 강제 종료
            </button>
          )}

          {room.status === "finished" && (
            <div className="bg-white rounded-2xl p-6 shadow-md text-center">
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
        </div>

        {/* Right: 실시간 리더보드 */}
        <div className="bg-white rounded-2xl p-6 shadow-md">
          <h3 className="font-bold text-gray-700 mb-4">🏆 실시간 리더보드</h3>
          {sorted.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-2">⏳</div>
              <p className="text-gray-400 text-sm">학생들이 참여하면 여기에 순위가 나타나요</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map((p, i) => (
                <div
                  key={p.nickname}
                  className={`flex items-center gap-3 p-3 rounded-xl ${i === 0 ? "bg-yellow-50 border border-yellow-200" : i === 1 ? "bg-gray-50" : i === 2 ? "bg-orange-50" : "bg-white border"}`}
                >
                  <span className="text-xl w-8 text-center shrink-0">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                  </span>
                  <span className="flex-1 font-medium truncate">{p.nickname}</span>
                  <span className="font-black shrink-0" style={{ color: "var(--primary)" }}>
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
