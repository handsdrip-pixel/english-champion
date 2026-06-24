export type QuestionType = "multiple" | "ox" | "spelling";

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];       // for multiple choice
  answer: string;
  explanation: string;
  hint?: string;            // for spelling type
}

export interface QuizSet {
  id: string;
  title: string;
  topic: string;
  grade?: string;
  gradeLabel?: string;
  questions: QuizQuestion[];
  createdAt: number;
}

export interface Room {
  pin: string;
  quiz: QuizSet;
  status: "waiting" | "playing" | "finished";
  currentQuestion: number;
  mode: "teacher" | "self";
  timerSeconds: number;
  instructorName: string;
  participants: Record<string, Participant>;
  createdAt: number;
}

export interface Participant {
  nickname: string;
  score: number;
  answers: Record<string, { answer: string; correct: boolean; timeMs: number }>;
  joinedAt: number;
  currentQuestion: number;
  finished: boolean;
}

export interface LeaderboardEntry {
  nickname: string;
  score: number;
  rank: number;
}
