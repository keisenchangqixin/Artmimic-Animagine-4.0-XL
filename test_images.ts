import { generateArt } from "./services/geminiService";
import { BackgroundMode } from "./types";
async function run() {
    try {
        console.log("Generating art...");
        const res = await generateArt(
            "A clear, professional character design sheet or portrait of: A young boy with messy brown hair. Clean background, highly detailed.",
            "",
            BackgroundMode.WHITE,
            "#ffffff",
            "1:1",
            "1K",
            { colors: [], description: "", mood: [], technique: "", dimensionality: "", typography: { fontFamilyType: "", weight: "", characteristics: "", isHandwritten: false, texture: "", layout: "", primaryColor: "", secondaryColor: "", emphasisLogic: "", hierarchyBlueprint: "", blacklistWords: [] } } as any,
            [],
            false,
            false
        );
        console.log("Success! Image starts with:", res.substring(0, 50));
    } catch(e) {
        console.error("Error generating art:", e);
    }
}
run();
