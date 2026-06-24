"use client";
import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, getDoc } from "firebase/firestore";
import { Room, QuizQuestion } from "@/types/quiz";
import SpeakButton from "@/components/SpeakButton";

// ──────────────────────────────────────────────
// 만점 축하 컨페티 (Canvas 기반)
// ──────────────────────────────────────────────
function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const COLORS = ["#D97706", "#7C3AED", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899", "#F97316"];

    type Particle = {
      x: number; y: number;
      w: number; h: number;
      color: string;
      vy: number; vx: number;
      angle: number; spin: number;
      wobble: number; wobbleSpeed: number;
    };

    const particles: Particle[] = Array.from({ length: 120 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight - window.innerHeight,
      w: Math.random() * 13 + 5,
      h: Math.random() * 6 + 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      vy: Math.random() * 3.5 + 1.5,
      vx: (Math.random() - 0.5) * 2,
      angle: Math.random() * 360,
      spin: (Math.random() - 0.5) * 7,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: Math.random() * 0.1 + 0.04,
    }));

    let frame: number;
    const startTime = performance.now();

    const draw = (now: number) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const alpha = elapsed > 4000 ? Math.max(0, 1 - (elapsed - 4000) / 1200) : 1;

      particles.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x + Math.sin(p.wobble) * 9, p.y);
        ctx.rotate((p.angle * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();

        p.y += p.vy;
        p.x += p.vx;
        p.angle += p.spin;
        p.wobble += p.wobbleSpeed;

        if (p.y > canvas.height + 20 && elapsed < 3200) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }
      });

      if (elapsed < 5200) {
        frame = requestAnimationFrame(draw);
      }
    };

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", top: 0, left: 0, pointerEvents: "none", zIndex: 100 }}
    />
  );
}

// ──────────────────────────────────────────────
// 별 떠오르기 장식
// ──────────────────────────────────────────────
const STAR_POSITIONS = [
  { left: "8%",  delay: "0s",    size: "1.6rem" },
  { left: "20%", delay: "0.3s",  size: "1.1rem" },
  { left: "33%", delay: "0.6s",  size: "1.9rem" },
  { left: "47%", delay: "0.15s", size: "1.3rem" },
  { left: "60%", delay: "0.45s", size: "1.7rem" },
  { left: "72%", delay: "0.2s",  size: "1.2rem" },
  { left: "85%", delay: "0.7s",  size: "2rem"   },
  { left: "93%", delay: "0.35s", size: "1.4rem" },
];

function FloatingStars() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 99 }}>
      {STAR_POSITIONS.map((s, i) => (
        <div
          key={i}
          className="absolute animate-star-float"
          style={{ left: s.left, bottom: "12%", fontSize: s.size, animationDelay: s.delay }}
        >
          ⭐
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// 메인 컴포넌트
// ──────────────────────────────────────────────
export default function LearnerQuizPage({ params }: { params: Promise<{ pin: string }> }) {
  const { pin } = use(params);
  const router = useRouter();

  const [room, setRoom] = useState<Room | null>(null);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [nickname, setNickname] = useState("");
  const [joined, setJoined] = useState(false);

  // 개인 진행 상태
  const [myQuestion, setMyQuestion] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [myFinished, setMyFinished] = useState(false);
  const [isPerfect, setIsPerfect] = useState(false);

  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [spellingInput, setSpellingInput] = useState("");
  const [scorePop, setScorePop] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const myScoreRef = useRef(0);
  const allCorrectRef = useRef(true); // 만점 추적

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
      () => setRoomNotFound(true)
    );
    return () => unsub();
  }, [pin]);

  // 문제 바뀔 때 타이머 리셋
  useEffect(() => {
    if (!joined || !room) return;
    resetTimer(room.timerSeconds || 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myQuestion, joined]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const resetTimer = (seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(seconds);
    setAnswered(false);
    setIsCorrect(null);
    setSelectedAnswer(null);
    setSpellingInput("");
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          allCorrectRef.current = false; // 시간 초과 = 만점 실패
          setAnswered(true);
          setIsCorrect(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const joinRoom = async () => {
    if (!nickname.trim() || !room) return;
    let finalNick = nickname.trim();
    const snap = await getDoc(doc(db, "rooms", pin));
    const existing = snap.data()?.participants || {};
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

    const currentQ = room.quiz.questions[myQuestion];
    const correct = answer.toLowerCase().trim() === currentQ.answer.toLowerCase().trim();
    setIsCorrect(correct);
    if (!correct) allCorrectRef.current = false;

    const elapsedMs = Date.now() - startTimeRef.current;
    const maxTime = (room.timerSeconds || 30) * 1000;
    const timeBonus = correct ? Math.floor(((maxTime - elapsedMs) / maxTime) * 50) : 0;
    const totalScore = correct ? 100 + timeBonus : 0;
    const newScore = myScoreRef.current + totalScore;
    myScoreRef.current = newScore;
    setMyScore(newScore);

    if (correct) {
      setScorePop(true);
      setTimeout(() => setScorePop(false), 500);
    }

    await updateDoc(doc(db, "rooms", pin), {
      [`participants.${nickname}.score`]: newScore,
      [`participants.${nickname}.answers.q${myQuestion + 1}`]: { answer, correct, timeMs: elapsedMs },
    });
  };

  const goNextQuestion = async () => {
    if (!room) return;
    const next = myQuestion + 1;
    if (next >= room.quiz.questions.length) {
      setIsPerfect(allCorrectRef.current);
      setMyFinished(true);
      await updateDoc(doc(db, "rooms", pin), {
        [`participants.${nickname}.finished`]: true,
        [`participants.${nickname}.currentQuestion`]: next,
      });
    } else {
      setMyQuestion(next);
      await updateDoc(doc(db, "rooms", pin), {
        [`participants.${nickname}.currentQuestion`]: next,
      });
    }
  };

  // ── 렌더링 분기 ──────────────────────────────

  if (roomNotFound) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center animate-bounce-in">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-black mb-2">방을 찾을 수 없어요</h2>
          <p className="text-gray-500 mb-4">링크가 만료됐거나 잘못된 주소일 수 있어요</p>
          <button onClick={() => router.push("/")} className="px-6 py-3 rounded-xl text-white font-bold" style={{ background: "var(--secondary)" }}>
            홈으로
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-gray-500">방 찾는 중...</p>
        </div>
      </div>
    );
  }

  // 입장 폼
  if (!joined) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 shadow-xl w-full max-w-sm animate-bounce-in" style={{ border: "2px solid #FDE68A" }}>
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🎯</div>
            <h2 className="text-xl font-black">{room.quiz?.title}</h2>
            <p className="text-gray-400 text-sm mt-1">
              {room.quiz?.questions?.length}문제 {room.quiz?.gradeLabel && `· ${room.quiz.gradeLabel}`}
            </p>
          </div>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="닉네임을 입력하세요"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && joinRoom()}
              className="w-full border-2 rounded-xl p-3 text-lg text-center focus:outline-none focus:border-amber-400"
              style={{ borderColor: "#FDE68A" }}
              autoFocus
            />
            <button
              onClick={joinRoom}
              disabled={!nickname.trim()}
              className="w-full py-3 rounded-xl text-white font-bold text-lg disabled:opacity-40"
              style={{ background: "var(--secondary)" }}
            >
              시작하기! 🚀
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 만점 축하 화면 ──────────────────────────
  if (myFinished && isPerfect) {
    return (
      <>
        <Confetti />
        <FloatingStars />
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg)" }}>
          <div className="text-center w-full max-w-sm" style={{ position: "relative", zIndex: 10 }}>
            {/* 트로피 */}
            <div className="text-8xl mb-2 animate-trophy-spin inline-block">🏆</div>

            {/* 만점 텍스트 */}
            <h1
              className="text-5xl font-black mb-1 animate-perfect-glow"
              style={{ color: "var(--primary)" }}
            >
              만점!
            </h1>
            <p className="text-xl font-bold mb-1" style={{ color: "var(--secondary)" }}>
              완벽해요! 🌟
            </p>
            <p className="text-gray-500 mb-5 text-sm">{nickname}님, 모든 문제를 맞혔어요!</p>

            {/* 점수 카드 */}
            <div
              className="rounded-3xl p-6 mb-4 animate-bounce-in"
              style={{ background: "white", border: "3px solid #FDE68A" }}
            >
              <p
                className="text-7xl font-black animate-score-pop"
                style={{ color: "var(--primary)" }}
              >
                {myScore}
              </p>
              <p className="text-gray-400 text-sm mt-1">점 · 🎯 전문제 정답!</p>
            </div>

            {/* 별 배지 */}
            <div className="flex justify-center gap-2 mb-5">
              {Array.from({ length: room.quiz.questions.length }, (_, i) => (
                <span
                  key={i}
                  className="text-2xl animate-star-float"
                  style={{ animationDelay: `${i * 0.12}s`, animationDuration: "2s" }}
                >
                  ⭐
                </span>
              ))}
            </div>

            <button
              onClick={() => router.push("/")}
              className="w-full px-8 py-3 rounded-xl text-white font-bold text-lg animate-glow-pulse"
              style={{ background: "var(--primary)" }}
            >
              홈으로 🏠
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── 일반 종료 화면 ──────────────────────────
  if (myFinished || room.status === "finished") {
    const participants = Object.values(room.participants || {});
    const sorted = [...participants].sort((a, b) => (b as { score: number }).score - (a as { score: number }).score);
    const myRank = sorted.findIndex((p) => (p as { nickname: string }).nickname === nickname) + 1;

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center animate-bounce-in w-full max-w-sm">
          <div className="text-7xl mb-4 animate-celebrate-bounce inline-block">
            {myRank === 1 ? "🥇" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : "🎉"}
          </div>
          <h2 className="text-3xl font-black mb-1">퀴즈 완료!</h2>
          <p className="text-gray-500 mb-4">{nickname}님의 최종 결과</p>
          <div className="bg-white rounded-2xl p-6 mb-4" style={{ border: "2px solid #FDE68A" }}>
            <p className="text-6xl font-black" style={{ color: "var(--primary)" }}>{myScore}</p>
            <p className="text-gray-400 text-sm mt-1">점 · {sorted.length}명 중 {myRank}위</p>
          </div>
          {sorted.length > 1 && (
            <div className="bg-white rounded-2xl p-4 mb-4 text-left" style={{ border: "2px solid #FDE68A" }}>
              <p className="text-sm font-bold text-gray-500 mb-2">🏆 전체 순위</p>
              {sorted.slice(0, 5).map((p, i) => (
                <div
                  key={(p as { nickname: string }).nickname}
                  className={`flex items-center gap-2 py-1.5 text-sm ${(p as { nickname: string }).nickname === nickname ? "font-bold" : ""}`}
                >
                  <span className="w-5 text-center">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}</span>
                  <span className="flex-1">{(p as { nickname: string }).nickname}</span>
                  <span style={{ color: "var(--primary)" }}>{(p as { score: number }).score}점</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => router.push("/")} className="w-full px-8 py-3 rounded-xl text-white font-bold" style={{ background: "var(--secondary)" }}>
            홈으로
          </button>
        </div>
      </div>
    );
  }

  // ── 퀴즈 풀기 화면 ──────────────────────────
  const currentQ: QuizQuestion | undefined = room.quiz?.questions?.[myQuestion];
  if (!currentQ) return null;

  const timerMax = room.timerSeconds || 30;
  const timerPercent = (timeLeft / timerMax) * 100;
  const timerColor = timerPercent > 50 ? "var(--success)" : timerPercent > 20 ? "var(--accent)" : "var(--danger)";
  const totalQ = room.quiz.questions.length;

  // 4지선다 번호 배경색 (따뜻한 교실 팔레트)
  const optionColors = ["#D97706", "#7C3AED", "#10B981", "#EF4444"];

  return (
    <div className="min-h-screen p-4 max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-500 font-bold truncate max-w-[100px]">{nickname}</span>
        <span
          className={`font-black text-lg transition-all ${scorePop ? "animate-score-pop" : ""}`}
          style={{ color: "var(--primary)" }}
        >
          {myScore}점
        </span>
        <span className="text-sm text-gray-400">{myQuestion + 1}/{totalQ}</span>
      </div>

      {/* 진행 바 */}
      <div className="w-full h-2 bg-gray-100 rounded-full mb-3 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${(myQuestion / totalQ) * 100}%`, background: "var(--primary)" }}
        />
      </div>

      {/* 타이머 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-500">남은 시간</span>
          <span className="font-black" style={{ color: timerColor }}>{timeLeft}초</span>
        </div>
        <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: "#FDE68A" }}>
          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${timerPercent}%`, background: timerColor }} />
        </div>
      </div>

      {/* 문제 카드 */}
      <div className="bg-white rounded-2xl p-6 mb-6 animate-slide-up" style={{ border: "2px solid #FDE68A" }}>
        <div className="flex gap-2 mb-3">
          <span className={`text-xs px-2 py-0.5 rounded-full text-white font-bold ${
            currentQ.type === "multiple" ? "bg-blue-400" : currentQ.type === "ox" ? "bg-emerald-500" : "bg-orange-400"
          }`}>
            {currentQ.type === "multiple" ? "4지선다" : currentQ.type === "ox" ? "OX 퀴즈" : "스펠링"}
          </span>
          <span className="text-xs text-gray-400">Q{myQuestion + 1}</span>
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

      {/* 답변 영역 */}
      {!answered ? (
        <div className="space-y-3">
          {currentQ.type === "multiple" && currentQ.options?.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                onClick={() => submitAnswer(opt)}
                className="flex-1 p-4 rounded-xl text-left font-medium text-base hover:scale-[1.02] active:scale-95 transition-all border-2 flex items-center gap-3 min-h-[56px] bg-white"
                style={{ borderColor: "#FDE68A" }}
              >
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-white"
                  style={{ background: optionColors[i] }}
                >
                  {["①", "②", "③", "④"][i]}
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
                  className="flex-1 py-10 rounded-2xl text-white text-6xl font-black hover:scale-105 active:scale-95 transition-transform"
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
                className="w-full border-2 rounded-xl p-4 text-xl text-center font-mono tracking-widest focus:outline-none focus:border-amber-400"
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
        /* 피드백 카드 */
        <div
          className={`rounded-2xl p-6 text-center border-2 ${
            isCorrect
              ? "animate-pop-in bg-emerald-50 border-emerald-200"
              : "animate-shake-wrong bg-red-50 border-red-200"
          }`}
        >
          <div className="text-6xl mb-3">{isCorrect ? "🎉" : "😅"}</div>
          <p className={`text-2xl font-black mb-2 ${isCorrect ? "text-emerald-600" : "text-red-500"}`}>
            {isCorrect ? "정답!" : selectedAnswer ? `오답! (내 답: ${selectedAnswer})` : "시간 초과!"}
          </p>
          <div className="flex items-center justify-center gap-2 mt-1">
            <p className="text-gray-600">정답: <span className="font-bold">{currentQ.answer}</span></p>
            <SpeakButton text={currentQ.answer} size="sm" />
          </div>

          {isCorrect && (
            <p className="font-bold mt-2" style={{ color: "var(--primary)" }}>
              +{(() => {
                const elapsedMs = Date.now() - startTimeRef.current;
                const maxTime = (room.timerSeconds || 30) * 1000;
                return 100 + Math.floor(((maxTime - Math.min(elapsedMs, maxTime)) / maxTime) * 50);
              })()}점 획득! 🎊
            </p>
          )}

          {!isCorrect && (
            <div className="mt-3 text-left space-y-2">
              <div className="rounded-xl p-3 text-sm" style={{ background: "#FEF3C7" }}>
                <p className="font-bold mb-1" style={{ color: "var(--primary)" }}>📖 해설</p>
                <p className="text-gray-700">{currentQ.explanation}</p>
              </div>
              {currentQ.example && (
                <div className="rounded-xl p-3 text-sm" style={{ background: "#F5F3FF" }}>
                  <p className="font-bold mb-1" style={{ color: "var(--secondary)" }}>💬 예시 문장</p>
                  <div className="flex items-start gap-2">
                    <p className="text-gray-700 flex-1">{currentQ.example}</p>
                    <SpeakButton text={currentQ.example.split("→")[0].trim()} size="sm" />
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={goNextQuestion}
            className="mt-4 w-full py-3 rounded-xl text-white font-bold text-lg hover:opacity-90 transition"
            style={{ background: myQuestion + 1 >= totalQ ? "var(--success)" : "var(--secondary)" }}
          >
            {myQuestion + 1 >= totalQ ? "🏁 결과 보기" : "다음 문제 →"}
          </button>
        </div>
      )}
    </div>
  );
}
