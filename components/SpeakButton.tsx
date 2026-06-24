"use client";
import { useState } from "react";
import { useTTS } from "@/lib/useTTS";

interface SpeakButtonProps {
  text: string;
  size?: "sm" | "md" | "lg";
  /** 텍스트를 버튼으로 감싸서 클릭 시 읽어주는 모드 */
  inline?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export default function SpeakButton({ text, size = "md", inline = false, children, className }: SpeakButtonProps) {
  const { speak } = useTTS();
  const [playing, setPlaying] = useState(false);

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPlaying(true);
    speak(text);
    // 대략적인 재생 시간 후 아이콘 복귀
    setTimeout(() => setPlaying(false), Math.max(1000, text.length * 80));
  };

  const sizeMap = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base",
  };

  if (inline) {
    return (
      <button
        onClick={handleSpeak}
        className={`group inline-flex items-center gap-1.5 hover:opacity-80 active:scale-95 transition-all cursor-pointer ${className || ""}`}
        title="클릭하여 발음 듣기"
      >
        {children}
        <span className={`${playing ? "animate-ping" : "opacity-0 group-hover:opacity-100"} transition-opacity text-blue-400 text-xs`}>
          🔊
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={handleSpeak}
      className={`${sizeMap[size]} rounded-full flex items-center justify-center transition-all active:scale-90 hover:scale-110 ${className || ""}`}
      style={{ background: playing ? "#6C63FF" : "#EEF2FF" }}
      title="클릭하여 발음 듣기"
    >
      <span className={playing ? "animate-bounce" : ""}>{playing ? "🔊" : "🔈"}</span>
    </button>
  );
}
