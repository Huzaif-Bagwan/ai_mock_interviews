// ElevenLabs Types
export interface ElevenLabsMessage {
  type:
    | "transcript"
    | "user_transcript"
    | "agent_response"
    | "audio"
    | "error"
    | "interruption"
    | "ping";
  role?: "user" | "assistant";
  transcript?: string;
  user_transcript?: string;
  agent_response?: string;
  text?: string;
  audio?: string;
  error?: string;
}

export interface ConversationConfig {
  agentId: string;
  signedUrl?: string;
  overrides?: {
    agent?: {
      prompt?: {
        prompt?: string;
      };
      firstMessage?: string;
      language?: string;
    };
    tts?: {
      voiceId?: string;
    };
  };
}

// Interview Types
export interface Interview {
  id: string;
  role: string;
  level: string;
  techstack: string;
  type: string;
  questions: string[];
  userId: string;
  createdAt: string;
  finishedAt?: string;
  status: "pending" | "in-progress" | "completed";
  transcript?: string;
  feedbackId?: string;
}

export interface InterviewMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
}

// Feedback Types
export interface CategoryScore {
  name: string;
  score: number;
  comment: string;
}

export interface InterviewFeedback {
  id: string;
  interviewId: string;
  userId: string;
  totalScore: number;
  categoryScores: CategoryScore[];
  strengths: string[];
  areasForImprovement: string[];
  overallFeedback: string;
  createdAt: string;
}

// Agent Props
export interface AgentProps {
  userName: string;
  userId: string;
  interviewId?: string;
  feedbackId?: string;
  type: "generate" | "interview";
  questions?: string[];
  role?: string;
  level?: string;
  techstack?: string;
}

// API Response Types
export interface SignedUrlResponse {
  signedUrl: string;
}

export interface SaveTranscriptRequest {
  interviewId: string;
  userId: string;
  messages: InterviewMessage[];
  role: string;
  level: string;
  techstack: string;
}

export interface SaveTranscriptResponse {
  success: boolean;
  feedbackId?: string;
  message?: string;
}
