"use client";
import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, getDoc } from "firebase/firestore";
import { Room, QuizQuestion } from "@/types/quiz";
import SpeakButton from "@/components/SpeakButton";

export default function LearnerQuizPage({ params }: { params: Promise<{ pin: string }> }) {
  const { pin } = use(params);
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [nickname, setNickname] = useState("");
  const [joined, setJoined] = useState(false);
  const [myScore, setMyScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [spellingInput, setSpellingInput] = useState("");
  const [prevQuestion, setPrevQuestion] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const stored = localStorage.getItem("learner");
    if (stored) setNickname(JSON.parse(stored).nickname || "");
  }, []);

  useEffect(() => {
    const roomRef = doc(db, "rooms", pin);
    const unsub = onSnapshot(
      roomRef,
      (snap) => {
        if (snap.exists()) {
          setRoom(snap.data() as Room);
          setRoomNotFound(false);
        } else {
          setRoomNotFound(true);
        }
      },
      (err) => {
        console.error("Firestore error:", err);
        setRoomNotFound(true);
      }
    );
    return () => unsub();
  }, [pin]);

  // Reset state when question changes
  useEffect(() => {
    if (!room || !joined) return;
    const qIdx = room.currentQuestion;
    if (qIdx !== prevQuestion) {
      setPrevQuestion(qIdx);
      setSelectedAnswer(null);
      setAnswered(false);
      setIsCorrect(null);
      setSpellingInput("");
      setTimeLeft(room.timerSeconds || 30);
      startTimeRef.current = Date.now();

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            setAnswered(true);
            setIsCorrect(false);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.currentQuestion, joined]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const joinRoom = async () => {
    if (!nickname.trim() || !room) return;
    let finalNick = nickname.trim();

    // 중복 닉네임 체크
    const snap = await getDoc(doc(db, "rooms", pin));
    const data = snap.data();
    const existing = data?.participants || {};
    if (existing[finalNick]) {
      finalNick = `${finalNick}_${Math.floor(Math.random() * 99) + 1}`;
    }

    setNickname(finalNick);
    localStorage.setItem("learner", JSON.stringify({ nickname: finalNick }));

    await updateDoc(doc(db, "rooms", pin), {
      [`participants.${finalNick}`]: {
        nickname: finalNick,
        score: 0,
        answers: {},
        joinedAt: Date.now(),
        currentQuestion: 0,
        finished: false,
      },
    });
    setJoined(true);
  };

  const submitAnswer = async (answer: string) => {
    if (answered || !room || !nickname) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setAnswered(true);
    setSelectedAnswer(answer);

    const currentQ = room.quiz.questions[room.currentQuestion];
    const correct = answer.toLowerCase().trim() === currentQ.answer.toLowerCase().trim();
    setIsCorrect(correct);

    const elapsedMs = Date.now() - startTimeRef.current;
    const maxTime = (room.timerSeconds || 30) * 1000;
    const timeBonus = correct ? Math.floor(((maxTime - elapsedMs) / maxTime) * 50) : 0;
    const totalScore = correct ? 100 + timeBonus : 0;
    const newScore = myScore + totalScore;
    setMyScore(newScore);

    await updateDoc(doc(db, "rooms", pin), {
      [`participants.${nickname}.score`]: newScore,
      [`participants.${nickname}.answers.q${room.currentQuestion + 1}`]: {
        answer,
        correct,
        timeMs: elapsedMs,
      },
    });
  };

  // Room not found
  if (roomNotFound) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center animate-bounce-in">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-black mb-2">방을 찾을 수 없어요</h2>
          <p className="text-gray-500 mb-4">PIN 코드 <span className="font-bold text-red-400">{pin}</span>을 다시 확인해주세요</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 rounded-xl text-white font-bold"
            style={{ background: "var(--secondary)" }}
          >
            홈으로
          </button>
        </div>
      </div>
    );
  }

  // Loading
  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-gray-500">방 찾는 중...</p>
          <p className="text-2xl font-black mt-2" style={{ color: "var(--primary)" }}>{pin}</p>
        </div>
      </div>
    );
  }

  // Join Form
  if (!joined) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 shadow-xl w-full max-w-sm animate-bounce-in">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🎯</div>
            <h2 className="text-xl font-black">{room.quiz?.title}</h2>
            <p className="text-gray-400 text-sm mt-1">{room.quiz?.questions?.length}문제 • {room.instructorName}</p>
          </div>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="닉네임을 입력하세요"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && joinRoom()}
              className="w-full border-2 rounded-xl p-3 text-lg text-center focus:outline-none"
              style={{ borderColor: "#FFE0EE" }}
            />
            <button
              onClick={joinRoom}
              disabled={!nickname.trim()}
              className="w-full py-3 rounded-xl text-white font-bold text-lg disabled:opacity-40"
              style={{ background: "var(--secondary)" }}
            >
              입장하기! 🚀
            </button>
            <button onClick={() => router.push("/")} className="w-full text-gray-400 text-sm">← 돌아가기</button>
          </div>
        </div>
      </div>
    );
  }

  // 방 상태가 "waiting"이어도 joined면 바로 playing 화면으로 넘어감 (아래 Playing 섹션에서 처리)

  // Finished
  if (room.status === "finished") {
    const participants = Object.values(room.participants || {});
    const sorted = [...participants].sort((a, b) => (b as { score: number }).score - (a as { score: number }).score);
    const myRank = sorted.findIndex((p) => (p as { nickname: string }).nickname === nickname) + 1;

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center animate-bounce-in w-full max-w-sm">
          <div className="text-7xl mb-4">{myRank === 1 ? "🥇" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : "🎉"}</div>
          <h2 className="text-3xl font-black mb-2">퀴즈 완료!</h2>
          <p className="text-gray-500 mb-4">{nickname}님의 최종 결과</p>
          <div className="bg-white rounded-2xl p-6 shadow-xl mb-4">
            <p className="text-6xl font-black" style={{ color: "var(--primary)" }}>{myScore}</p>
            <p className="text-gray-400 text-sm mt-1">점 · {sorted.length}명 중 {myRank}위</p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="w-full px-8 py-3 rounded-xl text-white font-bold"
            style={{ background: "var(--secondary)" }}
          >
            홈으로
          </button>
        </div>
      </div>
    );
  }

  // Playing
  const currentQ: QuizQuestion | undefined = room.quiz?.questions?.[room.currentQuestion];
  if (!currentQ) return null;

  const timerMax = room.timerSeconds || 30;
  const timerPercent = (timeLeft / timerMax) * 100;
  const timerColor = timerPercent > 50 ? "var(--success)" : timerPercent > 20 ? "var(--accent)" : "var(--danger)";

  return (
    <div className="min-h-screen p-4 max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-500 font-bold truncate max-w-[100px]">{nickname}</span>
        <span className="font-black text-lg" style={{ color: "var(--primary)" }}>
          {myScore}점
        </span>
        <span className="text-sm text-gray-400">
          {room.currentQuestion + 1}/{room.quiz.questions.length}
        </span>
      </div>

      {/* Timer */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-500">남은 시간</span>
          <span className="font-black" style={{ color: timerColor }}>{timeLeft}초</span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${timerPercent}%`, background: timerColor }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="bg-white rounded-2xl p-6 shadow-md mb-6 animate-slide-up">
        <div className="flex gap-2 mb-3">
          <span className={`text-xs px-2 py-0.5 rounded-full text-white font-bold ${
            currentQ.type === "multiple" ? "bg-blue-400" : currentQ.type === "ox" ? "bg-green-400" : "bg-orange-400"
          }`}>
            {currentQ.type === "multiple" ? "4지선다" : currentQ.type === "ox" ? "OX 퀴즈" : "스펠링"}
          </span>
          <span className="text-xs text-gray-400">Q{room.currentQuestion + 1}</span>
        </div>
        <div className="flex items-start gap-3">
          <p className="text-lg font-bold text-gray-800 flex-1">{currentQ.question}</p>
          <SpeakButton text={currentQ.question} size="md" className="shrink-0 mt-0.5" />
        </div>
        {currentQ.type === "spelling" && currentQ.hint && (
          <div className="flex items-center gap-2 mt-2">
            <p className="text-orange-500 text-sm">💡 힌트: {currentQ.hint}</p>
            <SpeakButton text={currentQ.hint} size="sm" />
          </div>
        )}
      </div>

      {/* Answer Options */}
      {!answered ? (
        <div className="space-y-3">
          {currentQ.type === "multiple" && currentQ.options?.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                onClick={() => submitAnswer(opt)}
                className="flex-1 p-4 rounded-xl text-left font-medium text-base shadow-sm hover:scale-[1.02] active:scale-95 transition-all border-2 flex items-center gap-3 min-h-[56px]"
                style={{ background: "white", borderColor: "#E0DBFF" }}
              >
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                  style={{ background: ["#6C63FF","#FF6B9D","#FFD93D","#6BCB77"][i], color: i === 2 ? "#333" : "white" }}
                >
                  {["①","②","③","④"][i]}
                </span>
                {opt}
              </button>
              <SpeakButton text={opt} size="sm" />
            </div>
          ))}

          {currentQ.type === "ox" && (
            <div className="flex gap-4">
              {["O", "X"].map((v) => (
                <button
                  key={v}
                  onClick={() => submitAnswer(v)}
                  className="flex-1 py-10 rounded-2xl text-white text-6xl font-black shadow-lg hover:scale-105 active:scale-95 transition-transform"
                  style={{ background: v === "O" ? "var(--success)" : "var(--danger)" }}
                >
                  {v}
                </button>
              ))}
            </div>
          )}

          {currentQ.type === "spelling" && (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="영단어를 입력하세요..."
                value={spellingInput}
                onChange={(e) => setSpellingInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && spellingInput.trim() && submitAnswer(spellingInput.trim())}
                className="w-full border-2 rounded-xl p-4 text-xl text-center font-mono tracking-widest focus:outline-none"
                style={{ borderColor: "var(--secondary)" }}
                autoFocus
              />
              <button
                onClick={() => spellingInput.trim() && submitAnswer(spellingInput.trim())}
                disabled={!spellingInput.trim()}
                className="w-full py-4 rounded-xl text-white font-bold text-xl disabled:opacity-40"
                style={{ background: "var(--secondary)" }}
              >
                제출하기 ✓
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className={`rounded-2xl p-6 text-center animate-bounce-in ${isCorrect ? "bg-green-50 border-2 border-green-200" : "bg-red-50 border-2 border-red-200"}`}>
          <div className="text-6xl mb-3">{isCorrect ? "🎉" : "😅"}</div>
          <p className={`text-2xl font-black mb-2 ${isCorrect ? "text-green-600" : "text-red-500"}`}>
            {isCorrect ? "정답!" : selectedAnswer ? `오답! (내 답: ${selectedAnswer})` : "시간 초과!"}
          </p>
          <div className="flex items-center justify-center gap-2 mt-1">
            <p className="text-gray-600">
              정답: <span className="font-bold">{currentQ.answer}</span>
            </p>
            <SpeakButton text={currentQ.answer} size="sm" />
          </div>
          <p className="text-gray-400 text-sm mt-2">{currentQ.explanation}</p>
          {isCorrect && (
            <p className="text-green-500 font-bold mt-2">+100점 획득!</p>
          )}
          {room.mode === "teacher" ? (
            <p className="text-gray-400 text-xs mt-3">선생님이 다음 문제로 넘어갈 때까지 기다리세요...</p>
          ) : (
            room.currentQuestion + 1 < room.quiz.questions.length ? (
              <button
                onClick={() => updateDoc(doc(db, "rooms", pin), { currentQuestion: room.currentQuestion + 1 })}
                className="mt-4 px-6 py-2 rounded-xl text-white font-bold text-sm"
                style={{ background: "var(--primary)" }}
              >
                다음 문제 →
              </button>
            ) : (
              <button
                onClick={() => updateDoc(doc(db, "rooms", pin), { status: "finished" })}
                className="mt-4 px-6 py-2 rounded-xl text-white font-bold text-sm"
                style={{ background: "var(--success)" }}
              >
                🏁 완료!
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
