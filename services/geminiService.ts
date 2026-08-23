import {
  GoogleGenAI,
  GenerateContentResponse,
  Type,
  Modality,
} from "@google/genai";
import {
  UploadedFile,
  StyleAnalysis,
  BackgroundMode,
  AspectRatio,
  FrameStyle,
  ImageResolution,
  ShapeType,
  TextPosition,
  FontCategory,
  RemixMode,
  TextSuggestionTone,
  FontModeOption,
} from "../types.ts";
import {
  STRICT_STYLE_RULES,
  ANALYSIS_PROMPT,
  IDENTITY_PARITY_PROTOCOL,
  STYLE_MASTER_PROTOCOL,
  SCENE_INTEGRITY_RULES,
  STRICT_STORY_COMPLIANCE_PROTOCOL,
  TYPOGRAPHIC_PARITY_PROTOCOL,
  ICON_REPLICATION_PROTOCOL,
} from "../constants.ts";

export const ensureApiKey = async (): Promise<boolean> => {
  try {
    if (window.aistudio && window.aistudio.hasSelectedApiKey) {
      // Add a timeout to prevent hanging if the iframe connection is lost
      const hasKeyPromise = window.aistudio.hasSelectedApiKey();
      const timeoutPromise = new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout checking API key")), 3000),
      );

      const hasKey = await Promise.race([hasKeyPromise, timeoutPromise]);

      if (!hasKey) {
        if (window.aistudio.openSelectKey) {
          try {
            await window.aistudio.openSelectKey();
            return true;
          } catch (e) {
            console.error("Failed to open select key dialog:", e);
            return true; // Assume true to let the API call fail gracefully
          }
        }
        return true; // Assume true if we can't open the dialog
      }
      return true;
    }
    return true;
  } catch (error: any) {
    console.warn("Error checking API key status:", error);
    // If it's a timeout, the iframe connection might be lost.
    // Don't try to open the dialog, just return true and let the API call fail.
    if (error.message === "Timeout checking API key") {
      return true;
    }
    try {
      if (window.aistudio && window.aistudio.openSelectKey) {
        await window.aistudio.openSelectKey();
        return true;
      }
    } catch (e) {
      console.error("Failed to open select key dialog:", e);
    }
    return true; // Always return true on error to prevent blocking the UI
  }
};

const getClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 4,
  initialDelayMs: number = 1000,
): Promise<T> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      const errorMsg = error?.message || "";
      if (errorMsg.includes("Requested entity was not found")) {
        if (window.aistudio?.openSelectKey) {
          console.warn(
            "API key not found or expired. Prompting user to select a key...",
          );
          await window.aistudio.openSelectKey();
          // After the user selects a key, retry the API call immediately
          if (attempt < maxRetries) {
            attempt++;
            continue;
          }
        }
        throw error;
      }
      const isRetryable =
        errorMsg.includes("503") ||
        errorMsg.includes("429") ||
        errorMsg.includes("overloaded") ||
        errorMsg.includes("UNAVAILABLE");
      if (isRetryable && attempt < maxRetries) {
        const delay = initialDelayMs * Math.pow(2, attempt);
        console.warn(
          `Model overloaded. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt++;
        continue;
      }
      throw error;
    }
  }
  throw new Error(
    "Maximum retries exceeded. The model is currently under heavy load.",
  );
}

export const analyzeStyle = async (
  files: UploadedFile[],
): Promise<StyleAnalysis> => {
  return callWithRetry(async () => {
    const ai = getClient();
    const styleInfluencers = files.filter((f) => f.isStyleInfluence);
    let prioritized: UploadedFile[] = [];
    if (styleInfluencers.length > 0) {
      prioritized = styleInfluencers.slice(0, 3);
    } else {
      prioritized = [
        ...files.filter((f) => f.category === "font"),
        ...files.filter((f) => f.category === "scene"),
        ...files.filter((f) => f.category === "icon"),
        ...files.filter((f) => f.category === "character").slice(0, 2),
      ].slice(0, 3);
    }

    const parts: any[] = prioritized.map((f) => ({
      inlineData: { mimeType: f.mimeType, data: f.data },
    }));
    parts.push({ text: ANALYSIS_PROMPT });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: parts },
      config: { responseMimeType: "application/json" },
    });
    return JSON.parse(response.text || "{}");
  });
};

export const describeBaseImage = async (
  file: UploadedFile,
): Promise<string> => {
  return callWithRetry(async () => {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: file.mimeType, data: file.data } },
          {
            text: "Describe the subjects, composition, and core visual elements of this image in a single paragraph.",
          },
        ],
      },
    });
    return response.text || "";
  });
};

export const generateSequelStoryAndCharacters = async (
  manuscriptFile: File,
  influenceStory?: string,
  pageCountOverride?: number | null,
): Promise<{ story: string; pageCount?: number; characters: { name: string; description: string }[] }> => {
  return callWithRetry(async () => {
    const ai = getClient();
    const parts: any[] = [];

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(manuscriptFile);
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = (error) => reject(error);
    });
    parts.push({
      inlineData: {
        mimeType: manuscriptFile.type || "text/plain",
        data: base64,
      },
    });

    let instruction = `CRITICAL INSTRUCTIONS FOR SEQUEL GENERATION:
1. Analyze the provided original manuscript document carefully.
2. You MUST write a completely NEW, INNOVATIVE, and ORIGINAL sequel story. Do NOT just copy or retell the original plot. The new plot should explore new problems, new adventures, or new character arcs, pushing the story forward creatively and addressing logical progression.
3. While the PLOT must be new and highly innovative, the storytelling style, tone, logic, and pacing MUST match the original perfectly. Ensure the story flows naturally and makes logical sense.
4. Characters MUST remain consistent in their core personalities, motivations, and descriptions. Their agendas and problems must be clear, logical, and well-developed. Do not arbitrarily change their behavior.
5. STORYTELLING DEPTH: You must write highly detailed scene descriptions and narration. Explain context thoroughly. Avoid brief, sudden, or ambiguous lines (e.g., do not just write "Out you go!" without explaining who or what is going out and why). Ensure that actions, objects, and motivations in the narration are fully explained so the reader never lacks context.
6. SCENE TRANSITIONS & PROP CONSISTENCY (CRITICAL): Ensure smooth physical transitions between scenes. If a character is in a different position in the next scene (e.g., floating then standing), the text MUST explicitly describe the transition (e.g., "Landing softly..."). Additionally, if a character uses an item or prop later in the story (e.g., treats, tools from a pocket), you MUST explicitly mention them packing, carrying, or checking that item in an early scene.
7. If the user provides an 'Influence Story' direction, you MUST follow it. If none is provided, invent a highly creative, logical, and compelling sequel yourself.
8. ${pageCountOverride ? `The sequel MUST have EXACTLY ${pageCountOverride} scenes/pages. Format your story text with clear scene markers or distinct paragraphs.` : `Count the number of distinct scenes or pages in the original story (excluding the front and back covers). The sequel MUST have the exact same number of scenes/pages. Format your story text with clear scene markers if the original used them, or distinct paragraphs.`}
9. CHARACTER EXTRACTION (MANDATORY): You MUST extract the character designs from the original story (and any new characters you invent for the sequel) and provide a detailed visual description for each in the 'characters' JSON array. DO NOT leave the 'characters' array empty. This is required to generate character reference images.

Respond EXACTLY in this JSON format:
{
  "story": "The full sequential sequel story text here...",
  "pageCount": 8,
  "characters": [
    { "name": "Character Name", "description": "Detailed visual description of the character for an AI image generator (e.g. A young boy with messy brown hair, wearing a red jacket...)" }
  ]
}`;

    if (influenceStory) {
      instruction += `\n\nUSER'S INFLUENCE STORY DIRECTION:\n${influenceStory}`;
    }

    parts.push({ text: instruction });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: { parts: parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            story: { type: Type.STRING },
            pageCount: { type: Type.INTEGER },
            characters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ["name", "description"]
              },
            },
          },
          required: ["story", "pageCount", "characters"]
        },
      },
    });
    const parsed = JSON.parse(response.text || "{}");
    return {
      story: parsed.story?.replace(/\\n/g, '\n') || "",
      pageCount: parsed.pageCount,
      characters: parsed.characters || [],
    };
  });
};
export const generateSequelIdeas = async (
  manuscriptFile: File,
  authorStyle?: string,
): Promise<string[]> => {
  return callWithRetry(async () => {
    const ai = getClient();
    const parts: any[] = [];

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(manuscriptFile);
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = (error) => reject(error);
    });
    parts.push({
      inlineData: {
        mimeType: manuscriptFile.type || "text/plain",
        data: base64,
      },
    });

    let instruction = `Analyze the provided manuscript document. Generate exactly 5 distinct, compelling sequel ideas based on the story, characters, and world established in the manuscript. Return the ideas as a JSON array of strings. Each string should be a concise paragraph describing the plot of the sequel.`;

    if (authorStyle) {
      instruction += `\nWRITING STYLE MANDATE: Emulate the writing style, tone, and narrative voice of ${authorStyle} when describing these sequel ideas.`;
    }

    parts.push({ text: instruction });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: { parts: parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    });
    const parsedOptions = JSON.parse(response.text || "[]");
    return parsedOptions.map((opt: string) => opt.replace(/\\n/g, '\n').replace(/\n{3,}/g, '\n\n'));
  });
};

export const generateSeriesName = async (
  prompts: string[],
): Promise<string> => {
  return callWithRetry(async () => {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a short, catchy, and descriptive title (2-5 words) for a series of art prompts based on the following prompts:\n\n${prompts.join("\n")}`,
      config: {
        systemInstruction:
          "You are an expert at summarizing themes into short, catchy titles. Return ONLY the title, no quotes, no extra text.",
      },
    });
    return (
      response.text?.trim().replace(/^["']|["']$/g, "") || "Untitled Series"
    );
  });
};

export const generateMagicRoll = async (
  keywords: string,
  charRefs: UploadedFile[],
  count: number = 10,
  storyMode: boolean = false,
  useStagingCharacter: boolean = false,
  authorStyle?: string,
  manuscriptFile?: File | null,
  followInputs: boolean = false,
  hasStyleMaster: boolean = false,
  includeCovers: boolean = false,
  bookTitle: string = "",
  authorName: string = "",
): Promise<string[]> => {
  return callWithRetry(async () => {
    const ai = getClient();
    const parts: any[] = [];

    // Tag restriction logic: Strictly controlled by useStagingCharacter
    const availableCharIndices = Array.from(
      new Set(charRefs.map((f) => f.charIndex ?? 0)),
    );
    let tagRestriction =
      useStagingCharacter && availableCharIndices.length > 0
        ? `ONLY use character tags from this list: [${availableCharIndices
            .map((i) => {
              const charFile = charRefs.find((f) => f.charIndex === i);
              return `@${charFile?.characterName || `C${i + 1}`}`;
            })
            .join(", ")}]. This forces the specific character identity.`
        : `STRICT NEGATIVE CONSTRAINT: DO NOT use any character tags like @C1, @C2, etc. Describe the new subjects as separate, distinct entities based on the user's keywords.`;

    if (useStagingCharacter && availableCharIndices.length > 0) {
      const scaleInfo = availableCharIndices
        .map((idx) => {
          const charViews = charRefs.filter((c) => c.charIndex === idx);
          const charName = charViews[0]?.characterName || `C${idx + 1}`;
          const ratio = parseFloat(String(charViews[0]?.heightRatio)) || 1.0;
          if (idx === 0) return `@${charName} (base size)`;
          return `@${charName} (${ratio}x the height of @${charRefs.find((c) => c.charIndex === 0)?.characterName || "C1"})`;
        })
        .join(", ");
      tagRestriction += `\n         CRITICAL SCALE INFO: When describing interactions between characters, explicitly mention their relative sizes in the prompt to enforce scale (e.g., "The massive @C2 towers over the tiny @C1", based on these scales: ${scaleInfo}).`;
    }

    // Visual state & Anthropomorphism logic
    const behaviorMandate = `
      *** BEHAVIOR & FORM MANDATE ***
      1. ACTION & POSING: Describe the subjects' actions and poses exactly as requested in the user's keywords. If the keywords describe dynamic actions (dancing, walking, performing), the subjects MUST be described performing those actions.
      ${useStagingCharacter ? `2. CONSISTENT ANATOMY: Analyze the provided character images. Any new characters you create MUST visually match the anatomical style (e.g., animal-like, stylized) of the provided characters. DO NOT use the word "anthropomorphic" or "humanoid" in your generated prompts unless the user's keywords explicitly use them.` : `2. CONSISTENT ANATOMY: Ignored (Use Main Ref is OFF).`}
      3. SCALE & PLACEMENT: Focus on descriptions of form, material, and placement within the frame.
      4. MANDATORY EMOTION & BODY LANGUAGE: You MUST explicitly describe the facial expressions, moods, and body language of every character in every scene. These expressions must match the tone and actions described in the user's keywords.
      5. NO HALLUCINATIONS: Do NOT invent sci-fi, cyberpunk, fantasy, or other genres unless the user explicitly asks for them. If the user asks for "kpop idols", generate "kpop idols" doing the requested actions.
      6. CAMERA & CHARACTER FACING (CRITICAL): You MUST explicitly describe the camera angle and the exact direction characters are facing to make sense for an image renderer. For example, if a scene has an audience watching an actor on stage, describe the camera as "viewed from behind the audience" or "over-the-shoulder shot" and state that the audience is "facing away from the camera, looking at the stage." Do NOT have characters unnaturally facing the camera (e.g., to show their startled expressions) if the scene logic dictates they should be looking at someone or something else.
    `;

    const styleRefs = charRefs.slice(0, 3);
    if (styleRefs.length > 0) {
      if (useStagingCharacter) {
        parts.push({
          text: "*** CHARACTER & STYLE REFERENCE IMAGES ***\nYou MUST analyze these images to determine the art style, character proportions, and color palette. CRITICAL: Because Use Main Ref is ON, you MUST also deeply analyze the physical appearance, hairstyle, gender, and core features of EACH character shown so you can describe them exactly in the prompts.",
        });
        // Pass one image per unique character to ensure the model sees all of them
        const uniqueChars = Array.from(
          new Set(charRefs.map((f) => f.charIndex ?? 0)),
        );
        uniqueChars.forEach((idx) => {
          const charFile = charRefs.find((f) => f.charIndex === idx);
          if (charFile) {
            parts.push({
              text: `Character @${charFile.characterName || `C${idx + 1}`}:`,
            });
            parts.push({
              inlineData: { mimeType: charFile.mimeType, data: charFile.data },
            });
          }
        });
      } else {
        parts.push({
          text: "*** STYLE, PROPORTION, AND COLOR REFERENCE IMAGES ***\nYou MUST deeply analyze these images to determine the exact art style, character design characteristics, facial feature styles (e.g., beady eyes, large anime eyes, simple dots), line weight, character proportions, and color palette. You MUST incorporate these specific stylistic details into your generated prompts to ensure the new characters match the exact aesthetic of the references.",
        });
        styleRefs.forEach((file) => {
          parts.push({
            inlineData: { mimeType: file.mimeType, data: file.data },
          });
        });
      }
    }

    const ipRestriction = useStagingCharacter
      ? `\n         COPYRIGHT & IP PROTECTION & CHARACTER FIDELITY (CRITICAL): 
         1. Do not name specific real-world celebrities or copyrighted characters unless requested.
         2. You MUST strictly analyze and describe the exact physical appearance, hairstyle, and core features of the characters shown in the reference images (using their tags like @C1, @C2).
         3. DO NOT invent new appearances, different hairstyles, or different genders for the Staging Area characters. They must look EXACTLY like their reference images in every prompt.`
      : `\n         COPYRIGHT & IP PROTECTION & CHARACTER DIVERSITY (CRITICAL): 
         1. DO NOT use the literal phrase "generic unnamed person" or "generic unnamed character". Use the EXACT subject from the user's prompt (e.g., "kpop idols").
         2. DO NOT copy the hairstyle, clothing, or specific appearance of any characters shown in the reference images. 
         3. You MUST invent completely new, diverse appearances for the characters. Explicitly describe their varied hairstyles (e.g., short spiky hair, long flowing hair, ponytails) and distinct clothing to ensure they DO NOT look like the reference images and DO NOT look like clones of each other. Ensure you strictly follow the gender and demographic mix requested by the user (e.g., if they ask for boys and girls, include both). Just do not name specific real-world celebrities unless requested.`;

    const masterPromptMandate = `
         *** CORE SUBJECT MANDATE (CRITICAL) ***
         You MUST use the EXACT subjects, characters, demographics, and settings described in the user's keywords. 
         If the user asks for "boys and girls", you MUST include BOTH boys and girls in your prompts. Do not omit any requested groups.
         If the user asks for "kpop idols", you MUST generate prompts about "kpop idols".
         DO NOT invent random genres (like sci-fi, cyberpunk, fantasy) unless the user explicitly asked for them.
         DO NOT change the subject to robots, astronauts, or explorers unless the user asked for them.
         Your generated prompts must be direct variations of the user's master prompt.
    `;

    const precisionMandate = `
      *** PRECISION & CHARACTER STRICTNESS MANDATE (CRITICAL) ***
      You MUST be extremely precise and explicitly detail the following in EVERY prompt:
      1. EXACT ART STYLE BLENDING PROTOCOL:
         ${
           hasStyleMaster
             ? `- A Global Style Master IS ON. You MUST unify ALL characters under ONE consistent art style matching the designated Style Master's aesthetics.`
             : `- NO Global Style Master is set. IF the user's keywords explicitly request a specific art style (e.g., "drawn in watercolor"), you MUST unify all characters under that requested art style. OTHERWISE, if the user's keywords DO NOT dictate a specific art style, you MUST describe each character in their respective original art style, color tones, and rendering styles in the prompt (e.g., "A 3D character next to an anime character"). DO NOT blend them unless requested in the keywords.`
         }
      2. ENVIRONMENT ISOLATION: Do NOT import any environment, background or setting from either of the character references into the new render. Only use the environment from the user prompt.
      3. FACE PRESERVATION: Do NOT change the face or facial features of the character references. DO NOT over-describe or hallucinate physical features. Rely strictly on the visual reference without adding interpretative adjectives (like "anthropomorphic", "humanoid", or extra facial details) unless they are explicitly in the user's keywords. Just follow the reference image.
      4. CHARACTER NAMING (CRITICAL): When naming the characters in the text, DO NOT include the '@' symbol (e.g. use "Fox" instead of "@Fox", or "C1" instead of "@C1"). The '@' is only used for internal referencing.
      5. The exact number of characters. (CRITICAL: Do NOT arbitrarily limit to 2 characters. If the user asks for a group or doesn't specify a number, vary the character count across the prompts—e.g., 1, 3, 4, or large groups. If Use Main Ref is ON, you must include all Staging Area characters).
      6. The specific gender of each character.
      7. Detailed clothing, description, hairstyle, and accessories for EACH character.
      8. The specific facial expression and activity of EACH character. (CRITICAL: You MUST describe the EXACT eye style and facial features from the reference, e.g., "simple dot eyes", "beady eyes", "minimal facial lines", but do NOT alter the face structure. DO NOT default to "expressive anime eyes" or "detailed eyes" unless they actually exist in the reference).
      9. How EACH character interacts with the other characters and their environment.
      10. A detailed description of the environment and the scene.
      
      *** CHIBI REPETITION RULE ***
      If it is established that the art style is "chibi" (either requested by the user or detected from references), you MUST repeat the word "chibi" when describing EVERY SINGLE character (e.g., "a chibi kpop female star", "a chibi male idol").
      
      *** NO EXTRA CHARACTERS RULE ***
      STRICT NEGATIVE CONSTRAINT: Explicitly state "No extra characters, only the characters described" in every prompt to ensure no unprompted characters are rendered. There should be no characters rendered that are not in the prompt!

      *** FORMATTING & PARAGRAPHING (CRITICAL) ***
      To ensure the generated prompts are easy for the user to read and edit, you MUST separate the different portions of each prompt into distinct paragraphs. 
      Use ACTUAL NEWLINES (e.g., \\n\\n in JSON) to separate paragraphs. DO NOT output a single massive wall of text.
      For example, use one paragraph for the overall art style and setting, a new paragraph for character 1's description and actions, a new paragraph for character 2, and a final paragraph for any text overlays or formatting rules.
    `;

    const isColoringPage =
      /coloring page|line art|black and white|outline|sketch|monochrome/i.test(
        keywords,
      );
    const styleAndColorMandate = `
      *** ART STYLE, PROPORTION & COLOR PARITY MANDATE (CRITICAL) ***
      1. Analyze the provided reference images (if any).
      2. PROPORTIONS, FACIAL FEATURES & STYLE: Deeply analyze the drawing style of the characters in the references. 
         - FACIAL FEATURES (CRITICAL): You MUST accurately describe the eyes and face. If the reference image has simple dot eyes, beady eyes, or minimal facial lines, you MUST explicitly write "simple dot eyes", "beady eyes", or "minimal facial features". DO NOT hallucinate "expressive anime eyes" or "detailed eyes" if the reference has simple dots. Defaulting to generic anime eyes when the reference has simple dots is a strict failure.
         - Determine if they are "chibi" (exaggerated big heads, small bodies) or "mature/standard". 
         - If the references are mature/standard, YOU MUST NOT use the word "chibi" in your prompts. Describe them as standard characters.
         - If the references are chibi, explicitly use the word "chibi".
         - If the references are anime style, explicitly state "anime style".
         - Incorporate these exact stylistic descriptions into EVERY generated prompt so the new characters match the aesthetic of the references.
         ${
           hasStyleMaster
             ? `- CRITICAL STYLE MASTER OVERRIDE: Since a Style Master is present, you MUST unify all the characters under ONE style. Do NOT let them have separate art styles.`
             : `- CRITICAL STYLE INSTRUCTION: Since no Style Master is present, if the user explicitly specifies an art style in the keywords, unify the characters under THAT art style. If NO art style is specified by the user and different characters have different art styles (e.g. 3D and 2D), DO NOT unify them. Explicitly describe each character's distinct art style in every prompt!`
         }
      3. COLOR VS LINE ART: Determine if the reference images are "black and white line art / coloring page" or "full color".
         - If black and white line art (or if the user's keywords ask for a coloring page): EVERY generated prompt MUST explicitly state "black and white outline, line art, coloring page". YOU MUST STRICTLY AVOID ANY COLOR WORDS (e.g., do NOT use "blonde", "red", "blue", "colorful", "dark", "light"). Describe clothing and hair using textures, patterns, and lengths instead of colors.
         - If full color: The generated prompts MUST explicitly state "full color" and you may use color descriptions.
      4. If no references are provided, default to the style implied by the user's keywords.
      ${isColoringPage ? `\n      5. COLOR EXCLUSION OVERRIDE: The user explicitly requested a coloring page/line art. YOU MUST NOT INCLUDE ANY COLOR WORDS. There should strictly be no color, ${storyMode ? "" : "no text, "}no frame, no names, no intricate patterns. Do not describe color in the prompts, such as pink hair, blue sky, yellow shirt. Do not shade or color the illustrations with black or grey.` : ""}
    `;

    const frameMandate = `
      *** FRAME & BORDER MANDATE ***
      1. DO NOT include frames, borders, or polaroid edges in the generated prompts UNLESS the user's keywords explicitly ask for them.
      2. If the user did not ask for frames, the prompt must explicitly state "no frames, no borders, image fills the entire canvas".
    `;

    const watermarkMandate = storyMode
      ? `
      *** WATERMARK & SIGNATURE BAN ***
      1. EVERY generated prompt MUST explicitly include the phrase "no signatures, no watermarks, no artist names".
      2. If the reference images are black and white line art, or if the user asks for a coloring page, the phrase MUST be "no signatures, no watermarks, no artist names, no stipling".
    `
      : `
      *** WATERMARK & SIGNATURE BAN ***
      1. EVERY generated prompt MUST explicitly include the phrase "no signatures, no watermarks, no artist names, no text".
      2. If the reference images are black and white line art, or if the user asks for a coloring page, the phrase MUST be "no signatures, no watermarks, no artist names, no text, no stipling".
    `;

    let singleImageInstruction = useStagingCharacter
      ? `*** SINGLE IMAGE MODE (MAIN REF ON) PROTOCOL ***
         1. Generate exactly ${count} art prompt variations as a JSON array based STRICTLY on the provided keywords.
         2. You MUST feature the characters uploaded to the Staging Area (using their tags like @C1, @C2) in EVERY prompt.
         3. In each prompt, those characters should be engaged in different activities and interacting with other subjects/elements as described in the user's keywords.
         4. The activities do not need to relate to one another across the ${count} prompts.
         5. The prompts can be completely unrelated in subject or scenario.
         6. The Staging Area characters remain the recurring characters, but the other subjects/elements (e.g., other animals, people, objects) in each prompt MUST be different from the other prompts.`
      : `*** SINGLE IMAGE MODE (MAIN REF OFF) PROTOCOL ***
         1. Generate exactly ${count} art prompt variations as a JSON array based exactly on the user's request.
         2. The prompts should feature different subjects/elements engaged in different activities, as guided by the user's keywords.
         3. The activities do not need to relate to one another across the ${count} prompts.
         4. Each prompt should feature different subjects/elements from the others.
         5. DO NOT use any character references uploaded to the Staging Area.`;

    if (followInputs) {
      singleImageInstruction = `*** FOLLOW INPUTS PROTOCOL ***
         1. The user has provided a series of specific scenarios or activities in the keywords.
         2. You MUST generate exactly ${count} art prompts as a JSON array.
         3. Each generated prompt MUST strictly correspond to one of the scenarios provided by the user, in order. Do not hallucinate or invent new scenarios.
         4. You MUST feature the characters uploaded to the Staging Area (using their tags like @C1, @C2) in EVERY prompt, if Use Main Ref is ON.
         5. Ensure you add specific instructions on the art style, rendering look, and other visual details to each prompt, while keeping the core action exactly as requested.`;
    }

    let instruction = storyMode
      ? `Generate exactly ${count} sequential art prompts as JSON array. 
         IMPORTANT: Every prompt MUST end with 'Text overlay: "[Dialogue or Narrative text]"' based on the scene's action.
         
         *** EXTREME DETAIL & STRICT STORY COMPLIANCE PROTOCOL ***
         1. CHRONOLOGICAL PROGRESSION: You MUST strictly follow the chronological order of the provided script or keywords. Progress the story through the different locations and events described.
         2. PROP & ENVIRONMENT COHERENCE (CRITICAL): If the characters are in the same location across multiple scenes, items and background objects MUST NOT suddenly disappear or appear in the next scene unless the change is explicitly warranted and explained by the action. If a prop (e.g., a water bottle, a camera) or an architectural feature (e.g., a door) is used in scene 2 or 3, it MUST be explicitly described as present in scene 1 (e.g., "holding a water bottle"). Map out the room (e.g., "mirror on the left, door on the right") and keep it strictly consistent from prompt to prompt.
         3. FORCE POSE VARIATION: You MUST explicitly describe completely different poses for every character in every single frame. If they are dancing in frame 1, they must be doing a completely different dance move in frame 2 (e.g., jumping, spinning, crouching on the floor). NO REPEATED POSES.
         4. CAST OF CHARACTERS (CRITICAL FOR CONSISTENCY): 
            - In the first scene, you MUST invent a specific cast of characters with distinct, detailed physical descriptions (e.g., "Boy A with short spiky hair", "Girl B with long twin tails"). 
            - You MUST reuse these EXACT SAME physical descriptions for the same characters in EVERY subsequent scene. 
            - DO NOT introduce new random characters in later scenes. 
            - DO NOT change their core physical traits. 
            - DO NOT make them look like clones; give each a highly distinct hairstyle and feature.
         5. NO FADING OR GHOSTING: All characters, including background characters, MUST be described as fully present and solid. DO NOT use words like "faint", "faded", "ghostly", "greyed out", or "silhouettes".
         6. EXHAUSTIVE DESCRIPTIONS: Describe the exact posture, facial expression, hand placement, and spatial relationship of every character in every scene.
         7. TEXT OVERLAYS: The 'Text overlay' MUST be taken verbatim from the provided script. Do NOT invent new dialogue.
         8. TEXT OVERLAY STYLING (CRITICAL FOR CONSISTENCY): You MUST choose ONE specific font design (e.g., 'bold sans-serif', 'elegant serif') and ONE specific translucent backing box style for the entire story. You MUST copy-paste this EXACT SAME styling instruction character-for-character to the 'Text overlay' section of EVERY single prompt in the array. If the wording changes even slightly between scenes, the final rendered story will have inconsistent, broken typography. Do NOT vary the font description between prompts.
         
         ${masterPromptMandate}
         ${precisionMandate}
         ${tagRestriction}
         ${behaviorMandate}
         ${ipRestriction}
         ${styleAndColorMandate}
         ${frameMandate}
         ${watermarkMandate}`
      : `${singleImageInstruction}
         ${masterPromptMandate}
         ${precisionMandate}
         ${tagRestriction}
         ${behaviorMandate}
         ${ipRestriction}
         ${styleAndColorMandate}
         ${frameMandate}
         ${watermarkMandate}`;

    if (storyMode) {
      if (authorStyle) {
        instruction += `\n         WRITING STYLE MANDATE: Emulate the writing style, tone, and narrative voice of ${authorStyle}. The generated text overlays and scene descriptions MUST reflect this author's unique literary signature.`;
      }
      if (manuscriptFile) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(manuscriptFile);
          reader.onload = () =>
            resolve((reader.result as string).split(",")[1]);
          reader.onerror = (error) => reject(error);
        });
        parts.push({
          inlineData: {
            mimeType: manuscriptFile.type || "text/plain",
            data: base64,
          },
        });
        instruction += `\n         MANUSCRIPT STYLE MANDATE: Analyze the provided manuscript document. Emulate its specific writing style, tone, vocabulary, and narrative voice in the generated text overlays and scene descriptions.`;
      }
      if (includeCovers) {
        instruction += `\n         COVER MANDATE (CRITICAL): You MUST format the first prompt as the 'Front Cover' and the last prompt (prompt #${count}) as the 'Back Cover'.
          - For the Front Cover: Ensure it looks like a professional book cover design. Feature the main characters and the core theme of the story in a dramatic, full-bleed cinematic composition. Do NOT use standard text overlay boxes. Describe the typography as integrated into the artwork. The text overlay MUST explicitly include the book title: "${bookTitle}" in a large, highly stylized, eye-catching font with motifs related to the story. The author's name: "by ${authorName}" MUST be placed prominently in a different, complementary font (e.g., elegant serif or sans-serif), often in a different location such as the bottom center.
          - For the Back Cover: Ensure it looks like a professional back cover. DO NOT include a large full-bleed illustration. Feature a very small vignette or no image at all, strictly constrained to occupy no more than 1/4 to 1/3 of the total canvas height. Focus entirely on a large, prominent, short, interesting, and attractive synopsis of the story presented prominently in the vertical center of the canvas. The synopsis typography MUST be a completely different font from the story's interior fonts (e.g., use a distinct, highly readable body font or stylized display font). You may include a solid colored background or simple gradient. DO NOT include an ISBN label, barcode, or standard caption box.`;
      }
    }

    parts.push({
      text: `${instruction}\n\n*** USER'S MASTER PROMPT (CONTEXT/KEYWORDS) ***\n${keywords}\n*** END OF MASTER PROMPT ***\n\nCRITICAL REMINDER: You MUST base ALL your generated prompts entirely on the USER'S MASTER PROMPT above. \n\n*** GENDER & DEMOGRAPHIC ENFORCEMENT (HIGHEST PRIORITY) ***\nIf the user's prompt mentions multiple genders or specific demographics (e.g., "boys and girls", "men and women"), YOU MUST INCLUDE ALL OF THEM IN EVERY SINGLE GENERATED PROMPT. \nCRITICAL VISUAL OVERRIDE: Do NOT let the provided reference images bias the gender or demographics. If the reference image shows only girls, but the user's text prompt asks for "boys and girls", you MUST include BOTH boys and girls. The text prompt's demographics ALWAYS override the reference image's demographics. Do not default to just one gender. Do not invent unrelated subjects or storylines.\n\n*** FORMATTING & PARAGRAPHING REMINDER (CRITICAL) ***\nEnsure EVERY generated string separates its sections (style, character 1, character 2, text overlay) into distinct paragraphs using ACTUAL NEWLINES (e.g. \\n\\n in JSON). Do NOT output a single wall of text.`,
    });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: { parts: parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    });
    
    const parsedOptions = JSON.parse(response.text || "[]");
    return parsedOptions.map((opt: string) => opt.replace(/\\n/g, '\n').replace(/\n{3,}/g, '\n\n'));
  });
};

export const renderTextOverlayOnCanvas = async (
  imageDataUrl: string,
  topText: string,
  bottomText: string
): Promise<string> => {
  if (!topText && !bottomText) return imageDataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(imageDataUrl);

        ctx.drawImage(img, 0, 0);

        const fontSize = Math.max(24, Math.floor(canvas.height * 0.048));
        ctx.font = `900 ${fontSize}px "Impact", "Arial Black", sans-serif, system-ui`;
        ctx.textAlign = "center";
        ctx.fillStyle = "#FFFFFF";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = Math.max(5, Math.floor(fontSize * 0.14));
        ctx.lineJoin = "round";

        const padX = canvas.width * 0.05;

        if (topText && topText.trim()) {
          ctx.textBaseline = "top";
          const topY = Math.floor(canvas.height * 0.04);
          const formattedTop = topText.trim().toUpperCase();
          ctx.strokeText(formattedTop, canvas.width / 2, topY, canvas.width - padX * 2);
          ctx.fillText(formattedTop, canvas.width / 2, topY, canvas.width - padX * 2);
        }

        if (bottomText && bottomText.trim()) {
          ctx.textBaseline = "bottom";
          const bottomY = canvas.height - Math.floor(canvas.height * 0.04);
          const formattedBottom = bottomText.trim().toUpperCase();
          ctx.strokeText(formattedBottom, canvas.width / 2, bottomY, canvas.width - padX * 2);
          ctx.fillText(formattedBottom, canvas.width / 2, bottomY, canvas.width - padX * 2);
        }

        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        console.error("Canvas overlay error:", err);
        resolve(imageDataUrl);
      }
    };
    img.onerror = () => resolve(imageDataUrl);
    img.src = imageDataUrl;
  });
};

const extractFallbackTextOverlay = (text: string): { topText: string; bottomText: string } => {
  let topText = "";
  let bottomText = "";

  const match = text.match(/Text Overlay(?:\s*,?\s*text split between top and bottom)?\s*:\s*([^,\n]+)(?:,\s*([^,\n]+))?/i);
  if (match) {
    const rawText = match[1]?.trim() || "";
    const secondPart = match[2]?.trim();
    if (secondPart) {
      topText = rawText;
      bottomText = secondPart;
    } else {
      const words = rawText.split(" ");
      if (words.length >= 4) {
        const mid = Math.ceil(words.length / 2);
        topText = words.slice(0, mid).join(" ");
        bottomText = words.slice(mid).join(" ");
      } else {
        bottomText = rawText;
      }
    }
  }

  return { topText, bottomText };
};

export const generateArt = async (
  prompt: string,
  influence: string,
  bgMode: BackgroundMode,
  customBgColor: string,
  aspectRatio: AspectRatio = "1:1",
  resolution: ImageResolution = "1K",
  analysis: StyleAnalysis | null,
  referenceFiles: UploadedFile[],
  useStagingCharacter: boolean,
  isSequential: boolean = false,
  isRemix: boolean = false,
): Promise<string> => {
  return callWithRetry(async () => {
    const ai = getClient();
    const parts: any[] = [];

    let apiAspectRatio: string = aspectRatio;
    if (aspectRatio === "8.5:11" || aspectRatio === "A4")
      apiAspectRatio = "3:4";
    else if (aspectRatio === "2:1") apiAspectRatio = "16:9";

    let activeBgColorName = "WHITE";
    if (bgMode === BackgroundMode.BLACK) activeBgColorName = "BLACK";
    else if (bgMode === BackgroundMode.CUSTOM)
      activeBgColorName = `COLOR ${customBgColor}`;

    const activeBgColor =
      bgMode === BackgroundMode.WHITE
        ? "#FFFFFF"
        : bgMode === BackgroundMode.BLACK
          ? "#000000"
          : bgMode === BackgroundMode.CUSTOM
            ? customBgColor
            : "#FFFFFF";

    // Check if Icon Ref is present for default overrides
    const hasIconRef = referenceFiles.some((f) => f.category === "icon");

    const sessionAnchor = referenceFiles.find(
      (f) => f.category === "previous_scene",
    );
    const stagingAnchor = referenceFiles.find((f) => f.category === "scene");
    const activeAnchor = sessionAnchor || stagingAnchor;
    const isPreviousFrameAnchor = activeAnchor === sessionAnchor && sessionAnchor !== undefined;
    const hasPreviousScene = !!sessionAnchor;

    // LAW 1: World Building vs Asset Mode
    let environmentalMandate = "";
    const forceEnvironment =
      (bgMode === BackgroundMode.FULL_BACKGROUND || activeAnchor) &&
      !hasIconRef;

    if (forceEnvironment) {
      environmentalMandate = isPreviousFrameAnchor
        ? `
        *** MODE: STORY CONTINUITY ENVIRONMENT ***
        1. SCENE ADAPTATION: You must maintain the artistic style and color palette of the [STORY CONTINUITY ANCHOR].
        2. LOCATION CHANGES: IF the text prompt describes a NEW location (e.g., moving from a studio to a zoo, or to a stage), you MUST change the background to match the new location described in the prompt. DO NOT force the characters to stay in the previous scene's location.
        3. If the location in the prompt is the same, maintain the scenery and lighting.
        `
        : stagingAnchor
        ? `
        *** MODE: CUSTOM ENVIRONMENT SETUP ***
        1. SCENE ADAPTATION: You MUST use the uploaded SCENE REFERENCE for the environment layout and background.
        2. LOCATION CHANGES: IF the text prompt describes a NEW location, you MUST change the background to match the new location described in the prompt.
        3. If the location in the prompt is the same as the scene reference, maintain the scenery and lighting.
        `
        : `
        *** MODE: FULL CINEMATIC ENVIRONMENT ***
        1. RENDER FULL SCENERY: Scenery, architecture, and lighting must be fully rendered.
        `;
    } else {
      environmentalMandate = `
        *** MODE: TECHNICAL CANVAS ISOLATION (Solid ${activeBgColorName} / ${activeBgColor}) ***
        1. ERASE ALL SCENERY: No rooms, no landscapes, no gradients, no shadows on the background.
        2. SOLID BACKGROUND: Render the subject on a pure, flat, solid ${activeBgColorName} (${activeBgColor}) background. THIS IS ABSOLUTELY MANDATORY.
        `;
    }

    // SUPREME COLOR MANDATE
    const colorPalette = analysis?.colors?.join(", ") || "Detected from references";

    const isColoringPage =
      /coloring page|line art|black and white|outline|sketch|monochrome/i.test(
        prompt,
      ) ||
      /coloring page|line art|black and white|outline|sketch|monochrome/i.test(
        influence,
      );

    const colorMandate = isColoringPage
      ? `
    *** SUPREME CHROMATIC OVERRIDE (COLORING PAGE PRIORITY) ***
    1. THE USER HAS EXPLICITLY REQUESTED A COLORING PAGE OR LINE ART.
    2. STRICTLY NO COLOR: The entire image MUST be pure black and white line art.
    3. NO SHADING: Do not shade or color the illustrations with black or grey. Use only clean, crisp outlines.
    4. NO INTRICATE PATTERNS: Keep the line art clean and suitable for coloring.
    5. IGNORE ALL COLOR PALETTES AND REFERENCES.
    `
      : hasPreviousScene
        ? `
    *** SUPREME CHROMATIC OVERRIDE (ANCHOR PRIORITY) ***
    1. IGNORE the extracted color palette.
    2. YOU MUST USE THE EXACT COLORS FROM THE [STORY CONTINUITY ANCHOR] IMAGE.
    3. If the anchor is in full color, the output MUST be in full color. DO NOT render in black and white unless the text prompt explicitly asks for it.
    `
        : `
    *** SUPREME CHROMATIC OVERRIDE (ABSOLUTE PRIORITY) ***
    1. THE USER HAS CHANGED THE COLOR PROFILE. THE NEW PALETTE IS: [${colorPalette}].
    2. DISCARD ALL COLORS from reference images (@C1, @icon, etc.) if they conflict with this palette.
    3. MANDATORY RECOLOR: If @icon is red and the palette is blue, RENDER IN BLUE.
    4. THE PALETTE [${colorPalette}] IS THE ONLY ALLOWED COLOR IDENTITY FOR THE SUBJECTS.
    5. *** PIXEL PURGE WARNING ***: DO NOT DRAW BOXES, BARS, OR RECTANGLES CONTAINING THESE COLORS. ONLY USE THESE COLORS TO SHADE THE CHARACTERS${forceEnvironment ? " AND ENVIRONMENT" : ""}.
    ${!forceEnvironment ? `6. *** BACKGROUND EXCEPTION ***: THE BACKGROUND MUST REMAIN STRICTLY ${activeBgColorName} (${activeBgColor}) AND MUST NOT BE COLORED BY THE PALETTE.` : ""}
    `;

    // SPATIAL MANDATE FOR ICONS
    let spatialMandate = "";
    if (hasIconRef) {
      spatialMandate = `
        *** CANVAS SCALE & SPATIAL PARITY MANDATE ***
        1. CLONE MARGINS: Replicate the exact padding Surrounding the subject as seen in @icon.
        2. SUBJECT SCALE: Replicate the exact size of the subject relative to the frame. 
        3. NO ZOOM: Do not enlarge the subject. Keep it small/centered if @icon is small/centered.
        `;
    }

    let textCommand = isSequential
      ? `*** TEXT OVERLAY PERMITTED ***
    1. DO NOT render any watermarks, signatures, or copyright messages.
    2. DO NOT render any frames, borders, or polaroid edges around the image.
    3. TEXT OVERLAY STYLING: If the prompt requests a "Text overlay:", you MUST render the text at the EXACT bottom middle of the image. To ensure consistency across story pages, you MUST strictly follow the exact font style and translucent backing box described in the prompt. Do NOT invent a different font, do NOT deviate from the described styling, and do NOT change the typography.
    4. ALL CHARACTERS SOLID: Render all characters (foreground and background) with solid, clear lines and full opacity. Do not render any characters as faint grey outlines, ghosts, or faded sketches.
    ${isColoringPage ? "5. COLORING PAGE OVERRIDE: There should strictly be no color, no frame, no names, no intricate patterns. Do not shade or color the illustrations with black or grey." : ""}`
      : `*** STRICT NEGATIVE CONSTRAINT: ZERO TEXT, NO FRAMES, NO WATERMARKS. ***
    1. DO NOT render any text, watermarks, signatures, or copyright messages.
    2. DO NOT render any frames, borders, or polaroid edges around the image.
    3. If the prompt explicitly says "no frames" or "no text", you MUST strictly obey and ensure the image fills the canvas without any borders or text.
    4. ALL CHARACTERS SOLID: Render all characters (foreground and background) with solid, clear lines and full opacity. Do not render any characters as faint grey outlines, ghosts, or faded sketches.
    ${isColoringPage ? "5. COLORING PAGE OVERRIDE: There should strictly be no color, no text, no frame, no names, no intricate patterns. Do not shade or color the illustrations with black or grey." : ""}`;

    const hasFontRef = referenceFiles.some((f) => f.category === "font");
    const hasSceneRef = referenceFiles.some((f) => f.category === "scene");
    let styleMasters = referenceFiles.filter((f) => f.isStyleInfluence);

    const characters = referenceFiles.filter((f) => f.category === "character");
    const uniqueCharIndices = Array.from(
      new Set(characters.map((c) => c.charIndex ?? 0)),
    ).sort((a, b) => a - b);
    const activeCharTags = uniqueCharIndices
      .map((idx) => {
        const charFile = characters.find((c) => c.charIndex === idx);
        return `@${charFile?.characterName || `C${idx + 1}`}`;
      })
      .filter((tag) => {
        const lowerPrompt = prompt.toLowerCase();
        const lowerTag = tag.toLowerCase();
        const lowerName = tag.replace('@', '').toLowerCase();
        const escapedName = lowerName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
        return lowerPrompt.includes(lowerTag) || new RegExp(`\\\\b${escapedName}\\\\b`).test(lowerPrompt);
      })
      .join(", ");

    const styleRetentionProtocol = isPreviousFrameAnchor
      ? `
    *** COMPONENT-SPECIFIC STYLE PRESERVATION ***
    1. You MUST render everything in the exact style, medium, and color of the [STORY CONTINUITY ANCHOR].
    `
      : `
    *** MULTIPLE CHARACTER STYLE RETENTION (NO STYLE MASTER) ***
    1. **NO GLOBAL STYLE MASTER**: Because no style master is set, if the prompt text explicitly describes a specific art style, you MUST unify all characters under that requested art style.
    2. **RESPECTIVE STYLES (IF NO PROMPT STYLE)**: If there are multiple characters with DIFFERENT art styles AND the prompt does not describe an art style, you MUST render each respective character in its OWN ORIGINAL ART STYLE, COLOR TONES, and RENDERING STYLES. Do NOT unify them into a single style. If @C1 is a 3D render and @C2 is an anime drawing, they MUST appear together in the same image as 3D and 2D respectively.
    3. **INDIVIDUAL FIDELITY**: If falling back to respective styles, each element must look like it was rendered in its original medium, texture, and style.
    4. **ENVIRONMENT ISOLATION**: Do not import any environment from either of the character references into the new render.
    `;

    const remixDirectives = isRemix
      ? `
    *** REMIX MODE: ON (FULL ATTRIBUTE TRANSFER) ***
    1. You MUST influence the output using the physical attributes and appearances of the reference images.
    2. This includes transferring the material, color palette, rendering style, accessories, clothing, and props from the reference to the new subject.
    3. For example: If the reference is a purple plush monster with a red feather, and the prompt asks for a Westie dog, you MUST render a purple plush Westie with a red feather.
    4. Blend the identity of the requested subject with the physical characteristics and accessories of the reference.
    `
      : `
    *** REMIX MODE: OFF (STYLE & MATERIAL ONLY) ***
    1. You MUST ONLY transfer the rendering style, artistic medium, and base material (e.g., plush, clay, oil paint) from the reference.
    2. DO NOT transfer specific colors, accessories, props, or clothing from the reference unless explicitly requested in the prompt.
    3. For example: If the reference is a purple plush monster with a red feather, and the prompt asks for a Westie dog, you MUST render a standard white plush Westie without a feather.
    4. The subject must retain its natural colors and physical form, influenced ONLY by the artistic medium and style of the reference.
    `;

    const characterPresenceMandate = useStagingCharacter
      ? `
    *** CHARACTER PRESENCE MANDATE: ON ***
    1. You MUST ONLY render the uploaded character references that are EXPLICITLY MENTIONED in the text prompt (e.g. by their name or tag like @Fox).
    2. YOU ARE STRICTLY FORBIDDEN from rendering any uploaded character reference that is NOT explicitly mentioned in the text prompt. Even if they are provided as reference images, do NOT draw them unless asked for.
    3. If the prompt describes new entities or actions (e.g., "a Westie", "eating a burger"), you MUST render the explicitly mentioned referenced characters AND the new entities interacting together in the scene.
    4. Do not replace the referenced characters with the prompt subjects. They must coexist and interact.
    `
      : `
    *** CHARACTER PRESENCE MANDATE: OFF (CRITICAL OVERRIDE) ***
    1. YOU ARE STRICTLY FORBIDDEN FROM RENDERING THE SPECIFIC CHARACTERS SEEN IN ANY UPLOADED REFERENCES OR STAGING ANCHORS.
    2. The uploaded images are provided for STYLE, COLOR, and DNA reference ONLY.
    3. DO NOT use the identity, face, clothing, or specific physical form of the reference characters.
    4. Render ONLY the new subjects described in the text prompt, using the artistic style of the references.
    ${isPreviousFrameAnchor ? "5. EXCEPTION: You MUST maintain the characters from the [STORY CONTINUITY ANCHOR] (the previous frame) to ensure story continuity." : ""}
    `;

    let systemInstructions = `
    *** ARTMIMIC V191: PIXEL-PURGE & ICONIC MASTER ARCHITECTURE ***
    1. ${useStagingCharacter ? IDENTITY_PARITY_PROTOCOL : ""}
    2. ${styleMasters.length > 0 ? STYLE_MASTER_PROTOCOL : styleRetentionProtocol}
    3. ${hasFontRef ? TYPOGRAPHIC_PARITY_PROTOCOL : ""}
    4. ${hasIconRef ? ICON_REPLICATION_PROTOCOL : ""}
    ${styleMasters.length > 0 && analysis ? `5. GLOBAL RENDERING SPEC: ${analysis.technique}.` : ""}
    ${environmentalMandate}
    ${spatialMandate}
    ${textCommand}
    ${STRICT_STYLE_RULES}
    ${hasSceneRef && !hasIconRef ? SCENE_INTEGRITY_RULES : ""}
    ${remixDirectives}
    ${characterPresenceMandate}
    `;

    // Start with global style references
    if (styleMasters.length > 0) {
      parts.push({
        text: `*** [STYLE_MASTER] GLOBAL STYLE REFERENCES ***\nALL elements in the image MUST be rendered in the exact style, color tones, and rendering style of these references.\nNOTE: If these references contain characters, and the 'Character Presence Mandate' is ON or if they are explicitly requested, you MUST still preserve their faces and identities. Otherwise, YOU ARE STRICTLY FORBIDDEN from copying the appearance, face, clothing, or physical form of any characters or subjects seen in the [STYLE_MASTER] images. ONLY extract the artistic medium, brushstrokes, textures, and color palette. You MUST invent entirely new subjects.`,
      });
      styleMasters.forEach((f, index) => {
        parts.push({ text: `[STYLE_MASTER] Reference ${index + 1}:` });
        parts.push({ inlineData: { mimeType: f.mimeType, data: f.data } });
      });
    }

    // Icon DNA
    if (hasIconRef) {
      const iconRef = referenceFiles.find((f) => f.category === "icon");
      if (iconRef) {
        const iconStyleInstruction =
          styleMasters.length > 0
            ? `(Apply the [STYLE_MASTER] rendering style to this geometry)`
            : `(CLONE ART MEDIUM, TEXTURE, AND SCALE EXACTLY)`;
        parts.push({
          text: `[ICONIC_MASTER_TEMPLATE] Anchor @icon ${iconStyleInstruction}:`,
        });
        parts.push({
          inlineData: { mimeType: iconRef.mimeType, data: iconRef.data },
        });
      }
    }

    if (hasFontRef) {
      const fontRef = referenceFiles.find((f) => f.category === "font");
      if (fontRef) {
        parts.push({ text: `[FONT_REFERENCE] @F1:` });
        parts.push({
          inlineData: { mimeType: fontRef.mimeType, data: fontRef.data },
        });
      }
    }

    if (hasSceneRef && !hasIconRef && sessionAnchor) {
      const sceneRef = stagingAnchor;
      if (sceneRef) {
        const sceneStyleInstruction =
          styleMasters.length > 0
            ? `(Render this scene in the exact style of the [STYLE_MASTER])`
            : `(Render this scene in its OWN ORIGINAL rendering style and medium)`;
        parts.push({
          text: `[SCENE_REFERENCE] @scene ${sceneStyleInstruction}:`,
        });
        parts.push({
          inlineData: { mimeType: sceneRef.mimeType, data: sceneRef.data },
        });
      }
    }

    if (activeAnchor) {
      const anchorIdentityInstruction = useStagingCharacter
        ? `4. STAGING AREA OVERRIDE (PARTIAL): This anchor sets the environment/background. ${
            styleMasters.length > 0
              ? "Render the characters using the designated [STYLE_MASTER] style."
              : "Render EACH character in its OWN ORIGINAL art style (as stated previously) UNLESS the prompt explicitely asks to unify them. DO NOT force all characters into this anchor's style if they have distinct origins."
          }\n5. DYNAMIC ACTION (CRITICAL): The characters MUST perform the action described in the text prompt. DO NOT freeze them in the anchor's pose. You MUST change their poses, positions, and layout to match the prompt's action.`
        : isPreviousFrameAnchor
          ? `4. TEXT OVERLAY CONSISTENCY: You MUST retain the exact same typography, font style, and text backing box as seen in this anchor image.
5. FLEXIBLE CONTINUITY: You MUST honor any changes requested in the text prompt regarding character actions, new dialogue/text, additional characters, character appearance/clothing, and time of day. DO NOT freeze characters in the anchor's pose.
6. LOCATION & BACKGROUND: UNLESS the text prompt explicitly describes a new location or background, you must retain the same background, lighting, and scenery as this anchor image.`
          : `4. STAGING AREA OVERRIDE (CRITICAL): YOU ARE STRICTLY FORBIDDEN FROM DRAWING THE CHARACTERS OR SUBJECTS SEEN IN THIS ANCHOR IMAGE. You must completely ignore their identity, face, clothing, and physical form.\n5. DYNAMIC ACTION (CRITICAL): Render ENTIRELY NEW subjects as described in the text prompt, using ONLY the artistic style, color palette, and DNA of this anchor. DO NOT render the characters from this anchor.`;

      parts.push({
        text: `*** [STORY CONTINUITY ANCHOR] PREVIOUS SCENE REFERENCE (HIGHEST PRIORITY) ***\n1. This image is the ANCHOR for the overall layout, style, colors, and typography.\n2. STRICT COLOR RETENTION: If the anchor image is in color, your output MUST be in color. DO NOT strip the color.\n3. FOLLOW THE PROMPT OVERRIDES: The text prompt ALWAYS overrides the anchor image for character actions and scene events.\n${anchorIdentityInstruction}`,
      });
      parts.push({
        inlineData: {
          mimeType: activeAnchor.mimeType,
          data: activeAnchor.data,
        },
      });
    }

    // IDENTITY DNA IS MOVED TO THE END OF THE CHAIN FOR MAXIMUM ATTENTION WEIGHT
    let scaleDirectives = "";
    if (useStagingCharacter) {
      uniqueCharIndices.forEach((idx) => {
        const charViews = characters.filter((c) => c.charIndex === idx);
        const charName = charViews[0]?.characterName || `C${idx + 1}`;
        const charTag = `@${charName}`;

        // Ensure character is mentioned in the prompt before appending to prevent hallucinations
        const lowerPrompt = prompt.toLowerCase();
        const lowerTag = charTag.toLowerCase();
        const lowerName = charName.toLowerCase();
        const escapedName = lowerName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
        const isMentioned = lowerPrompt.includes(lowerTag) || new RegExp(`\\\\b${escapedName}\\\\b`).test(lowerPrompt);
        if (!isMentioned) {
          return;
        }

        const ratio = parseFloat(String(charViews[0]?.heightRatio)) || 1.0;

        if (idx === 0) {
          scaleDirectives += `[CHARACTER @${charName}]: Base Anchor. Height = 100% (1.0x).\n`;
        } else {
          const baseCharName =
            characters.find((c) => c.charIndex === 0)?.characterName || "C1";
          const relativeSizeDesc =
            ratio < 1.0
              ? "SMALLER than"
              : ratio > 1.0
                ? "LARGER than"
                : "the SAME SIZE as";
          scaleDirectives += `[CHARACTER @${charName}]: STRICT SCALE REQUIRED. Must be drawn ${relativeSizeDesc} @${baseCharName}, at EXACTLY ${ratio}x the height of @${baseCharName}. (e.g., if @${baseCharName} is 10 units tall, @${charName} MUST be ${ratio * 10} units tall).\n`;
        }

        const charStyleInstruction = isPreviousFrameAnchor
          ? `(CRITICAL: Render this character in the EXACT style, medium, and COLOR PALETTE of the [STORY CONTINUITY ANCHOR], UNLESS the text prompt explicitly requests a different style like 'black and white outline'. DO NOT use this character reference's original colors or medium.)`
          : styleMasters.length > 0
            ? `(Render this character in the exact style of the [STYLE_MASTER], UNLESS the text prompt explicitly requests a different style)`
            : `(Render this character in its OWN ORIGINAL rendering style and medium, UNLESS the text prompt requests a different style)`;
        parts.push({
          text: `*** CHARACTER IDENTITY REFERENCE @${charName} ***\n${charStyleInstruction}\n(CRITICAL: Use these images ONLY to understand the character's design. DO NOT draw floating heads, reference insets, or picture-in-picture boxes in the final image.)`,
        });
        charViews.forEach((v) => {
          parts.push({ text: `Geometric Reference (View: ${v.viewType}):` });
          parts.push({ inlineData: { mimeType: v.mimeType, data: v.data } });
        });
      });
    }

    const subjectLine = useStagingCharacter && activeCharTags
      ? `SUBJECTS: ${activeCharTags} interacting with "${prompt}"`
      : `SUBJECTS: "${prompt}"`;

    const geometricDeviationWarning = useStagingCharacter && activeCharTags
      ? `*** VOID INTERNAL DEFAULTS: ANY GEOMETRIC DEVIATION FROM ${activeCharTags} PIXELS IS A PRODUCTION FAILURE ***`
      : `*** VOID INTERNAL DEFAULTS: STRICTLY ADHERE TO THE PROVIDED TEXT PROMPT FOR SUBJECT IDENTITY ***`;

    const ipProtectionMandate = useStagingCharacter
      ? `8. COPYRIGHT & IP PROTECTION: DO NOT introduce any famous celebrities, K-pop groups, or copyrighted/trademarked characters (e.g., Disney, anime, movies) UNLESS they are explicitly named in the text prompt or clearly depicted in the provided character references.`
      : `8. STRICT COPYRIGHT & IP BAN (CRITICAL): YOU MUST CREATE 100% ORIGINAL, GENERIC CHARACTERS. DO NOT generate any famous people, celebrities, K-pop idols, or copyrighted/trademarked characters (e.g., anime, movies, games) under any circumstances, UNLESS the user explicitly names them in the text prompt.
      9. REFERENCE CHARACTER BAN: You are STRICTLY FORBIDDEN from drawing the specific girl/boy/character shown in the [STYLE_MASTER] or [SCENE_REFERENCE] images. You MUST invent entirely new characters based on the text prompt.`;

    const finalPromptText = `
    ${geometricDeviationWarning}
    TASK: RENDER ONE (1) SINGLE UNIFIED IMAGE ${!forceEnvironment ? `ON A PURE, FLAT, SOLID ${activeBgColorName} (${activeBgColor}) BACKGROUND` : "IN A FULL ENVIRONMENT"}.
    ${subjectLine} ${!forceEnvironment ? `(isolated on a solid ${activeBgColorName} background)` : ""}
    ${influence ? `DIRECTIVES: "${influence}"` : ""}

    *** CRITICAL NEGATIVE CONSTRAINTS MANDATE ***:
    If the prompt explicitly states the ABSENCE of an object (e.g., "empty table", "no food", "no weapons"), you MUST NOT render that object under any circumstances.

    *** CRITICAL SCALE PARITY MANDATE ***:
    You are required to strictly enforce the relative heights of the characters in the scene.
    ${scaleDirectives}
    Do not auto-scale characters to be the same height. You MUST respect the size differences specified above.

    *** STYLE TRANSFER MANDATE (CRITICAL) ***:
    ${styleMasters.length > 0 ? `You MUST closely follow the rendering style, aesthetics, and DNA of the [STYLE_MASTER] reference images, UNLESS the text prompt explicitly requests a different style. Extract the artistic medium, texture, lighting, and brushstrokes from the style masters and apply them to the entire final output. The final image MUST look like it was created by the same artist using the same tools as the style master (UNLESS overridden by the prompt).` : `If the prompt text explicitly describes an art style, unify all characters under that style. If NO art style is requested in the prompt, you MUST closely follow the ORIGINATING rendering style and medium of EACH INDIVIDUAL character reference respectively. DO NOT UNIFY the art style across different characters if they have different originating styles.`}

    ${
      hasIconRef
        ? `
    *** ICON STYLE FIDELITY MANDATE ***:
    1. ${styleMasters.length > 0 ? `CLONE THE GEOMETRY AND FORMAT OF @icon, BUT USE THE ART MEDIUM OF THE [STYLE_MASTER].` : `CLONE THE ART MEDIUM OF @icon: If @icon is a rough-edged woodblock print stencil, the output MUST be a rough-edged woodblock print stencil.`}
    2. CLONE THE FORMAT: If @icon is a white silhouette on a solid block, REPLICATE THAT EXACT FORMAT.
    3. CLONE THE SCALE: Replicate exact margins and subject-to-frame ratio.
    `
        : ""
    }
    
    ${systemInstructions}

    ${styleMasters.length > 0 || hasPreviousScene ? colorMandate : ""}
    ${hasPreviousScene ? `*** FINAL CHROMATIC REMINDER: THE [STORY CONTINUITY ANCHOR] OVERRIDES ALL OTHER COLORS (UNLESS THE TEXT PROMPT EXPLICITLY REQUESTS A DIFFERENT COLOR SCHEME LIKE BLACK AND WHITE). ***` : styleMasters.length > 0 ? `*** FINAL CHROMATIC REMINDER: THE USER PALETTE [${colorPalette}] OVERRIDES ALL REFERENCE PIXELS (UNLESS THE TEXT PROMPT EXPLICITLY REQUESTS A DIFFERENT COLOR SCHEME LIKE BLACK AND WHITE). ***` : ""}
    ${!forceEnvironment ? `*** FINAL BACKGROUND REMINDER: THE BACKGROUND MUST BE A PURE, FLAT, SOLID ${activeBgColorName} (${activeBgColor}). NO SCENERY, NO GRADIENTS. ***` : ""}

    *** USER INSTRUCTION OVERRIDE (CRITICAL) ***:
    If the prompt explicitly requests a specific art style (e.g., "drawn in watercolor", "cyberpunk", "anime"), coloring style (e.g., "full color", "colored", "vibrant"), or lack of color (e.g., "black and white", "line art", "monochrome", "outlines", "sketch"), YOU MUST OBEY THE PROMPT OVER ALL REFERENCE IMAGES AND EXTRACTED PALETTES.
    - If the reference is a 3D model, but the prompt asks for "watercolor", YOU MUST RENDER IN WATERCOLOR.
    - If the reference is black and white, but the prompt asks for color, YOU MUST RENDER THE ENTIRE SCENE IN COLOR.
    - If the reference is in color, but the prompt asks for black and white or outlines, YOU MUST RENDER THE ENTIRE SCENE IN BLACK AND WHITE / OUTLINES.
    - PURE WHITE BACKGROUND FOR SKETCHES: If the prompt asks for a "black and white outline", "line art", or "sketch", the background of the image MUST be pure #FFFFFF white. DO NOT use cream, yellow, off-white, parchment, or paper textures.
    - *** DIEGETIC STYLE BAN ***: DO NOT turn the requested style into an object in the scene. If asked for a "sketch" or "outline", make the ACTUAL IMAGE a sketch/outline. DO NOT draw a colored character holding a sketch, looking at a drawing, or painting on a canvas.
    - The prompt's explicit style/color instructions ALWAYS win. This OVERRIDES the "SUPREME CHROMATIC OVERRIDE", the extracted color palette, and the character's original medium.

    *** ANTI-DUPLICATION MANDATE (CRITICAL) ***:
    1. DO NOT render multiple versions of the same character to satisfy conflicting style constraints.
    2. If the user asks for a "black and white outline" of a colored reference, render ONLY ONE character in black and white outline. DO NOT render one colored and one black and white.
    3. DO NOT split the image in half (e.g., half color, half black and white). DO NOT render a partially colored image (e.g. colored background with black and white character, or vice versa). The ENTIRE image must be unified in ONE style.
    4. RENDER EXACTLY ONE INSTANCE of each requested subject unless the prompt explicitly asks for multiples.
    5. CLONE PREVENTION: If the prompt describes a group of people, you MUST ensure every person has a distinct face, hairstyle, and clothing. DO NOT draw identical clones.
    6. EXACT CHARACTER COUNT: You MUST render EXACTLY the number of characters specified in the prompt. If the prompt describes 3 characters, there MUST be exactly 3 people in the image. NO EXTRAS, NO DUPLICATES, NO HALLUCINATED BYSTANDERS.

    *** CRITICAL PIXEL-PURGE MANDATE (HIGHEST PRIORITY) ***:
    1. ABSOLUTELY NO COLOR SWATCHES, NO HEX CODES, NO PANTONE CODES, NO PANTONE BARS, NO COLOR DOTS, AND NO PALETTE RECTANGLES.
    2. DO NOT DRAW BOXES AT THE TOP OR BOTTOM OF THE IMAGE. 
    3. DO NOT RENDER @1, @2, @C1, OR ANY CHARACTER LABELS OR CHARACTER TAG LABELS AS VISIBLE TEXT IN THE IMAGE.
    4. THE COLOR PALETTE DATA IS METADATA FOR SHADING ONLY. DO NOT RENDER IT VISUALLY AS A UI ELEMENT.
    5. NO FLOATING HEADS OR INSETS: DO NOT draw speech bubbles with faces, picture-in-picture boxes, or floating reference heads. The character must exist naturally in the environment.
    6. NO PAGE NUMBERS OR BADGES: DO NOT draw UI elements, page numbers (e.g., "#58"), or decorative badges in the corners of the image.
    7. NO REFERENCE IDENTITY LEAK: If "CHARACTER PRESENCE MANDATE: OFF" is active, you are STRICTLY FORBIDDEN from rendering any characters or specific subjects seen in the reference images or anchors. You MUST invent entirely new subjects based on the text prompt.
    8. NO SIGNATURES OR WATERMARKS: DO NOT include artist signatures, watermarks, logos, or names anywhere in the image (especially in the corners) unless explicitly requested by the user. If you add a signature, YOU FAIL.
    ${ipProtectionMandate}
    `;

    // Append Animagine XL 4.0 tag synthesis prompt instruction
    const tagSynthesisInstruction = `

*** ANIMAGINE XL 4.0 TAG SYNTHESIS MANDATE ***
Analyze all the above prompts, directives, background settings, style master details, and reference images.
Convert this entire creative vision into a clean, comma-separated Danbooru tag prompt specifically optimized for the Animagine XL 4.0 anime rendering engine, along with a comprehensive negative prompt tag list.

Your positive tag prompt MUST start with: "masterpiece, high score, great score, absurdres, "

TEXT OVERLAY EXTRACTION MANDATE:
If the user's prompt contains any request for a text overlay (e.g., "Text Overlay...", "text split between top and bottom: ...", "Text overlay: ..."), extract the exact text into topText and bottomText fields in a "textOverlay" object. If it specifies text split between top and bottom, split the sentence logically across topText and bottomText.

Return ONLY a valid JSON object:
{
  "prompt": "masterpiece, high score, great score, absurdres, 1girl, solo, dark purple short hair, purple eyes...",
  "negative_prompt": "lowres, bad anatomy, bad hands, text, error, missing finger, extra digits, fewer digits, cropped, worst quality, low quality, low score, bad score, average score, signature, watermark, username, blurry, nsfw, naked",
  "textOverlay": {
    "topText": "I CAN'T BEAT YOU",
    "bottomText": "WITHOUT GETTING CLOSER TO YOU"
  }
}`;

    parts.push({ text: tagSynthesisInstruction });

    // Step 1: Synthesize prompt into Animagine XL 4.0 anime tags using Gemini 3 Flash
    const synthResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: parts },
      config: {
        responseMimeType: "application/json",
      },
    });

    let animaginePrompt = "";
    let animagineNegativePrompt = "lowres, bad anatomy, bad hands, text, error, missing finger, extra digits, fewer digits, cropped, worst quality, low quality, low score, bad score, average score, signature, watermark, username, blurry, nsfw, naked";
    let extractedTopText = "";
    let extractedBottomText = "";

    try {
      const parsed = JSON.parse(synthResponse.text || "{}");
      if (parsed.prompt) animaginePrompt = parsed.prompt;
      if (parsed.negative_prompt) animagineNegativePrompt = parsed.negative_prompt;
      if (parsed.textOverlay) {
        if (parsed.textOverlay.topText) extractedTopText = parsed.textOverlay.topText;
        if (parsed.textOverlay.bottomText) extractedBottomText = parsed.textOverlay.bottomText;
      }
    } catch (e) {
      animaginePrompt = `masterpiece, high score, great score, absurdres, ${prompt || "1girl, solo"}`;
    }

    // Fallback text overlay extraction if Gemini didn't return textOverlay object
    if (!extractedTopText && !extractedBottomText) {
      const fallback = extractFallbackTextOverlay(prompt + " " + influence);
      extractedTopText = fallback.topText;
      extractedBottomText = fallback.bottomText;
    }

    if (!animaginePrompt.toLowerCase().includes("masterpiece")) {
      animaginePrompt = `masterpiece, high score, great score, absurdres, ${animaginePrompt}`;
    }

    // Step 2: Determine dimensions for Animagine XL 4.0 (SDXL base native resolutions)
    let width = 1024;
    let height = 1024;
    if (aspectRatio === "3:4" || aspectRatio === "8.5:11" || aspectRatio === "A4") {
      width = 896;
      height = 1152;
    } else if (aspectRatio === "4:3") {
      width = 1152;
      height = 896;
    } else if (aspectRatio === "9:16") {
      width = 832;
      height = 1216;
    } else if (aspectRatio === "16:9") {
      width = 1216;
      height = 832;
    } else if (aspectRatio === "2:1") {
      width = 1344;
      height = 672;
    }

    // Step 3: Render via Animagine XL 4.0 engine (/api/generate-art endpoint)
    const apiRes = await fetch("/api/generate-art", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: animaginePrompt,
        negative_prompt: animagineNegativePrompt,
        width,
        height,
        steps: 28,
        cfg_scale: 5,
      }),
    });

    if (!apiRes.ok) {
      const errJson = await apiRes.json().catch(() => ({}));
      throw new Error(errJson.error || `Animagine XL 4.0 render failed (${apiRes.status})`);
    }

    const resData = await apiRes.json();
    if (!resData.image) {
      throw new Error("No image data returned from Animagine XL 4.0 production engine.");
    }

    // Step 4: Apply Canvas Text Overlay post-processing if requested
    if (extractedTopText || extractedBottomText) {
      const finalComposite = await renderTextOverlayOnCanvas(resData.image, extractedTopText, extractedBottomText);
      return finalComposite;
    }

    return resData.image;
  });
};


