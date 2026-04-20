/**
 * Mock parent report generator for development.
 * Returns deterministic report content based on child talent data.
 */

import type { HomeTip } from "@/lib/parent/schemas";

interface MockReportInput {
  childTalents: string[];
  periodStart: string;
  periodEnd: string;
}

export async function getMockParentReport(input: MockReportInput) {
  await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));

  const primaryTalent = input.childTalents[0] ?? "Creative";

  const strengthMap: Record<string, string[]> = {
    Engineering: [
      "Strong mechanical reasoning and design skills",
      "Excellent at breaking complex problems into steps",
      "Shows persistence when facing building challenges",
    ],
    Art: [
      "Rich creative expression through visual media",
      "Strong sense of color and composition",
      "Growing ability to communicate ideas through art",
    ],
    Narrative: [
      "Vivid imagination and storytelling ability",
      "Good at creating characters and plot lines",
      "Expresses emotions effectively through stories",
    ],
    default: [
      "Demonstrates curiosity and eagerness to learn",
      "Shows creativity in approaching challenges",
      "Growing confidence in expressing ideas",
    ],
  };

  const growthMap: Record<string, string[]> = {
    Engineering: [
      "Encourage documenting designs with drawings and labels",
      "Try projects that combine building with storytelling",
    ],
    Art: [
      "Explore different art materials beyond paper and pencil",
      "Try collaborative art projects with friends or family",
    ],
    Narrative: [
      "Practice telling stories aloud to build confidence",
      "Try creating stories with a beginning, middle, and end structure",
    ],
    default: [
      "Encourage exploring different types of creative activities",
      "Support their interests with age-appropriate challenges",
    ],
  };

  const summaryMap: Record<string, string> = {
    Engineering: "Your child demonstrated impressive engineering and problem-solving abilities this period. They showed persistence in completing hands-on building challenges and creative thinking in their designs.",
    Art: "Your child expressed remarkable artistic creativity this period. Their use of color, shape, and composition shows growing confidence in visual expression.",
    Narrative: "Your child's storytelling skills blossomed this period. They showed strong imagination and growing ability to structure their narratives.",
    default: "Your child showed wonderful curiosity and creativity this period. They engaged enthusiastically with their learning activities and are developing new skills.",
  };

  return {
    strengths: strengthMap[primaryTalent] ?? strengthMap.default,
    growthAreas: growthMap[primaryTalent] ?? growthMap.default,
    tips: getMockTips(primaryTalent),
    summary: summaryMap[primaryTalent] ?? summaryMap.default,
    badgeHighlights: ["first_step"],
  };
}

function getMockTips(talent: string): HomeTip[] {
  const tipsMap: Record<string, HomeTip[]> = {
    Engineering: [
      {
        title: "Build a Cardboard Bridge",
        description: "Use cardboard boxes and tape to build a bridge. Test how much weight it holds! Discuss what makes it strong or weak.",
        materials: ["Cardboard", "Tape", "Small toys for weight testing"],
        category: "Engineering",
      },
      {
        title: "Design Your Dream Machine",
        description: "Ask your child to draw a machine that helps people. Encourage them to label each part and explain how it works.",
        materials: ["Paper", "Pencil", "Crayons"],
        category: "Engineering",
      },
    ],
    Art: [
      {
        title: "Nature Color Hunt",
        description: "Go outside and find objects matching each color of the rainbow. Arrange them in a line and photograph your found palette!",
        materials: ["None needed — just outdoor space"],
        category: "Art",
      },
      {
        title: "Story in a Picture",
        description: "Ask your child to draw a picture that tells a story without words. Then have them tell you the story their picture shows.",
        materials: ["Paper", "Crayons or markers"],
        category: "Art",
      },
    ],
    Narrative: [
      {
        title: "Finish the Story",
        description: "Start a story with 'Once there was a child who found a magical...' and let your child finish it. Take turns adding sentences!",
        materials: ["None needed — just imagination"],
        category: "Narrative",
      },
    ],
  };

  return tipsMap[talent] ?? [
    {
      title: "Explore Together",
      description: "Spend 15 minutes exploring something new with your child. Follow their lead and ask open-ended questions.",
      materials: ["Curiosity and time together"],
      category: "Creative",
    },
  ];
}
