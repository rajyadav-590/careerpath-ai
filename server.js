const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch'); // Using node-fetch for API calls

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from the public folder

// In-memory storage for student data
const studentsData = {};

/**
 * GOOGLE AI API CONFIGURATION
 */
const GOOGLE_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent";

// NOTE: Ensure your actual Google API key is here.
const GOOGLE_API_KEY = "enter your api key here"; 

/**
 * Function to call the Google AI API with Universal Prompting
 */
async function generateCareerPathWithAI(studentProfile) {
    // Safety check: if no key is provided, return mock data to prevent crashes
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY.includes("YOUR_GOOGLE")) {
        console.warn("AI API Key not found. Returning example data.");
        return MOCK_AI_RESPONSE;
    }

    const systemPrompt = `You are a world-class Career Counselor specialized in helping students from ALL academic backgrounds (Arts, Science, Commerce, Engineering, Law, Medical, etc.). 
    Analyze the provided personality traits, cognitive styles, and interests. 
    Suggest the 3 best-fit career paths (could be modern or traditional) and provide a detailed 4-phase growth roadmap for the top choice.
    Maintain an encouraging and professional tone. Respond STRICTLY in structured JSON format.`;

    const userQuery = `Universal Career Assessment for ${studentProfile.fullName}:
        - Current Background: ${studentProfile.courseBranch} (${studentProfile.collegeName})
        - Activities preferred: ${studentProfile.q1}
        - Problem-solving style: ${studentProfile.q2}
        - Preferred Work Environment: ${studentProfile.q3}
        - Professional Values: ${studentProfile.q4}
        - Pride-worthy Skill: ${studentProfile.q5}
        - Communication Preference: ${studentProfile.q6}
        - Goal Satisfaction: ${studentProfile.q7}
        - Passion Topic: ${studentProfile.q8}
        - Interest Industries: ${studentProfile.q9}
        - Commitment Level: ${studentProfile.q10}
        - Specific Concerns: ${studentProfile.message || "None provided"}
        
        Generate the career guidance JSON.`;

    // Strict JSON schema for the AI response
    const responseSchema = {
        type: "OBJECT",
        properties: {
            "topCareers": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "title": { "type": "STRING" },
                        "matchScore": { "type": "STRING" },
                        "reasoning": { "type": "STRING" }
                    },
                    "required": ["title", "matchScore", "reasoning"]
                }
            },
            "bestCareerRoadmap": {
                "type": "OBJECT",
                "properties": {
                    "careerTitle": { "type": "STRING" },
                    "description": { "type": "STRING" },
                    "phases": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "title": { "type": "STRING" },
                                "details": { "type": "ARRAY", "items": { "type": "STRING" } }
                            },
                            "required": ["title", "details"]
                        }
                    }
                },
                "required": ["careerTitle", "description", "phases"]
            }
        },
        "required": ["topCareers", "bestCareerRoadmap"]
    };

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        // Use generationConfig for structured output (Fixes 400 error)
        generationConfig: { 
            responseMimeType: "application/json",
            responseSchema: responseSchema
        }
    };

    try {
        console.log(`[SERVER] Requesting AI path for ${studentProfile.fullName}...`);
        const response = await fetch(`${GOOGLE_API_URL}?key=${GOOGLE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Gemini API Error ${response.status}: ${err}`);
        }

        const result = await response.json();
        const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!jsonText) throw new Error("AI returned empty content");
        
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("[SERVER] AI API Exception:", error.message);
        return null;
    }
}

// --- API ENDPOINTS ---

app.post('/api/student-info', (req, res) => {
    const studentId = uuidv4();
    studentsData[studentId] = { studentInfo: req.body };
    console.log(`[SERVER] Session started for ${req.body.fullName}: ${studentId}`);
    res.json({ success: true, studentId });
});

app.post('/api/questions', async (req, res) => {
    const { studentId, answers } = req.body;
    
    if (!studentId || !studentsData[studentId]) {
        return res.status(404).json({ success: false, message: "Session expired." });
    }

    studentsData[studentId].questions = answers;
    const combinedProfile = { ...studentsData[studentId].studentInfo, ...answers };

    const aiResult = await generateCareerPathWithAI(combinedProfile);

    if (aiResult) {
        studentsData[studentId].aiResult = aiResult;
        res.json({ success: true, studentId });
    } else {
        res.status(500).json({ success: false, message: "AI recommendation failed." });
    }
});

app.get('/api/results/:studentId', (req, res) => {
    const data = studentsData[req.params.studentId];
    if (!data || !data.aiResult) {
        return res.status(404).json({ success: false, message: "Result not found." });
    }
    
    // Return AI results and the full profile (including merged questions)
    res.json({ 
        success: true, 
        result: data.aiResult, 
        studentInfo: { ...data.studentInfo, ...data.questions } 
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Fallback data in case the API fails
const MOCK_AI_RESPONSE = {
    "topCareers": [
        { "title": "Strategic Consultant", "matchScore": "95%", "reasoning": "High aptitude for logical breaking down of complex tasks and focus on influential outcomes." },
        { "title": "User Experience Researcher", "matchScore": "88%", "reasoning": "Strong interest in human behavior combined with visual communication preferences." },
        { "title": "Organizational Psychologist", "matchScore": "82%", "reasoning": "Ideal for those who value societal impact and helping individuals within systems." }
    ],
    "bestCareerRoadmap": {
        "careerTitle": "Strategic Consultant",
        "description": "A path focused on solving high-level business and social organizational challenges.",
        "phases": [
            { "title": "Phase 1: Analytical Foundations", "details": ["Master critical thinking frameworks.", "Learn basic market research methods."] },
            { "title": "Phase 2: Industry Expertise", "details": ["Focus on a specific sector (e.g., Tech or Law).", "Develop case-study presentation skills."] },
            { "title": "Phase 3: Client Portfolio", "details": ["Work on live internship projects.", "Build a portfolio of problem-solving reports."] },
            { "title": "Phase 4: Advanced Leadership", "details": ["Get certified in Project Management.", "Apply for junior analyst roles at top firms."] }
        ]
    }
};