const { GoogleGenerativeAI } = require("@google/generative-ai");

class GeminiService {
    constructor(apiKey) {
        if (!apiKey) {
            console.warn("Gemini API Key is missing. Gemini features will not work.");
            this.model = null;
            return;
        }
        const genAI = new GoogleGenerativeAI(apiKey);
        this.model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    }

    async generateResponse(prompt) {
        if (!this.model) {
            return "Gemini API key is not configured.";
        }
        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error("Error generating Gemini response:", error);
            return `Sorry, I encountered an error: ${error.message}`;
        }
    }
}

module.exports = GeminiService;
