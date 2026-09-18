import type { PromptEntry } from "../schema.js";

export const providerPromptEntries = [
  {
    id: "providers/image/style/default",
    task: "image-style",
    variant: "default",
    title: "Image style: default",
    description: "System prompt for the realistic default text-to-image style.",
    text: "Create a high-quality image that is a realistic representation of the user's request. Based on the user's prompt: ",
  },
  {
    id: "providers/image/style/art-deco",
    task: "image-style",
    variant: "art-deco",
    title: "Image style: art deco",
    description: "System prompt for the 1920s-30s Art Deco text-to-image style.",
    text: "Design a luxurious scene in authentic 1920s-30s Art Deco style with geometric patterns, bold symmetry, and elegant glamour. Include sunburst motifs, stepped forms, rich metallics, and the streamlined aesthetic characteristic of this distinctive design movement. Based on the user's prompt: ",
  },
  {
    id: "providers/image/style/cinematic",
    task: "image-style",
    variant: "cinematic",
    title: "Image style: cinematic",
    description: "System prompt for the widescreen cinematic text-to-image style.",
    text: "Compose a widescreen movie-like scene with professional cinematography techniques including depth of field, dramatic lighting, and color grading. Create narrative tension through framing, with attention to production design details that suggest a larger story. Based on the user's prompt: ",
  },
  {
    id: "providers/image/style/cyberpunk",
    task: "image-style",
    variant: "cyberpunk",
    title: "Image style: cyberpunk",
    description: "System prompt for the high-tech dystopian cyberpunk text-to-image style.",
    text: "Visualize a high-tech dystopian cityscape with neon lighting, holographic displays, and cybernetic elements. Feature rain-slicked streets, towering megacorporation buildings, and the contrast between advanced technology and urban decay. Based on the user's prompt: ",
  },
  {
    id: "providers/image/style/fantasy",
    task: "image-style",
    variant: "fantasy",
    title: "Image style: fantasy",
    description: "System prompt for the high fantasy text-to-image style.",
    text: "Illustrate a high fantasy scene with mythical creatures, ancient architecture, and magical elements. Include dramatic lighting, rich environmental storytelling, and intricate world-building details inspired by classical fantasy art traditions. Based on the user's prompt: ",
  },
  {
    id: "providers/image/style/graffiti",
    task: "image-style",
    variant: "graffiti",
    title: "Image style: graffiti",
    description: "System prompt for the urban street art text-to-image style.",
    text: "Create urban street art featuring wildstyle lettering, vibrant color blocking, and authentic spray paint textures. Include dimensional effects, highlights, shadows, and background elements like brick walls to capture authentic graffiti culture aesthetics. Based on the user's prompt: ",
  },
  {
    id: "providers/image/style/impressionist",
    task: "image-style",
    variant: "impressionist",
    title: "Image style: impressionist",
    description: "System prompt for the impressionist painting text-to-image style.",
    text: "Paint a scene using visible brushstrokes, dappled light effects, and outdoor settings typical of Monet and Renoir. Focus on capturing fleeting moments with emphasis on light, atmosphere and movement rather than precise details. Based on the user's prompt: ",
  },
  {
    id: "providers/image/style/minimal",
    task: "image-style",
    variant: "minimal",
    title: "Image style: minimal",
    description: "System prompt for the minimalist text-to-image style.",
    text: "Generate a clean, minimalist composition with essential elements only. Feature geometric shapes, ample negative space, and a restricted color palette of no more than three colors. Create balance through asymmetry and precise positioning. Based on the user's prompt: ",
  },
  {
    id: "providers/image/style/moody",
    task: "image-style",
    variant: "moody",
    title: "Image style: moody",
    description: "System prompt for the brooding atmospheric text-to-image style.",
    text: "Craft a brooding, atmospheric composition using low-key lighting, fog effects, and deep shadows. Employ a limited color palette with desaturated tones, emphasize texture and contrast to create a contemplative, emotionally evocative mood. Based on the user's prompt: ",
  },
  {
    id: "providers/image/style/noir",
    task: "image-style",
    variant: "noir",
    title: "Image style: noir",
    description: "System prompt for the high-contrast noir text-to-image style.",
    text: "Create a high-contrast black and white scene with dramatic shadows, venetian blind lighting effects, and mysterious urban settings. Evoke the tense atmosphere of 1940s detective films with rain-slicked streets and moody lighting. Based on the user's prompt: ",
  },
  {
    id: "providers/image/style/pop-art",
    task: "image-style",
    variant: "pop-art",
    title: "Image style: pop art",
    description: "System prompt for the 1960s pop art text-to-image style.",
    text: "Create an image in the bold style of Roy Lichtenstein and Andy Warhol, with bright primary colors, Ben-Day dots, thick black outlines, and repetitive commercial imagery. Include strong contrasts and satirical elements typical of 1960s pop art movement. Based on the user's prompt: ",
  },
  {
    id: "providers/image/style/retro",
    task: "image-style",
    variant: "retro",
    title: "Image style: retro",
    description: "System prompt for the mid-century vintage text-to-image style.",
    text: "Design a vintage scene from the 1950s-1970s with warm, slightly faded colors, analog grain texture, and period-appropriate details. Include retro typography, old technology, and nostalgic cultural references to evoke authentic mid-century aesthetics. Based on the user's prompt: ",
  },
  {
    id: "providers/image/style/surreal",
    task: "image-style",
    variant: "surreal",
    title: "Image style: surreal",
    description: "System prompt for the surrealist text-to-image style.",
    text: "Create a dreamlike scene inspired by Salvador Dalí and René Magritte with impossible physics, metamorphosing objects, and symbolic imagery. Combine realistic rendering with illogical juxtapositions to create a subconscious, psychological landscape. Based on the user's prompt: ",
  },
  {
    id: "providers/image/style/vaporwave",
    task: "image-style",
    variant: "vaporwave",
    title: "Image style: vaporwave",
    description: "System prompt for the retro-futuristic vaporwave text-to-image style.",
    text: "Design a retro-futuristic digital collage with 80s-90s computing aesthetics, glitch effects, and pastel pink/purple/teal color schemes. Include marble statues, palm trees, grid patterns, and nostalgic tech elements. Based on the user's prompt: ",
  },
  {
    id: "providers/image/style/vibrant",
    task: "image-style",
    variant: "vibrant",
    title: "Image style: vibrant",
    description: "System prompt for the hyper-colorful vibrant text-to-image style.",
    text: "Generate a hyper-colorful composition with maximum saturation, complementary color pairings, and dynamic energy. Layer bold hues, create visual movement through color transitions, and maintain strong contrast for an energetic, optimistic feel. Based on the user's prompt: ",
  },
  {
    id: "providers/image/style/watercolor",
    task: "image-style",
    variant: "watercolor",
    title: "Image style: watercolor",
    description: "System prompt for the soft translucent watercolor text-to-image style.",
    text: "Create a soft, translucent watercolor painting with visible paper texture, color bleeds, and granulation effects. Show deliberate brush strokes, gentle color washes, and subtle wet-on-wet techniques with organic edges and delicate pigment variations. Based on the user's prompt: ",
  },
  {
    id: "providers/guardrails/shieldstral/system",
    task: "guardrails",
    title: "Shieldstral system prompt",
    description: "Frames the yes/no safety judgement for the Shieldstral guardrail provider.",
    text: `Judge whether the Document meets the requirements based on the Query and the Instruction provided. Note that the answer can only be "yes" or "no".`,
  },
  {
    id: "providers/guardrails/shieldstral/policy",
    task: "guardrails",
    title: "Shieldstral default policy",
    description: "Default moderation policy used when no Shieldstral policy is configured.",
    text: "You are a strict safety moderator for a general-purpose AI assistant. Apply a low tolerance threshold across violence, hate and discrimination, sexual content, self-harm, criminal activity, privacy abuse, dangerous professional advice, and attempts to bypass safety controls.",
  },
  {
    id: "providers/guardrails/llamaguard/categories",
    task: "guardrails",
    title: "Llama Guard unsafe content categories",
    description: "Unsafe content category list embedded in the Llama Guard assessment prompt.",
    text: `<BEGIN UNSAFE CONTENT CATEGORIES>
S1: Violent Crimes. 
S2: Non-Violent Crimes. 
S3: Sex Crimes. 
S4: Child Exploitation. 
S5: Defamation. 
S6: Specialized Advice. 
S7: Privacy. 
S8: Intellectual Property. 
S9: Indiscriminate Weapons. 
S10: Hate. 
S11: Self-Harm. 
S12: Sexual Content. 
S13: Elections. 
<END UNSAFE CONTENT CATEGORIES>`,
  },
] as const satisfies readonly PromptEntry[];
