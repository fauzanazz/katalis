/**
 * Mock quest generation responses for development and testing.
 *
 * Returns a deterministic 7-day mission plan adapted to the child's dream
 * and local context. Each mission includes title, description, step-by-step
 * instructions, materials needed, and tips.
 *
 * The mock creates progressively complex missions that build on each other,
 * using locally available materials referenced from the child's context.
 */

import type { QuestGenerationOutput } from "../quest-schemas";

/** Default 7-day robotics quest — for a child who dreams of building robots */
const roboticsQuestResponse: QuestGenerationOutput = {
  missions: [
    {
      day: 1,
      title: "Observe and Sketch",
      description:
        "Today you'll become a robot scientist! Look around your home and neighborhood for machines and moving things. Sketch how they work.",
      instructions: [
        "Walk around your home and neighborhood for 15 minutes",
        "Find 3 things that move or have mechanical parts (door hinges, bicycle wheels, water pump)",
        "Sketch each one in your notebook, labeling the parts that move",
        "Write one sentence about how you think each part moves",
      ],
      materials: [
        "Notebook or paper",
        "Pencil or pen",
        "Colored pencils (optional)",
      ],
      tips: [
        "Look at everyday objects — even a door hinge is a mechanical joint!",
        "Don't worry about drawing perfectly. Scientists sketch quickly to capture ideas.",
        "Try to notice things that push, pull, spin, or slide.",
      ],
    },
    {
      day: 2,
      title: "Build a Simple Lever",
      description:
        "Levers are one of the simplest machines and robots use them everywhere! Today you'll build your own lever and test what it can lift.",
      instructions: [
        "Find a strong stick (about 30cm long) and a round object like a stone or can",
        "Place the round object under the middle of the stick to create a seesaw",
        "Put small objects on one end and push down on the other",
        "Move the round object (fulcrum) closer to the heavy end — does it get easier to lift?",
        "Draw your lever in your notebook and label: lever, fulcrum, effort, load",
      ],
      materials: [
        "A strong stick or ruler",
        "A round stone, can, or piece of wood",
        "Small objects to lift (stones, fruit, toys)",
        "Your notebook",
      ],
      tips: [
        "The closer the fulcrum is to the heavy object, the easier it is to lift!",
        "Real robot arms use levers at every joint.",
        "Try different fulcrum positions and compare the effort needed.",
      ],
    },
    {
      day: 3,
      title: "Design a Robot Helper",
      description:
        "Every great robot starts with a design. Today you'll imagine a robot that helps people in your village and draw detailed plans.",
      instructions: [
        "Think about a problem people around you face (carrying water, farming, cleaning)",
        "Imagine a robot that could help solve this problem",
        "Draw your robot from the front and side view",
        "Label each part and explain what it does",
        "Write a short paragraph about how your robot helps people",
      ],
      materials: [
        "Large paper or cardboard for drawing",
        "Colored pencils or markers",
        "Your notebook for writing",
      ],
      tips: [
        "Think about what's needed in your community — the best inventions solve real problems!",
        "Your robot can be any size — from tiny to huge.",
        "Include details like how it moves, what powers it, and how people control it.",
      ],
    },
    {
      day: 4,
      title: "Build a Cardboard Robot Arm",
      description:
        "Time to build! Using cardboard and string, you'll create a working robot arm that can grab things — just like a real robotic gripper.",
      instructions: [
        "Cut 3 strips of cardboard, each about 20cm × 4cm",
        "Poke small holes at the ends of each strip",
        "Connect the strips with string or wire through the holes to make joints",
        "Attach a longer string to the end piece — pulling it should close the 'fingers'",
        "Practice picking up small objects (a ball, a cup, a pencil)",
      ],
      materials: [
        "Cardboard (from old boxes)",
        "String or thin wire",
        "Scissors",
        "A pointed tool to make holes (ask an adult for help!)",
        "Tape",
      ],
      tips: [
        "The strings act like tendons in your hand — they pull to make fingers bend!",
        "If the joints are too stiff, make the holes slightly bigger.",
        "Ask an adult to help with cutting and hole-making.",
      ],
    },
    {
      day: 5,
      title: "Test and Improve",
      description:
        "Real engineers test their inventions and make them better. Today you'll test your robot arm and find ways to improve it.",
      instructions: [
        "Set up 5 different objects of different sizes and weights",
        "Try to pick up each object with your robot arm",
        "Write down which objects you could grab and which ones you couldn't",
        "Think about WHY some objects were harder to grab",
        "Make one improvement to your arm and test again",
        "Compare your results before and after the improvement",
      ],
      materials: [
        "Your robot arm from Day 4",
        "5 different objects to test with",
        "Your notebook",
        "Extra cardboard and string for improvements",
      ],
      tips: [
        "Scientists always test, observe, and improve — this cycle is called iteration!",
        "Even small changes can make a big difference.",
        "Take photos of your tests to remember what worked.",
      ],
    },
    {
      day: 6,
      title: "Build a Simple Moving Machine",
      description:
        "Combine what you've learned to build a vehicle or moving machine using wheels, levers, and your creativity!",
      instructions: [
        "Decide what kind of moving machine you want to build (car, cart, boat, or walker)",
        "Gather materials: bottle caps for wheels, sticks for axles, cardboard for the body",
        "Build the base with wheels that actually spin",
        "Add your robot arm or another moving part to your machine",
        "Test it by pushing it across a flat surface",
        "Decorate your machine and give it a name!",
      ],
      materials: [
        "Bottle caps (4 for wheels)",
        "Thin sticks or skewers for axles",
        "Cardboard for the body",
        "Tape and glue",
        "Scissors",
        "Decorating materials (paint, stickers, leaves)",
      ],
      tips: [
        "Make sure the axle holes are slightly larger than the sticks so wheels can spin freely.",
        "If you don't have bottle caps, you can cut circles from cardboard.",
        "A rubber band can add a simple spring or power source!",
      ],
    },
    {
      day: 7,
      title: "Present Your Creation",
      description:
        "You're a young inventor! Today you'll present everything you've built and learned this week. Share your journey with family and friends.",
      instructions: [
        "Set up a mini exhibition with all your creations from the week",
        "Prepare a short presentation (2-3 minutes) about what you learned",
        "Explain how each creation works using the science terms you learned",
        "Show your favorite invention and explain why you're proud of it",
        "Take a photo of your exhibition to share with the world!",
        "Think about what you want to build next",
      ],
      materials: [
        "All your creations from Days 1-6",
        "Your notebook with sketches and notes",
        "A space to set up your exhibition (table, floor, or outdoor)",
      ],
      tips: [
        "You've accomplished something amazing this week — be proud!",
        "Speaking about your work helps you understand it better.",
        "Ask your audience if they have questions — explaining is the best way to learn.",
        "Remember: every great inventor started just like you!",
      ],
    },
  ],
};

/** Art quest — for a child who dreams of being an artist */
const artQuestResponse: QuestGenerationOutput = {
  missions: [
    {
      day: 1,
      title: "Colors from Nature",
      description:
        "Artists find beauty everywhere! Today you'll discover natural colors in your surroundings and create a color palette from nature.",
      instructions: [
        "Explore outside and collect items of different colors (flowers, leaves, stones, soil)",
        "Arrange your items on paper from lightest to darkest",
        "Try to mix colors using crushed flowers or berries on paper",
        "Name each color you found with a creative name (like 'sunset orange' or 'river blue')",
      ],
      materials: [
        "Paper or cardboard",
        "Natural items (flowers, leaves, berries, soil)",
        "A small cup of water",
        "Your notebook",
      ],
      tips: [
        "Wet leaves can leave different marks than dry ones — try both!",
        "Berries and flowers can be used as natural paints.",
        "Nature has more colors than any art supply store!",
      ],
    },
    {
      day: 2,
      title: "Texture Explorer",
      description:
        "Great art isn't just about sight — it's about touch too! Learn to capture textures using rubbing techniques.",
      instructions: [
        "Find 6 different textured surfaces (tree bark, woven fabric, coins, leaves with veins)",
        "Place paper over each surface and rub gently with a pencil or crayon",
        "Label each rubbing with where you found it",
        "Create a composition using your favorite textures",
      ],
      materials: [
        "Thin paper (newspaper works great)",
        "Pencils, crayons, or charcoal",
        "Tape to hold paper in place",
      ],
      tips: [
        "Press lightly for delicate textures, harder for bold patterns.",
        "Coins and leaves have amazing details you might not notice just by looking.",
        "You can layer different rubbings to create abstract art!",
      ],
    },
    {
      day: 3,
      title: "Light and Shadow Art",
      description:
        "Shadows are nature's drawing tools! Learn how light creates art and make shadow portraits.",
      instructions: [
        "On a sunny day, observe shadows at different times (morning, noon, afternoon)",
        "Trace a friend's or object's shadow on the ground with chalk or sticks",
        "Create a shadow puppet using cardboard and sticks",
        "Put on a short shadow puppet show for your family",
      ],
      materials: [
        "Cardboard",
        "Sticks",
        "Scissors",
        "Chalk (optional)",
        "A flashlight or lamp for indoor shadows",
      ],
      tips: [
        "Morning and evening shadows are longest and most dramatic.",
        "Try making shadows with your hands first — how many animals can you make?",
        "Shadow puppetry is one of the oldest art forms in Indonesia!",
      ],
    },
    {
      day: 4,
      title: "Story Through Art",
      description:
        "Every picture tells a story. Today you'll create a comic strip that tells a story about your life or imagination.",
      instructions: [
        "Think of a short story (something funny that happened, a dream, or an adventure)",
        "Divide your paper into 4-6 boxes (panels)",
        "Draw the story scene by scene, left to right",
        "Add speech bubbles and simple text",
        "Share your comic with someone and see if they understand the story",
      ],
      materials: [
        "Paper",
        "Pencil and eraser",
        "Colored pencils or markers",
        "Ruler (for panel borders)",
      ],
      tips: [
        "Start with stick figures if drawing characters is hard — that's totally okay!",
        "Use big expressions on faces to show emotions.",
        "Sound effects like 'BOOM!' and 'SPLASH!' make comics more fun!",
      ],
    },
    {
      day: 5,
      title: "Sculpture from Found Objects",
      description:
        "Art isn't just 2D! Today you'll build a 3D sculpture using materials you find around you.",
      instructions: [
        "Collect interesting objects: sticks, stones, leaves, bottle caps, old fabric",
        "Plan your sculpture — it could be an animal, a person, an abstract shape, or a building",
        "Build your sculpture using tape, glue, or just balancing",
        "Give your sculpture a title and write a short artist statement",
      ],
      materials: [
        "Found objects (anything interesting!)",
        "Tape, glue, or string",
        "A base (cardboard or flat stone)",
      ],
      tips: [
        "Some of the world's most famous sculptures are made from found objects!",
        "If it falls apart, that's okay — try a different approach.",
        "Take a photo from different angles to see how light changes its look.",
      ],
    },
    {
      day: 6,
      title: "Collaborative Mural",
      description:
        "Art connects people! Create a large artwork with friends or family that tells the story of your community.",
      instructions: [
        "Find a large surface (big paper, cardboard, or use chalk on the ground)",
        "Invite friends or family to join — each person gets a section",
        "Choose a theme together (our village, our dreams, nature around us)",
        "Each person draws their part, connecting with neighbors' sections",
        "Stand back and admire the complete picture!",
      ],
      materials: [
        "Large paper or cardboard (or chalk for outdoor)",
        "Various drawing/painting materials",
        "Friends or family members",
      ],
      tips: [
        "Murals are community art — everyone's contribution matters!",
        "Decide on shared colors or themes so it looks unified.",
        "The best murals tell a story of the people who made them.",
      ],
    },
    {
      day: 7,
      title: "Art Gallery Exhibition",
      description:
        "You're an artist! Display your week's creations in a mini gallery and share your artistic journey.",
      instructions: [
        "Gather all your artworks from the week",
        "Arrange them in order and create labels (title, materials, inspiration)",
        "Set up your gallery in a special place",
        "Invite family and friends to tour your gallery",
        "Talk about each piece — what inspired you and what you learned",
        "Take a photo of your favorite piece for the world to see!",
      ],
      materials: [
        "All artworks from Days 1-6",
        "Paper for labels",
        "Tape or clips to hang work",
        "A display area",
      ],
      tips: [
        "Professional artists always write about their work — your labels are important!",
        "Ask visitors which piece is their favorite and why.",
        "Every artist's journey is unique — yours has just begun!",
      ],
    },
  ],
};

/**
 * Get a mock quest generation response.
 *
 * Returns a deterministic 7-day mission plan. The variant is selected
 * based on simple heuristics from the dream text:
 * - Dreams containing "robot", "build", "engineer", "machine" → robotics quest
 * - All others → art quest (default)
 *
 * Adds artificial delay to simulate real API latency.
 */
export async function getMockQuestGeneration(
  dream: string,
): Promise<QuestGenerationOutput> {
  // Simulate API latency (1500–3000ms for quest generation)
  const delay = 1500 + Math.random() * 1500;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const dreamLower = dream.toLowerCase();
  const engineeringKeywords = ["robot", "build", "engineer", "machine", "mechanic", "invent", "construct"];

  if (engineeringKeywords.some((kw) => dreamLower.includes(kw))) {
    return roboticsQuestResponse;
  }

  return artQuestResponse;
}

/** Exported for direct testing of individual responses */
export const questMockVariants = {
  robotics: roboticsQuestResponse,
  art: artQuestResponse,
} as const;
