import { describe, it, expect } from "vitest";
import {
  STORY_PROMPT_IMAGES,
  getRandomStoryPrompts,
} from "../story-prompts";

describe("Story Prompt Images", () => {
  it("has at least 9 curated images", () => {
    expect(STORY_PROMPT_IMAGES.length).toBeGreaterThanOrEqual(9);
  });

  it("all images have required fields", () => {
    STORY_PROMPT_IMAGES.forEach((image) => {
      expect(image.id).toBeTruthy();
      expect(image.src).toBeTruthy();
      expect(image.altEn).toBeTruthy();
      expect(image.altId).toBeTruthy();
      expect(image.src).toMatch(/^\/story-prompts\//);
    });
  });

  it("all images have unique IDs", () => {
    const ids = STORY_PROMPT_IMAGES.map((img) => img.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("alt text is meaningful (not just 'image')", () => {
    STORY_PROMPT_IMAGES.forEach((image) => {
      expect(image.altEn.length).toBeGreaterThan(10);
      expect(image.altId.length).toBeGreaterThan(10);
      expect(image.altEn.toLowerCase()).not.toBe("image");
      expect(image.altId.toLowerCase()).not.toBe("image");
    });
  });
});

describe("getRandomStoryPrompts", () => {
  it("returns 3 images by default", () => {
    const result = getRandomStoryPrompts();
    expect(result).toHaveLength(3);
  });

  it("returns requested number of images", () => {
    const result = getRandomStoryPrompts(5);
    expect(result).toHaveLength(5);
  });

  it("does not return more than available images", () => {
    const result = getRandomStoryPrompts(100);
    expect(result).toHaveLength(STORY_PROMPT_IMAGES.length);
  });

  it("returns images with valid structure", () => {
    const result = getRandomStoryPrompts(3);
    result.forEach((image) => {
      expect(image.id).toBeTruthy();
      expect(image.src).toBeTruthy();
      expect(image.altEn).toBeTruthy();
      expect(image.altId).toBeTruthy();
    });
  });

  it("returns unique images (no duplicates)", () => {
    const result = getRandomStoryPrompts(5);
    const ids = result.map((img) => img.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
