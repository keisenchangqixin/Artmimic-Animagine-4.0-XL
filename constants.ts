export const STRICT_STYLE_RULES = `
*** MANDATORY NEGATIVE CONSTRAINT: ARTIFACT & UI ANNIHILATION ***
1. **ZERO COLOR BARS / SWATCHES**: YOU ARE STRICTLY FORBIDDEN from rendering any "color palettes," "Pantone swatches," "Pantone codes," "hex code boxes," or "color bars" at the top, bottom, or sides of the image. The provided color hex codes are for SHADING the subjects, NOT for drawing literal boxes.
2. **ZERO TEXT HALLUCINATION**: FORBIDDEN from generating any text, labels, or words not explicitly typed in the "RENDER TEXT" command. 
3. **NO INSETS / NO THUMBNAILS**: ABSOLUTELY FORBIDDEN from rendering the reference image as a "box" or "picture" inside your output. Do not render a square containing a subject inside the scene.
4. **NO UI ELEMENTS**: Do not render status bars, frame counters, identification callouts, or "metadata" overlays.
5. **ABSOLUTE SINGLE FRAME MANDATE**: 
   - FORBIDDEN from generating comic strips, grids, or multi-panel layouts.
   - The output MUST be ONE single, continuous, unified scene.
6. **OUTLINE ANNIHILATION PROTOCOL**: 
   - IF THE REFERENCE IMAGES (@C, @icon, @scene) DO NOT HAVE BLACK OUTLINES: *** YOU ARE STRICTLY FORBIDDEN FROM ADDING OUTLINES. ***
   - DO NOT USE CEL-SHADING unless explicitly visible in the source pixels.
7. **LABEL ANNIHILATION**: FORBIDDEN from rendering character markers (e.g., @1, @2, #1, #2), numeric labels, character labels, or tagging overlays that might be present in the references.
8. **NO STYLE BLENDING**: If no [STYLE_MASTER] is specified AND there are no explicit style directions in the prompt text, you are STRICTLY FORBIDDEN from blending the rendering styles of the provided references. Each character must retain its own distinct original art style, color tones, and rendering style. However, if an art style is explicitly requested in the prompt, you MUST follow it.
`;

export const IDENTITY_PARITY_PROTOCOL = `
*** GEOMETRIC PIXEL-TRUTH MANDATE: ZERO-DRIFT ARCHITECTURE ***
1. **FORENSIC GEOMETRIC AUDIT**: 
   - Replicate the EXACT face, facial features, eye-spacing, snout length, and ear curvature of EACH character reference @Ci. DO NOT change their identity or faces.
2. **RIGID IDENTITY RIG**: Treat each character reference @Ci as a high-fidelity 3D model that cannot be altered physically.
3. **ENVIRONMENT ISOLATION**: DO NOT import any environment, background, lighting, or background objects from ANY of the character references into the new render.
4. **SCALE PARITY (GLOBAL ANCHOR RULE)**:
   - @C1 is the Anchor Character for height (1.0x).
   - Subsequent characters (@C2, @C3, etc.) MUST be rendered at their specified relative height ratio compared to @C1.
   - If @C2 is 0.5x, it must be exactly half the height of @C1 in the final render.
5. **CHROMATIC OVERRIDE**: Replicate geometry exactly, but if a 'PRIMARY PALETTE' is provided, you MUST RECOLOR the subject. The user's chosen palette overrides the colors found in the reference pixels.
`;

export const ICON_REPLICATION_PROTOCOL = `
*** ICONIC MASTER TEMPLATE: SYMBOL & LOGO DNA PARITY ***
1. **STRICT MEDIUM CLONING**: Unless overridden by a [STYLE_MASTER], replicate the 'Artistic Medium' of @icon. If @icon looks like a woodblock print, a stencil, or hand-carved, the output MUST look woodblock, stenciled, or hand-carved.
2. **TEXTURAL ESSENCE**: Unless overridden by a [STYLE_MASTER], mirror the exact edge quality of @icon. If the edges are rough, painterly, or "distressed," you MUST replicate that exact distressed texture.
3. **STENCIL PARITY (THE NEGATIVE SPACE RULE)**: 
   - If @icon is a white silhouette on a solid colored block, the output MUST be a white silhouette on a solid colored block.
   - Do not add details, shading, or internal lines if @icon is a flat stencil.
4. **THE TWELVE LAWS OF ICONIC PARITY**:
   - **DIMENSIONALITY**: If @icon is 2D/Flat, the output MUST be 2D/Flat. No depth.
   - **SHADING**: If @icon has NO shading, the output MUST be flat color.
   - **ORIENTATION**: Replicate the exact front/side view of @icon.
   - **COMPOSITION**: If @icon only shows a head, render a head. If it shows a full body, render a full body.
   - **BACKGROUND**: If @icon is on a solid square background, render the new subject on an identical solid square background.
5. **SPATIAL & SCALE PARITY**:
   - **CANVAS SCALE**: The subject in the output MUST occupy the exact same percentage of space as the subject in @icon.
   - **MARGINS**: Replicate the exact padding/breathing room around the subject.
6. **CHROMATIC SUPREMACY**: Discard @icon colors if they conflict with the 'PRIMARY PALETTE' provided in text.
`;

export const STYLE_MASTER_PROTOCOL = `
*** GLOBAL STYLE MASTER MANDATE: TECHNICAL SYNC ***
1. **RENDER ENGINE LOCK**: A [STYLE_MASTER] has been provided. You MUST render the ENTIRE image, including ALL characters and the scene, in the exact rendering style, medium, color tones, and texture of the [STYLE_MASTER].
2. **UNIFY DIFFERENT CHARACTER STYLES**: If there are multiple characters (@C1, @C2, etc.) that originally have DIFFERENT art styles, you MUST IGNORE their original art styles and UNIFY them under the [STYLE_MASTER] style. The [STYLE_MASTER] dictates the final look of everything.
3. **PIPELINE FIDELITY**: Mirror the exact light-bounce, materiality, and medium of the Style Master.
4. **ENVIRONMENT ISOLATION**: Do NOT import any environment or background objects from ANY of the character references into the new render.
5. **FACE PRESERVATION**: DO NOT change their identity, face, or facial features of the character references, even while adapting to the style master.
`;

export const TYPOGRAPHIC_PARITY_PROTOCOL = `
*** TYPOGRAPHIC PARITY PROTOCOL: GLYPH CLONING ***
1. **LITERAL SHAPE REPLICATION**: Mimic the exact stroke weight and curvature of the font reference @F1.
`;

export const SCENE_INTEGRITY_RULES = `
*** SCENE FIDELITY PROTOCOL: 100% REPLICATION ***
1. **STRUCTURAL BLUEPRINT**: Mirror the composition and perspective of the scene reference.
`;

export const STRICT_STORY_COMPLIANCE_PROTOCOL = `
*** SYSTEM BEHAVIOR: BINDING SPECIFICATION MODE ***
1. **PROMPT AUTHORITY**: The "Custom Influence" prompt is a binding technical document.
`;

export const ANALYSIS_PROMPT = `
Act as a Forensic Technical Artist. Extract the exact RENDERING PIPELINE and GEOMETRIC DNA. 

Return ONLY a valid JSON object:
{
  "description": "Technical analysis of the medium.",
  "mood": ["keywords"],
  "technique": "Detailed engine description (e.g., Hand-carved Woodblock Stencil, 3D Render)",
  "dimensionality": "3D_VOLUMETRIC or 2D_FLAT",
  "materiality": "Surface properties",
  "lighting": "Light source profile",
  "colors": ["#HexCodes"],
  "typography": {
    "fontFamilyType": "classification",
    "weight": "profile",
    "characteristics": "detail",
    "isHandwritten": true,
    "texture": "surface",
    "layout": "logic",
    "primaryColor": "Hex",
    "secondaryColor": "Hex",
    "emphasisLogic": "hierarchy",
    "hierarchyBlueprint": "structure",
    "blacklistWords": []
  }
}
`;

export const FAKE_THOUGHTS_ANALYSIS = [
  "Auditing Pixel Dimensionality...",
  "EXTRACTING GEOMETRIC DNA FROM CHARACTER ANCHORS...",
  "Isolating 3D Shader Materiality DNA...",
  "Mapping Facial Proportions: Snout/Eye/Ear Anchors...",
  "Locking PBR Rendering Engine...",
];

export const FAKE_THOUGHTS_GENERATION = [
  "IDENTITY CLONE: Locking @C1 Geometric Blueprint...",
  "STYLE MASTER: Loading Global Rendering Specification...",
  "RENDER ENGINE SYNC: Disabling External Hallucination...",
  "ANTI-DRIFT: Binding Geometric Facial Anchors...",
  "GLYPH LOCK: Mimicking @F1 typographic geometry...",
  "Final Production Render...",
];
