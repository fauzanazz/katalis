/**
 * Mock mentor chat responses for development.
 *
 * Returns deterministic Socratic-style mentor messages that adapt
 * based on frustration level. Simulates API latency.
 */

import type { MentorResponse, FrustrationLevel } from "../mentor-schemas";

const NONE_RESPONSES: MentorResponse[] = [
  {
    message: "That's a great observation! 🌟 What do you think would happen if you tried the next step?",
    suggestions: ["I'm not sure, what should I do?", "Let me try something!", "Can you give me a hint?"],
    frustrationLevel: "none",
  },
  {
    message: "Interesting approach! Can you tell me more about why you chose to do it that way?",
    suggestions: ["I saw it in a book", "I just guessed", "It felt right"],
    frustrationLevel: "none",
  },
  {
    message: "You're thinking like a real scientist! What's the most interesting thing you've noticed so far?",
    suggestions: ["The materials are cool", "It's harder than I thought", "I want to try something different"],
    frustrationLevel: "none",
  },
];

const LOW_RESPONSES: MentorResponse[] = [
  {
    message: "That's okay! Sometimes the best ideas come from trying different things. What part are you working on right now?",
    suggestions: ["I'm on step 2", "I finished but it doesn't look right", "I need help getting started"],
    frustrationLevel: "low",
  },
  {
    message: "Every inventor faces challenges — that's how they learn! Let's think about this together. What have you tried so far?",
    suggestions: ["I tried following the steps", "I made something different", "Nothing seems to work"],
    frustrationLevel: "low",
  },
];

const MEDIUM_RESPONSES: MentorResponse[] = [
  {
    message: "It sounds like this part is a bit tricky. That's totally normal! Here's a hint: look at the materials list again — is there something you could use differently? 🤔",
    suggestions: ["Show me an easier way", "I want to keep trying", "Can we adjust the mission?"],
    frustrationLevel: "medium",
  },
  {
    message: "You've been working hard on this! Sometimes a small change can make everything click. Want me to suggest a simpler approach, or do you want to keep going?",
    suggestions: ["Yes, make it simpler please", "No, I can do this!", "Just give me a hint"],
    frustrationLevel: "medium",
    offerAdjustment: true,
  },
];

const HIGH_RESPONSES: MentorResponse[] = [
  {
    message: "Hey, you've been really persistent — that's an amazing quality! 💪 I think we should try a Small Adjustment. This means we'll simplify the steps a bit so you can still build something awesome. What do you think?",
    suggestions: ["Yes, let's try the Small Adjustment!", "I want to keep the original plan", "Tell me more about the adjustment"],
    frustrationLevel: "high",
    offerAdjustment: true,
  },
  {
    message: "You know what? Even professional engineers sometimes need to simplify their plans. It's not giving up — it's being smart! Let me suggest a Small Adjustment that still gets you to your goal. Sound good?",
    suggestions: ["Okay, let's try it!", "I'd rather figure this out myself", "What's the adjustment?"],
    frustrationLevel: "high",
    offerAdjustment: true,
  },
];

const GREETING_RESPONSE: MentorResponse = {
  message: "Hi there! 🎉 I'm your Quest Buddy for today! I'm here to help you think through this mission, but I won't just give you answers — I'll ask questions to help YOU figure it out. That's how real creators learn! Ready to start?",
  suggestions: ["Yes, let's go!", "Can you explain the mission?", "I'm not sure what to do first"],
  frustrationLevel: "none",
};

function pickRandom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export async function getMockMentorChat(
  childMessage: string | null,
  frustrationLevel: FrustrationLevel,
  isGreeting: boolean,
): Promise<MentorResponse> {
  const delay = 800 + Math.random() * 700;
  await new Promise((resolve) => setTimeout(resolve, delay));

  if (isGreeting) return GREETING_RESPONSE;

  switch (frustrationLevel) {
    case "high":
      return pickRandom(HIGH_RESPONSES);
    case "medium":
      return pickRandom(MEDIUM_RESPONSES);
    case "low":
      return pickRandom(LOW_RESPONSES);
    default:
      return pickRandom(NONE_RESPONSES);
  }
}

export async function getMockSimplifiedMission(): Promise<{
  simplifiedInstructions: string[];
  encouragementMessage: string;
}> {
  await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 400));

  return {
    simplifiedInstructions: [
      "Start with just the base — don't worry about the extra parts yet",
      "Use the simplest materials you have (tape and cardboard work great!)",
      "Focus on making ONE part work first",
      "Test it and see what happens — that's the fun part!",
    ],
    encouragementMessage:
      "Remember: every great invention started simple and got better over time. You're doing amazing! 🌟",
  };
}

export async function getMockReflectionSummary(): Promise<{
  summary: string;
  strengths: string[];
  encouragement: string;
}> {
  await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));

  return {
    summary: "You showed great curiosity and willingness to try new things during this mission.",
    strengths: ["Creative thinking", "Persistence", "Problem-solving attitude"],
    encouragement:
      "You're growing as a creator every day! Keep exploring and asking questions — that's what makes you special. 🌟",
  };
}
