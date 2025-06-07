// Filename: server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
// path is NOT needed here as Express will NOT serve static files.
// Render and Netlify will handle static file serving.

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS settings.
// This is crucial for allowing your frontend (on clueadmin/cluedetective subdomains)
// to connect to this backend (on api.akalusa.me).
// The `origin` array below contains placeholder values.
// You MUST UPDATE these in Phase 5 after you get your actual live URLs.
const io = new Server(server, {
    cors: {
        origin: [
            "https://clueadmin.akalusa.me",
            "https://cluedetective.akalusa.me",
            "https://clueapi.akalusa.me" // Your backend's own subdomain
        ],
        methods: ["GET", "POST"]
    }
});
});

// Render will automatically set a PORT environment variable for your application.
// We use process.env.PORT to correctly pick up that port.
const PORT = process.env.PORT || 3000;

// --- Game State Variables (These will be stored in server memory) ---
// This is where the server keeps track of all teams' progress and the correct answer.
let teamStates = {}; // Stores the current state of each team's notebook
let accusations = {}; // Stores details of any made accusations
let correctAnswer = { // Stores the correct solution set by the Game Master
    suspect: null,
    location: null,
    tool: null
};

// --- Socket.IO Connection Handling ---
// This block defines what happens when clients (notebooks, GM dashboard) connect
// and send/receive data.
io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);

    // When a new client connects, send them the current game state and correct answer.
    socket.emit('initial_state', { teamStates, accusations, correctAnswer });

    // Listen for updates from a team's notebook (e.g., checkbox clicks, log entries).
    socket.on('update_notebook_state', (data) => {
        const { teamId, state } = data;
        if (teamId && state) {
            teamStates[teamId] = state; // Update the server's record for this team
            // Broadcast the update to all connected clients (especially the GM dashboard).
            io.emit('team_state_updated', { teamId, state });
            console.log(`State updated for team: ${state.teamName || teamId}`);
        
    });

    // Listen for the Game Master setting the correct answer.
    socket.on('set_correct_answer', (answer) => {
        correctAnswer = answer; // Update the server's stored correct answer
        // Notify all connected clients (useful if multiple GMs are present, or just for consistency).
        io.emit('correct_answer_updated', correctAnswer);
        console.log("Correct answer set:", correctAnswer);
    });

    // Listen for a team making a final accusation.
    socket.on('make_accusation', (data) => {
        const { teamId, teamName, accusation } = data;
        if (teamId && accusation) {
            // Check if the accusation matches the correct answer set by the GM.
            const isCorrect = (
                correctAnswer.suspect === accusation.suspect &&
                correctAnswer.location === accusation.location &&
                correctAnswer.tool === accusation.tool
            );

            // Store the accusation along with its correctness.
            accusations[teamId] = { teamName: teamName || teamId, accusation, isCorrect };
            // Notify all connected clients (especially the GM dashboard) about the accusation.
            io.emit('accusation_made', { teamId, teamName: teamName || teamId, accusation, isCorrect });
            console.log(`Accusation made by team ${teamName || teamId}:`, accusation, `Correct: ${isCorrect}`);
        }
    });

    // Handle client disconnection.
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

// Start the server listening on the defined port.
// This will be the port provided by Render (process.env.PORT).
server.listen(PORT, () => {
    console.log(`Socket.IO server running on port ${PORT}`);
    console.log(`This server is designed to be deployed on a PaaS like Render.`);
});