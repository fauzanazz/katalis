/**
 * Home tips recommendation engine.
 * Curated library of at-home mentoring tips filtered by child's talent category.
 * No AI needed — rule-based matching.
 */

import type { HomeTip } from "./schemas";

const HOME_TIPS_LIBRARY: HomeTip[] = [
  // Engineering
  {
    title: "Build a Cardboard Bridge",
    description: "Use cardboard boxes and tape to build a bridge. Test how much weight it can hold by stacking small objects on top. Discuss what makes a bridge strong.",
    materials: ["Cardboard", "Tape", "Small toys for testing"],
    category: "Engineering",
  },
  {
    title: "Design Your Dream Machine",
    description: "Ask your child to draw a machine that helps people. Encourage labeling each part and explaining how it works together.",
    materials: ["Paper", "Pencil", "Crayons"],
    category: "Engineering",
  },
  {
    title: "Egg Drop Challenge",
    description: "Use household materials to protect an egg from a 1-meter drop. Let your child design the protective casing and test it!",
    materials: ["Egg", "Newspaper", "Tape", "Cotton balls", "Plastic bags"],
    category: "Engineering",
  },
  // Art
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
  {
    title: "Shadow Art",
    description: "Place toys or objects on paper in sunlight. Trace the shadows to create art! Move the objects and trace again for layered effects.",
    materials: ["Paper", "Pencil", "Small toys", "Sunny spot"],
    category: "Art",
  },
  // Narrative
  {
    title: "Finish the Story",
    description: "Start a story with 'Once there was a child who found a magical...' and let your child finish it. Take turns adding sentences!",
    materials: ["None needed — just imagination"],
    category: "Narrative",
  },
  {
    title: "Sound Story",
    description: "Create a story using only sounds. Make rain sounds with your fingers, thunder with your feet. Then tell the story with words too!",
    materials: ["Hands and feet for making sounds"],
    category: "Narrative",
  },
  // Music
  {
    title: "Kitchen Band",
    description: "Use pots, pans, and utensils to create music. Experiment with different sounds and try to play a simple rhythm together.",
    materials: ["Pots", "Pans", "Wooden spoons"],
    category: "Music",
  },
  // Science
  {
    title: "Sink or Float",
    description: "Fill a bowl with water and collect small household items. Before dropping each one in, ask your child: 'Will it sink or float?'",
    materials: ["Bowl of water", "Small household items (spoon, leaf, coin, cork, etc.)"],
    category: "Science",
  },
  {
    title: "Color Mixing Lab",
    description: "Use food coloring and water to mix colors. Start with primary colors (red, blue, yellow) and discover what happens when you mix them!",
    materials: ["Food coloring", "Clear cups", "Water"],
    category: "Science",
  },
  // Creative (fallback)
  {
    title: "Mystery Box",
    description: "Put a mystery object in a box. Let your child feel it without looking and describe what they notice. Then reveal and discuss!",
    materials: ["Box", "Mystery object"],
    category: "Creative",
  },
  {
    title: "Treasure Map",
    description: "Draw a treasure map of your home together. Hide a small treasure and mark the spot. Take turns making maps and finding treasure!",
    materials: ["Paper", "Crayons", "Small treasure (sticker, coin, etc.)"],
    category: "Creative",
  },
];

interface ChildProfile {
  talents: string[];
  localContext?: string;
}

/**
 * Get recommended home tips for a child based on their talent profile.
 * Returns tips matching the child's primary talent category plus general creative tips.
 */
export function getTipsForChild(profile: ChildProfile): HomeTip[] {
  const primaryTalent = profile.talents[0] ?? "Creative";

  const talentTips = HOME_TIPS_LIBRARY.filter(
    (tip) => tip.category === primaryTalent,
  );

  const creativeTips = HOME_TIPS_LIBRARY.filter(
    (tip) => tip.category === "Creative",
  ).slice(0, 2);

  const allTips = [...talentTips, ...creativeTips];
  const seen = new Set<string>();
  return allTips.filter((tip) => {
    if (seen.has(tip.title)) return false;
    seen.add(tip.title);
    return true;
  });
}

/**
 * Get all tips in the library, optionally filtered by category.
 */
export function getAllTips(category?: string): HomeTip[] {
  if (category) {
    return HOME_TIPS_LIBRARY.filter((tip) => tip.category === category);
  }
  return HOME_TIPS_LIBRARY;
}
