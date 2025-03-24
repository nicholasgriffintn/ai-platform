export const imagePrompts = {
  default: {
    prompt:
      "Create a high-quality image that is a realistic representation of the user's request. Based on the user's prompt: ",
  },
  "art-deco": {
    prompt:
      "Design a luxurious scene in authentic 1920s-30s Art Deco style with geometric patterns, bold symmetry, and elegant glamour. Include sunburst motifs, stepped forms, rich metallics, and the streamlined aesthetic characteristic of this distinctive design movement. Based on the user's prompt: ",
  },
  cinematic: {
    prompt:
      "Compose a widescreen movie-like scene with professional cinematography techniques including depth of field, dramatic lighting, and color grading. Create narrative tension through framing, with attention to production design details that suggest a larger story. Based on the user's prompt: ",
  },
  cyberpunk: {
    prompt:
      "Visualize a high-tech dystopian cityscape with neon lighting, holographic displays, and cybernetic elements. Feature rain-slicked streets, towering megacorporation buildings, and the contrast between advanced technology and urban decay. Based on the user's prompt: ",
  },
  fantasy: {
    prompt:
      "Illustrate a high fantasy scene with mythical creatures, ancient architecture, and magical elements. Include dramatic lighting, rich environmental storytelling, and intricate world-building details inspired by classical fantasy art traditions. Based on the user's prompt: ",
  },
  graffiti: {
    prompt:
      "Create urban street art featuring wildstyle lettering, vibrant color blocking, and authentic spray paint textures. Include dimensional effects, highlights, shadows, and background elements like brick walls to capture authentic graffiti culture aesthetics. Based on the user's prompt: ",
  },
  impressionist: {
    prompt:
      "Paint a scene using visible brushstrokes, dappled light effects, and outdoor settings typical of Monet and Renoir. Focus on capturing fleeting moments with emphasis on light, atmosphere and movement rather than precise details. Based on the user's prompt: ",
  },
  minimal: {
    prompt:
      "Generate a clean, minimalist composition with essential elements only. Feature geometric shapes, ample negative space, and a restricted color palette of no more than three colors. Create balance through asymmetry and precise positioning. Based on the user's prompt: ",
  },
  moody: {
    prompt:
      "Craft a brooding, atmospheric composition using low-key lighting, fog effects, and deep shadows. Employ a limited color palette with desaturated tones, emphasize texture and contrast to create a contemplative, emotionally evocative mood. Based on the user's prompt: ",
  },
  noir: {
    prompt:
      "Create a high-contrast black and white scene with dramatic shadows, venetian blind lighting effects, and mysterious urban settings. Evoke the tense atmosphere of 1940s detective films with rain-slicked streets and moody lighting. Based on the user's prompt: ",
  },
  "pop-art": {
    prompt:
      "Create an image in the bold style of Roy Lichtenstein and Andy Warhol, with bright primary colors, Ben-Day dots, thick black outlines, and repetitive commercial imagery. Include strong contrasts and satirical elements typical of 1960s pop art movement. Based on the user's prompt: ",
  },
  retro: {
    prompt:
      "Design a vintage scene from the 1950s-1970s with warm, slightly faded colors, analog grain texture, and period-appropriate details. Include retro typography, old technology, and nostalgic cultural references to evoke authentic mid-century aesthetics. Based on the user's prompt: ",
  },
  surreal: {
    prompt:
      "Create a dreamlike scene inspired by Salvador Dalí and René Magritte with impossible physics, metamorphosing objects, and symbolic imagery. Combine realistic rendering with illogical juxtapositions to create a subconscious, psychological landscape. Based on the user's prompt: ",
  },
  vaporwave: {
    prompt:
      "Design a retro-futuristic digital collage with 80s-90s computing aesthetics, glitch effects, and pastel pink/purple/teal color schemes. Include marble statues, palm trees, grid patterns, and nostalgic tech elements. Based on the user's prompt: ",
  },
  vibrant: {
    prompt:
      "Generate a hyper-colorful composition with maximum saturation, complementary color pairings, and dynamic energy. Layer bold hues, create visual movement through color transitions, and maintain strong contrast for an energetic, optimistic feel. Based on the user's prompt: ",
  },
  watercolor: {
    prompt:
      "Create a soft, translucent watercolor painting with visible paper texture, color bleeds, and granulation effects. Show deliberate brush strokes, gentle color washes, and subtle wet-on-wet techniques with organic edges and delicate pigment variations. Based on the user's prompt: ",
  },
};

export function getTextToImageSystemPrompt(
  style: keyof typeof imagePrompts,
): string {
  return imagePrompts[style]?.prompt || imagePrompts.default.prompt;
}
