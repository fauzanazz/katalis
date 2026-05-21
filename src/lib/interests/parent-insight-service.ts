import { prisma } from "@/lib/db";
import { isInterestKey } from "./taxonomy";
import type { InterestKey } from "./taxonomy";

type TopInterest = {
  interestKey: InterestKey;
  score: number;
  confidence: number;
  trend: "rising" | "falling" | "stable";
  signalCount: number;
  lastSignalAt: string | null;
  summary: string | null;
};

type RecentSignal = {
  interestKey: InterestKey;
  source: string;
  dimension: string;
  strength: number;
  observedAt: string;
};

type ParentInterestInsights = {
  topInterests: TopInterest[];
  recentSignals: RecentSignal[];
  suggestedNextQuestions: string[];
};

const QUESTION_TEMPLATES: Record<InterestKey, string[]> = {
  science: ["What experiment would you want to do at home?", "What scientific question do you want to answer?"],
  animals: ["Which animal would you want to learn more about?", "If you could take care of any animal, which would it be?"],
  space: ["What do you think is beyond our galaxy?", "If you could visit one planet, where would you go?"],
  building: ["What would you build if you had unlimited materials?", "What do you want to create next?"],
  machines: ["What machine would you like to design?", "How do you think engines work?"],
  art: ["What kind of art do you want to create next?", "Which art style do you want to try?"],
  music: ["What instrument would you like to learn?", "What kind of music makes you feel happy?"],
  storytelling: ["What story do you want to tell next?", "Who is your favorite character you've created?"],
  movement: ["What new move do you want to learn?", "What dance or sport would you want to try?"],
  sports: ["What sport would you want to play on a team?", "What athletic skill do you want to improve?"],
  cooking: ["What dish would you want to cook for your family?", "What ingredient do you want to learn about?"],
  math_patterns: ["What pattern do you notice in everyday life?", "What number puzzle do you want to solve?"],
  social_helping: ["Who do you want to help this week?", "What would make your community better?"],
  leadership: ["When do you feel like a leader?", "What would you organize if you could?"],
  collecting: ["What do you like collecting most?", "How do you organize your collection?"],
  pretend_play: ["What world would you want to create in pretend play?", "Who would you want to pretend to be?"],
  technology: ["What app or program would you want to build?", "How do computers help people?"],
  reading: ["What book do you want to read next?", "What story world would you want to visit?"],
  water_play: ["What would you explore underwater?", "How does water change in different temperatures?"],
  nature: ["What nature thing do you want to learn about?", "What would you grow in a garden?"],
};

function toTrend(raw: string): "rising" | "falling" | "stable" {
  if (raw === "rising" || raw === "falling") return raw;
  return "stable";
}

function buildSuggestedQuestions(topInterests: TopInterest[]): string[] {
  const questions: string[] = [];
  for (const interest of topInterests.slice(0, 3)) {
    const templates = QUESTION_TEMPLATES[interest.interestKey];
    if (templates && templates.length > 0) {
      questions.push(templates[0]!);
    }
    if (questions.length >= 3) break;
  }
  return questions;
}

export async function getParentInterestInsights(childId: string): Promise<ParentInterestInsights> {
  const [profiles, recentRawSignals] = await Promise.all([
    prisma.childInterestProfile.findMany({
      where: { childId },
      orderBy: { score: "desc" },
      take: 10,
    }),
    prisma.interestSignal.findMany({
      where: { childId },
      orderBy: { observedAt: "desc" },
      take: 20,
    }),
  ]);

  const topInterests: TopInterest[] = profiles.flatMap((p) => {
    if (!isInterestKey(p.interestKey)) return [];
    return [{
      interestKey: p.interestKey,
      score: p.score,
      confidence: p.confidence,
      trend: toTrend(p.trend),
      signalCount: p.signalCount,
      lastSignalAt: p.lastSignalAt ? p.lastSignalAt.toISOString() : null,
      summary: p.summary,
    }];
  });

  const recentSignals: RecentSignal[] = recentRawSignals.flatMap((s) => {
    if (!isInterestKey(s.interestKey)) return [];
    return [{
      interestKey: s.interestKey,
      source: s.source,
      dimension: s.dimension,
      strength: s.strength,
      observedAt: s.observedAt.toISOString(),
    }];
  });

  return {
    topInterests,
    recentSignals,
    suggestedNextQuestions: buildSuggestedQuestions(topInterests),
  };
}
