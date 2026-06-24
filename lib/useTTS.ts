"use client";
import { useCallback, useEffect, useRef } from "react";

export function useTTS() {
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();

      // 미국 영어 여성 음성 우선순위
      const preferred = [
        (v: SpeechSynthesisVoice) => v.lang === "en-US" && /samantha|zira|aria|google us english female/i.test(v.name),
        (v: SpeechSynthesisVoice) => v.lang === "en-US" && /female|woman|girl/i.test(v.name),
        (v: SpeechSynthesisVoice) => v.lang === "en-US" && /google us english/i.test(v.name),
        (v: SpeechSynthesisVoice) => v.lang === "en-US",
        (v: SpeechSynthesisVoice) => v.lang.startsWith("en"),
      ];

      for (const matcher of preferred) {
        const found = voices.find(matcher);
        if (found) { voiceRef.current = found; return; }
      }
    };

    pickVoice();
    // Chrome은 비동기로 음성 목록을 로드함
    window.speechSynthesis.onvoiceschanged = pickVoice;
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = 0.88;   // 약간 천천히 (학습용)
    utter.pitch = 1.15;  // 여성 음색에 가깝게
    utter.volume = 1;
    if (voiceRef.current) utter.voice = voiceRef.current;
    window.speechSynthesis.speak(utter);
  }, []);

  return { speak };
}
