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
  {
    title: "Marble Run Builder",
    description: "Create a marble run using cardboard tubes, boxes, and tape. Challenge your child to make the marble travel the longest path possible.",
    materials: ["Cardboard tubes", "Boxes", "Tape", "Marble"],
    category: "Engineering",
  },
  {
    title: "Paper Airplane Contest",
    description: "Fold different paper airplane designs and test which flies the farthest. Discuss why some designs work better than others.",
    materials: ["Paper", "Measuring tape"],
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
  {
    title: "Collage Self-Portrait",
    description: "Cut out pictures from old magazines to create a collage self-portrait. Include things that represent your child's interests and personality.",
    materials: ["Old magazines", "Scissors", "Glue", "Paper"],
    category: "Art",
  },
  {
    title: "Leaf Printing",
    description: "Collect leaves of different shapes. Paint one side and press onto paper to create beautiful natural prints.",
    materials: ["Leaves", "Paint", "Paper", "Brush"],
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
  {
    title: "Comic Strip Creator",
    description: "Fold paper into panels and create a short comic strip. Start with 4 panels showing a beginning, middle, and end.",
    materials: ["Paper", "Pencil", "Markers"],
    category: "Narrative",
  },
  {
    title: "Interview a Family Member",
    description: "Help your child prepare questions and interview a grandparent or relative about their childhood. Record or write down the answers.",
    materials: ["Paper", "Pencil", "Optional: phone for recording"],
    category: "Narrative",
  },
  // Music
  {
    title: "Kitchen Band",
    description: "Use pots, pans, and utensils to create music. Experiment with different sounds and try to play a simple rhythm together.",
    materials: ["Pots", "Pans", "Wooden spoons"],
    category: "Music",
  },
  {
    title: "Water Glass Xylophone",
    description: "Fill glasses with different amounts of water. Tap them with a spoon to create different notes. Can you play a simple tune?",
    materials: ["Glass cups", "Water", "Spoon"],
    category: "Music",
  },
  {
    title: "Nature Sound Walk",
    description: "Take a walk and listen carefully to all the sounds around you. Try to identify and count how many different sounds you hear.",
    materials: ["None needed — just ears and outdoors"],
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
  {
    title: "Kitchen Volcano",
    description: "Create a mini volcano using baking soda and vinegar. Discuss why the reaction happens and try adding food coloring for lava!",
    materials: ["Baking soda", "Vinegar", "Container", "Food coloring"],
    category: "Science",
  },
  {
    title: "Grow a Bean",
    description: "Plant a bean seed in a clear container against the glass so you can watch it grow roots and sprout. Water it daily and observe changes.",
    materials: ["Bean seed", "Clear cup", "Cotton balls or soil", "Water"],
    category: "Science",
  },
  {
    title: "Magnet Explorer",
    description: "Test different objects around the house to discover what sticks to a magnet and what doesn't. Sort them into two groups.",
    materials: ["Magnet", "Various household objects"],
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
  {
    title: "Invention Time",
    description: "Challenge your child to invent something new using only items from the recycling bin. Have them name it and explain how it works.",
    materials: ["Recyclable items", "Tape", "Scissors"],
    category: "Creative",
  },
  {
    title: "Dream Journal",
    description: "Keep a journal by the bed. Each morning, draw or write about any dreams remembered. Look for patterns over time!",
    materials: ["Notebook", "Pencil", "Crayons"],
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
