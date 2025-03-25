// Learn Multiplication Game

// Debug helper function
function logError(location, error) {
    console.error(`Error in ${location}:`, error);
    // Create a visible error message for debugging (will be removed after 5 seconds)
    const errorMsg = document.createElement('div');
    errorMsg.style.position = 'fixed';
    errorMsg.style.bottom = '10px';
    errorMsg.style.right = '10px';
    errorMsg.style.backgroundColor = 'rgba(239, 68, 68, 0.9)';
    errorMsg.style.color = 'white';
    errorMsg.style.padding = '10px';
    errorMsg.style.borderRadius = '5px';
    errorMsg.style.maxWidth = '80%';
    errorMsg.style.zIndex = '9999';
    errorMsg.textContent = `Error in ${location}: ${error.message || 'Unknown error'}`;
    document.body.appendChild(errorMsg);
    
    // Remove after 5 seconds
    setTimeout(() => {
        if (errorMsg.parentNode) {
            errorMsg.parentNode.removeChild(errorMsg);
        }
    }, 5000);
    
    return error; // Return for chaining
}

// Game state
const gameState = {
    currentScreen: 'selection', // selection, game, results
    selectedTable: null,
    isMixedMode: false,
    mixedTables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    markedTables: new Set(), // Store marked tables
    score: 0,
    questionsAnswered: 0,
    questionsCorrect: 0,
    totalQuestions: 10, // Default, now configurable
    timeLimit: 10, // Default time limit, now configurable
    currentQuestion: null,
    correctAnswer: null,
    options: [],
    timeRemaining: 10,
    timerInterval: null,
    isTransitioning: false, // Add flag to prevent simultaneous transitions
    lastActionTime: Date.now(), // Track last action time to detect hangs
    soundEnabled: true // Sound enabled by default
};

// DOM Elements
const screens = {
    selection: document.getElementById('selection-screen'),
    game: document.getElementById('game-screen'),
    results: document.getElementById('results-screen')
};

// Get DOM elements
const tableButtons = document.querySelectorAll('.table-btn');
const startMixedButton = document.getElementById('start-mixed');
const questionCountSlider = document.getElementById('question-count');
const questionCountDisplay = document.getElementById('question-count-display');
const timeLimitSlider = document.getElementById('time-limit');
const timeLimitDisplay = document.getElementById('time-limit-display');
const currentTableDisplay = document.getElementById('current-table');
const scoreDisplay = document.getElementById('score');
const questionProgressDisplay = document.getElementById('question-progress');
const timerDisplay = document.getElementById('timer');
const timerBar = document.getElementById('timer-bar');
const questionDisplay = document.getElementById('question');
const answerButtons = document.querySelectorAll('.answer-btn');
const feedbackDisplay = document.getElementById('feedback');
const backToMenuButton = document.getElementById('back-to-menu');
const resultsContent = document.getElementById('results-content');
const practiceAgainButton = document.getElementById('practice-again');
const returnToMenuButton = document.getElementById('return-to-menu');

// Audio elements
const correctSound = document.getElementById('correct-sound');
const wrongSound = document.getElementById('wrong-sound');
const timerTickSound = document.getElementById('timer-tick');

// Add Sound Toggle Button
const soundToggleButton = document.getElementById('sound-toggle');
const soundOnIcon = document.getElementById('sound-on-icon');
const soundOffIcon = document.getElementById('sound-off-icon');

// Helper function for safe audio playback
function playSoundSafely(audioElement) {
    if (!audioElement) return;
    
    // Check if sound is enabled before attempting to play
    if (!gameState.soundEnabled) return;
    
    try {
        // Reset the audio to make sure it can play again
        audioElement.pause();
        audioElement.currentTime = 0;
        
        // Create a small delay before playing to ensure audio context is ready
        setTimeout(() => {
            try {
                // Create a promise to play the sound
                const playPromise = audioElement.play();
                
                // Handle the promise to catch any errors
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        // If autoplay was prevented, try once more with user interaction already happened
                        if (error.name === 'NotAllowedError') {
                            // Log the error but don't show to user - this is expected on first play
                            console.warn('Audio autoplay prevented by browser policy:', error);
                            
                            // We'll just silently fail if audio doesn't play on first question
                            // No need to add event listeners or show errors to the user
                            // This prevents unexpected navigation to selection screen
                        } else {
                            console.warn('Non-critical audio playback error:', error);
                            // Don't use logError which can trigger more visible disruption
                        }
                    });
                }
            } catch (e) {
                console.warn('Audio play attempt failed:', e);
                // Don't use logError to prevent cascading issues
            }
        }, 50); // Small delay to ensure browser is ready
    } catch (e) {
        console.warn('Audio playback setup failed:', e);
        // Don't use logError to prevent cascading issues
    }
}

// Function to preload and initialize audio
function initAudio() {
    try {
        const audioInitButton = document.getElementById('enable-audio');
        const audioInitContainer = document.getElementById('audio-init-container');
        
        // Function to initialize audio on user interaction
        const enableAudio = () => {
            // Hide the audio initialization container after use
            if (audioInitContainer) {
                audioInitContainer.style.display = 'none';
            }
            
            // Play and immediately pause all sounds to initialize them
            [correctSound, wrongSound, timerTickSound].forEach(sound => {
                if (sound) {
                    // Set volume to 0 to avoid hearing the sounds during initialization
                    const originalVolume = sound.volume;
                    sound.volume = 0;
                    
                    // Play and immediately pause to initialize
                    const promise = sound.play();
                    if (promise !== undefined) {
                        promise.then(() => {
                            sound.pause();
                            sound.currentTime = 0;
                            sound.volume = originalVolume; // Restore original volume
                        }).catch(e => {
                            // Ignore errors, we'll try again on actual gameplay
                            sound.volume = originalVolume; // Restore original volume
                        });
                    }
                }
            });
            
            // Remove the event listeners after first interaction
            document.removeEventListener('click', enableAudio);
            document.removeEventListener('keydown', enableAudio);
            if (audioInitButton) {
                audioInitButton.removeEventListener('click', enableAudio);
            }
            
            // Set a flag in sessionStorage to remember audio was initialized
            try {
                sessionStorage.setItem('audioInitialized', 'true');
            } catch (e) {
                // Ignore if sessionStorage isn't available
            }
            
            console.log('Audio initialized');
        };
        
        // Add dedicated event listener to the button
        if (audioInitButton) {
            audioInitButton.addEventListener('click', enableAudio);
        }
        
        // Add general event listeners for first user interaction as fallback
        document.addEventListener('click', enableAudio);
        document.addEventListener('keydown', enableAudio);
        
        // Check if audio was already initialized in this session
        try {
            if (sessionStorage.getItem('audioInitialized') === 'true' && audioInitContainer) {
                audioInitContainer.style.display = 'none';
            }
        } catch (e) {
            // Ignore if sessionStorage isn't available
        }
        
        // Initialize sound toggle button state
        initSoundToggle();
    } catch (e) {
        logError('initAudio', e);
    }
}

// Function to toggle sound on/off
function toggleSound() {
    try {
        // Toggle the sound state
        gameState.soundEnabled = !gameState.soundEnabled;
        
        // Update UI
        updateSoundToggleUI();
        
        // Save preference to localStorage
        try {
            localStorage.setItem('soundEnabled', gameState.soundEnabled ? 'true' : 'false');
        } catch (e) {
            // Ignore if localStorage isn't available
        }
        
        console.log(`Sound ${gameState.soundEnabled ? 'enabled' : 'disabled'}`);
    } catch (e) {
        console.error('Error toggling sound:', e);
    }
}

// Update sound toggle button UI
function updateSoundToggleUI() {
    if (soundToggleButton) {
        if (gameState.soundEnabled) {
            soundOnIcon.classList.remove('hidden');
            soundOffIcon.classList.add('hidden');
            soundToggleButton.classList.remove('sound-disabled');
            soundToggleButton.setAttribute('aria-label', 'Disable sound');
        } else {
            soundOnIcon.classList.add('hidden');
            soundOffIcon.classList.remove('hidden');
            soundToggleButton.classList.add('sound-disabled');
            soundToggleButton.setAttribute('aria-label', 'Enable sound');
        }
    }
}

// Initialize sound toggle button state
function initSoundToggle() {
    // Get saved preference from localStorage
    try {
        const savedPreference = localStorage.getItem('soundEnabled');
        if (savedPreference !== null) {
            gameState.soundEnabled = savedPreference === 'true';
            updateSoundToggleUI();
        }
    } catch (e) {
        // Ignore if localStorage isn't available
    }
    
    // Add event listener to toggle button
    if (soundToggleButton) {
        soundToggleButton.addEventListener('click', toggleSound);
    }
}

// Initialize the game
function initGame() {
    try {
        // Initialize audio
        initAudio();
        
        // Clear any existing state on first launch
        if (!sessionStorage.getItem('hasLaunched')) {
            localStorage.removeItem('markedTables');
            sessionStorage.setItem('hasLaunched', 'true');
        }
        
        // Load marked tables from localStorage first
        const savedMarkedTables = localStorage.getItem('markedTables');
        if (savedMarkedTables) {
            gameState.markedTables = new Set(JSON.parse(savedMarkedTables));
        } else {
            gameState.markedTables = new Set(); // Ensure empty set for fresh start
        }
        
        // Initialize question count slider
        if (questionCountSlider && questionCountDisplay) {
            // Update the display when slider changes
            questionCountSlider.addEventListener('input', () => {
                const value = questionCountSlider.value;
                questionCountDisplay.textContent = value;
                gameState.totalQuestions = parseInt(value);
            });
            
            // Set initial value
            gameState.totalQuestions = parseInt(questionCountSlider.value);
            questionCountDisplay.textContent = questionCountSlider.value;
        }
        
        // Initialize time limit slider
        if (timeLimitSlider && timeLimitDisplay) {
            // Update the display when slider changes
            timeLimitSlider.addEventListener('input', () => {
                const value = timeLimitSlider.value;
                timeLimitDisplay.textContent = value;
                gameState.timeLimit = parseInt(value);
            });
            
            // Set initial value
            gameState.timeLimit = parseInt(timeLimitSlider.value);
            timeLimitDisplay.textContent = timeLimitSlider.value;
        }
        
        // First update the UI for marked tables
        updateMarkedTablesUI();
        
        // Then add event listeners for table buttons
        tableButtons.forEach(button => {
            if (!button) return; // Skip if button is null
            
            const table = parseInt(button.dataset.table);
            if (isNaN(table)) {
                console.warn('Invalid table number in data-table attribute');
                return;
            }
            
            // Add mark button to each table button
            const markButton = document.createElement('button');
            markButton.className = 'mark-btn absolute top-1 right-1 w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center';
            markButton.innerHTML = gameState.markedTables.has(table) ? '✓' : '+';
            markButton.style.display = gameState.markedTables.has(table) ? 'flex' : 'none';
            markButton.setAttribute('aria-label', `Include ${table} times table in mixed practice`);
            
            // Show mark button only on parent button hover
            const showMarkButton = () => {
                markButton.style.display = 'flex';
            };
            
            const hideMarkButton = () => {
                if (!gameState.markedTables.has(table)) {
                    markButton.style.display = 'none';
                }
            };
            
            button.addEventListener('mouseenter', showMarkButton);
            button.addEventListener('mouseleave', hideMarkButton);
            
            // Toggle mark on click
            markButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering the table button click
                e.preventDefault(); // Prevent any default button behavior
                toggleMarkTable(table);
            });
            
            // Ensure button has relative positioning for absolute positioned mark button
            button.style.position = 'relative';
            button.appendChild(markButton);
            
            // Table selection click handler - only trigger if the click wasn't on the mark button
            button.addEventListener('click', (e) => {
                // If the click was on the mark button or its children, don't start the practice
                if (e.target.closest('.mark-btn')) {
                    return;
                }
                gameState.selectedTable = table;
                gameState.isMixedMode = false;
                startGame();
            });
        });
        
        // Add event listener to mixed mode button
        if (startMixedButton) {
            startMixedButton.addEventListener('click', () => {
                gameState.isMixedMode = true;
                gameState.selectedTable = null;
                startGame();
            });
        }
        
        // Add event listeners to game controls
        if (backToMenuButton) {
            backToMenuButton.addEventListener('click', showSelectionScreen);
        }
        if (practiceAgainButton) {
            practiceAgainButton.addEventListener('click', () => startGame());
        }
        if (returnToMenuButton) {
            returnToMenuButton.addEventListener('click', showSelectionScreen);
        }
        
        // Add event listeners to answer buttons
        answerButtons.forEach(button => {
            button.addEventListener('click', () => {
                if (button.disabled) return;
                checkAnswer(parseInt(button.textContent));
            });
        });
    } catch (e) {
        logError('initGame', e);
    }
}

// Function to toggle marking a table
function toggleMarkTable(table) {
    try {
        if (gameState.markedTables.has(table)) {
            gameState.markedTables.delete(table);
        } else {
            gameState.markedTables.add(table);
        }
        
        // Save to localStorage - if markedTables is empty, remove the item completely
        if (gameState.markedTables.size === 0) {
            localStorage.removeItem('markedTables');
        } else {
            localStorage.setItem('markedTables', JSON.stringify(Array.from(gameState.markedTables)));
        }
        
        // Update UI
        updateMarkedTablesUI();
    } catch (error) {
        logError('toggleMarkTable', error);
    }
}

// Update UI to reflect marked tables
function updateMarkedTablesUI() {
    try {
        tableButtons.forEach(button => {
            const table = parseInt(button.dataset.table);
            const markBtn = button.querySelector('.mark-btn');
            
            if (!markBtn) {
                console.warn(`Mark button not found for table ${table}`);
                return;
            }
            
            if (gameState.markedTables.has(table)) {
                button.classList.add('opacity-50');
                markBtn.style.display = 'flex';
                markBtn.classList.add('bg-green-500', 'text-white');
                markBtn.classList.remove('bg-gray-200');
                markBtn.title = 'Click to remove from mixed practice';
                markBtn.innerHTML = '✓';
            } else {
                button.classList.remove('opacity-50');
                markBtn.style.display = 'none';
                markBtn.classList.remove('bg-green-500', 'text-white');
                markBtn.classList.add('bg-gray-200');
                markBtn.title = 'Click to include in mixed practice';
                markBtn.innerHTML = '+';
            }
        });
    } catch (error) {
        logError('updateMarkedTablesUI', error);
    }
}

// Show a specific screen
function showScreen(screenName) {
    // Hide all screens
    Object.values(screens).forEach(screen => {
        screen.classList.add('hidden');
    });
    
    // Show the requested screen
    screens[screenName].classList.remove('hidden');
    
    // Update game state
    gameState.currentScreen = screenName;
}

// Show selection screen
function showSelectionScreen() {
    // Clear any running timers
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
    
    // Reset game state
    gameState.score = 0;
    gameState.questionsAnswered = 0;
    gameState.questionsCorrect = 0;
    gameState.currentQuestion = null;
    gameState.correctAnswer = null;
    gameState.options = [];
    gameState.timeRemaining = gameState.timeLimit;
    gameState.isTransitioning = false;
    gameState.lastActionTime = Date.now();
    
    // Show selection screen
    showScreen('selection');
}

// Start the game
function startGame() {
    // Reset game state
    gameState.score = 0;
    gameState.questionsAnswered = 0;
    gameState.questionsCorrect = 0;
    
    // Update UI
    scoreDisplay.textContent = gameState.score;
    
    // Update current table display
    if (gameState.isMixedMode) {
        currentTableDisplay.textContent = 'Mixed';
    } else {
        currentTableDisplay.textContent = `${gameState.selectedTable}×`;
    }
    
    // Try to initialize audio again on game start
    [correctSound, wrongSound, timerTickSound].forEach(sound => {
        if (sound) {
            sound.load();
        }
    });
    
    // Show game screen
    showScreen('game');
    
    // Generate first question
    generateQuestion();
}

// Generate a new question
function generateQuestion() {
    try {
        // Reset UI state
        feedbackDisplay.classList.add('hidden');
        answerButtons.forEach(button => {
            button.disabled = false;
            button.classList.remove('correct-answer', 'wrong-answer');
        });
        timerDisplay.classList.remove('timer-warning');
        
        // Determine which table to use
        let table;
        if (gameState.isMixedMode) {
            // In mixed mode, use only marked tables
            const availableTables = Array.from(gameState.markedTables);
            if (availableTables.length === 0) {
                throw new Error('Please mark at least one table for mixed practice');
            }
            table = availableTables[Math.floor(Math.random() * availableTables.length)];
        } else {
            table = gameState.selectedTable;
        }
        
        if (!table) {
            throw new Error('No table selected');
        }
        
        // Generate multiplicand (1-12)
        const multiplicand = Math.floor(Math.random() * 12) + 1;
        
        // Calculate correct answer
        gameState.correctAnswer = table * multiplicand;
        
        // Update question display
        const questionText = `${table} × ${multiplicand} = ?`;
        questionDisplay.textContent = questionText;
        
        // Generate wrong answers
        let wrongAnswers = [];
        const maxAttempts = 20; // Prevent infinite loop
        let attempts = 0;
        
        while (wrongAnswers.length < 3 && attempts < maxAttempts) {
            attempts++;
            // Generate a wrong answer within ±20 of correct answer
            let wrongAnswer;
            const variation = Math.floor(Math.random() * 20) + 1;
            if (Math.random() < 0.5) {
                wrongAnswer = gameState.correctAnswer + variation;
            } else {
                wrongAnswer = gameState.correctAnswer - variation;
            }
            
            // Ensure wrong answer is positive and not equal to correct answer
            if (wrongAnswer > 0 && wrongAnswer !== gameState.correctAnswer && !wrongAnswers.includes(wrongAnswer)) {
                wrongAnswers.push(wrongAnswer);
            }
        }
        
        // Fill remaining slots if needed
        while (wrongAnswers.length < 3) {
            const fallbackWrong = gameState.correctAnswer + (wrongAnswers.length + 1);
            if (!wrongAnswers.includes(fallbackWrong)) {
                wrongAnswers.push(fallbackWrong);
            }
        }
        
        // Combine all answers and shuffle
        const allAnswers = [gameState.correctAnswer, ...wrongAnswers];
        for (let i = allAnswers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allAnswers[i], allAnswers[j]] = [allAnswers[j], allAnswers[i]];
        }
        
        // Update answer buttons
        answerButtons.forEach((button, index) => {
            if (index < allAnswers.length) {
                button.textContent = allAnswers[index];
                button.classList.remove('hidden');
            } else {
                button.classList.add('hidden');
            }
        });
        
        // Update progress
        updateQuestionProgress();
        
        // Reset and start timer
        gameState.timeRemaining = gameState.timeLimit;
        timerDisplay.textContent = gameState.timeRemaining;
        timerBar.style.width = '100%';
        startTimer();
        
        // Clear transitioning flag
        gameState.isTransitioning = false;
        
    } catch (error) {
        logError('generateQuestion', error);
        // Instead of showing selection screen, try to generate a new question
        setTimeout(() => {
            if (gameState.currentScreen === 'game') {
                generateQuestion();
            }
        }, 1000);
    }
}

// Update the question progress display
function updateQuestionProgress() {
    if (questionProgressDisplay) {
        questionProgressDisplay.textContent = `${gameState.questionsAnswered + 1}/${gameState.totalQuestions}`;
    }
}

// Start the timer
function startTimer() {
    try {
        // Ensure any existing timer is cleared first
        if (gameState.timerInterval) {
            clearInterval(gameState.timerInterval);
            gameState.timerInterval = null;
        }
        
        // Update timer every second
        gameState.timerInterval = setInterval(() => {
            try {
                gameState.timeRemaining--;
                timerDisplay.textContent = gameState.timeRemaining;
                
                // Update timer bar
                const percentage = (gameState.timeRemaining / gameState.timeLimit) * 100;
                timerBar.style.width = `${percentage}%`;
                
                // Add warning class when time is running low
                if (gameState.timeRemaining <= 3) {
                    timerDisplay.classList.add('timer-warning');
                    if (gameState.timeRemaining <= 3 && gameState.timeRemaining > 0) {
                        playSoundSafely(timerTickSound);
                    }
                }
                
                // Time's up
                if (gameState.timeRemaining <= 0) {
                    if (gameState.timerInterval) {
                        clearInterval(gameState.timerInterval);
                        gameState.timerInterval = null;
                    }
                    timeUp();
                }
            } catch (e) {
                logError('timer interval', e);
                clearInterval(gameState.timerInterval);
                gameState.timerInterval = null;
            }
        }, 1000);
    } catch (e) {
        logError('startTimer', e);
    }
}

// Handle time's up
function timeUp() {
    // Disable all answer buttons
    answerButtons.forEach(button => {
        button.disabled = true;
    });
    
    // Highlight correct answer
    answerButtons.forEach(button => {
        if (parseInt(button.textContent) === gameState.correctAnswer) {
            button.classList.add('correct-answer');
        }
    });
    
    // Show feedback
    feedbackDisplay.textContent = `Time's up! The correct answer is ${gameState.correctAnswer}.`;
    feedbackDisplay.className = 'text-center p-4 rounded-lg mb-6 feedback-wrong';
    feedbackDisplay.classList.remove('hidden');
    
    // Play wrong sound
    playSoundSafely(wrongSound);
    
    // Update questions answered
    gameState.questionsAnswered++;
    
    // Wait a moment before next question
    setTimeout(() => {
        safeTransition();
    }, 2000);
}

// Check the player's answer
function checkAnswer(playerAnswer) {
    // Clear timer
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
    
    // Disable all answer buttons
    answerButtons.forEach(button => {
        button.disabled = true;
    });
    
    // Check if answer is correct
    const isCorrect = playerAnswer === gameState.correctAnswer;
    
    // Update game state
    gameState.questionsAnswered++;
    
    if (isCorrect) {
        // Correct answer
        gameState.questionsCorrect++;
        gameState.score += 10;
        
        // Update score display
        scoreDisplay.textContent = gameState.score;
        
        // Highlight correct answer
        answerButtons.forEach(button => {
            if (parseInt(button.textContent) === gameState.correctAnswer) {
                button.classList.add('correct-answer');
            }
        });
        
        // Show feedback
        feedbackDisplay.textContent = `Correct! +10 points`;
        feedbackDisplay.className = 'text-center p-4 rounded-lg mb-6 feedback-correct';
        
        // Play correct sound
        playSoundSafely(correctSound);
        
        // Create celebration effect
        createConfetti(10);
    } else {
        // Wrong answer
        // Highlight correct and wrong answers
        answerButtons.forEach(button => {
            if (parseInt(button.textContent) === gameState.correctAnswer) {
                button.classList.add('correct-answer');
            } else if (parseInt(button.textContent) === playerAnswer) {
                button.classList.add('wrong-answer');
            }
        });
        
        // Show feedback
        feedbackDisplay.textContent = `Not quite. The correct answer is ${gameState.correctAnswer}.`;
        feedbackDisplay.className = 'text-center p-4 rounded-lg mb-6 feedback-wrong';
        
        // Play wrong sound
        playSoundSafely(wrongSound);
    }
    
    // Show feedback
    feedbackDisplay.classList.remove('hidden');
    
    // Wait a moment before next question
    setTimeout(() => {
        safeTransition();
    }, 2000);
}

// Show results
function showResults() {
    // Calculate accuracy
    const accuracy = Math.round((gameState.questionsCorrect / gameState.questionsAnswered) * 100);
    
    // Create results content
    let html = `
        <div class="bg-blue-50 p-6 rounded-lg mb-6">
            <div class="grid grid-cols-2 gap-4 max-w-md mx-auto">
                <div class="bg-blue-100 p-4 rounded-lg text-center">
                    <p class="text-blue-800 font-bold">Score</p>
                    <p class="text-2xl font-bold text-blue-700">${gameState.score}</p>
                </div>
                <div class="bg-green-100 p-4 rounded-lg text-center">
                    <p class="text-green-800 font-bold">Accuracy</p>
                    <p class="text-2xl font-bold text-green-700">${accuracy}%</p>
                </div>
                <div class="bg-purple-100 p-4 rounded-lg text-center">
                    <p class="text-purple-800 font-bold">Correct</p>
                    <p class="text-2xl font-bold text-purple-700">${gameState.questionsCorrect}/${gameState.questionsAnswered}</p>
                </div>
                <div class="bg-yellow-100 p-4 rounded-lg text-center">
                    <p class="text-yellow-800 font-bold">Table</p>
                    <p class="text-2xl font-bold text-yellow-700">${gameState.isMixedMode ? 'Mixed' : gameState.selectedTable + '×'}</p>
                </div>
            </div>
        </div>
    `;
    
    // Add encouragement message based on performance
    if (accuracy >= 90) {
        html += `<p class="text-lg text-blue-600 font-bold mb-2 text-center">Outstanding work! You're a multiplication master!</p>`;
    } else if (accuracy >= 70) {
        html += `<p class="text-lg text-blue-600 font-bold mb-2 text-center">Great job! You're getting really good at this!</p>`;
    } else {
        html += `<p class="text-lg text-blue-600 font-bold mb-2 text-center">Good effort! Keep practicing to improve your skills.</p>`;
    }
    
    // Update results content
    resultsContent.innerHTML = html;
    
    // Show results screen
    showScreen('results');
    
    // Create celebration effect if score is good
    if (accuracy >= 70) {
        createConfetti(50);
    }
}

// Create confetti effect for celebrations
function createConfetti(count) {
    try {
        const container = document.querySelector('body');
        // Store references to confetti elements for cleanup
        const confettiElements = [];
        
        for (let i = 0; i < count; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            
            // Random position, color, and size
            confetti.style.left = `${Math.random() * 100}vw`;
            confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
            confetti.style.width = `${5 + Math.random() * 10}px`;
            confetti.style.height = confetti.style.width;
            
            // Random animation duration and delay
            confetti.style.animationDuration = `${2 + Math.random() * 2}s`;
            confetti.style.animationDelay = `${Math.random() * 0.5}s`;
            
            container.appendChild(confetti);
            confettiElements.push(confetti);
        }
        
        // Remove confetti after animation completes - use a single timeout for all elements
        setTimeout(() => {
            confettiElements.forEach(element => {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
            });
        }, 5000); // Increased from 3000 to 5000 to ensure all animations complete
    } catch (e) {
        logError('createConfetti', e);
    }
}

// Function to safely transition to next question or results
function safeTransition() {
    // If already transitioning, don't start another transition
    if (gameState.isTransitioning) {
        console.log("Already transitioning, ignoring request");
        return;
    }
    
    // Set transitioning flag
    gameState.isTransitioning = true;
    
    try {
        // Update last action time
        gameState.lastActionTime = Date.now();
        
        // Check if we should show results
        if (gameState.questionsAnswered >= gameState.totalQuestions) {
            showResults();
        } else {
            generateQuestion();
        }
    } catch (e) {
        console.error('Error in safeTransition:', e);
        // Instead of resetting game, try to recover by generating a new question
        try {
            if (gameState.currentScreen === 'game') {
                setTimeout(() => generateQuestion(), 1000);
            } else {
                resetGame();
            }
        } catch (innerError) {
            console.error('Recovery failed:', innerError);
            resetGame();
        }
    } finally {
        // Clear transitioning flag after a delay
        setTimeout(() => {
            gameState.isTransitioning = false;
        }, 2000);
    }
}

// Complete game reset function
function resetGame() {
    try {
        // Clear any running timers
        if (gameState.timerInterval) {
            clearInterval(gameState.timerInterval);
            gameState.timerInterval = null;
        }
        
        // Reset game state
        gameState.score = 0;
        gameState.questionsAnswered = 0;
        gameState.questionsCorrect = 0;
        gameState.currentQuestion = null;
        gameState.correctAnswer = null;
        gameState.options = [];
        gameState.timeRemaining = gameState.timeLimit; // Use the custom time limit
        gameState.isTransitioning = false;
        gameState.lastActionTime = Date.now();
        
        // Show selection screen without recursion
        showScreen('selection');
    } catch (e) {
        logError('resetGame', e);
        // As a last resort, reload the page
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }
}

// Add a watchdog to detect and recover from hangs
function initWatchdog() {
    setInterval(() => {
        const now = Date.now();
        // If more than 30 seconds passed since last action and we're in game screen
        if (now - gameState.lastActionTime > 30000 && gameState.currentScreen === 'game') {
            console.warn("Watchdog detected possible hang, resetting game");
            resetGame();
        }
    }, 5000); // Check every 5 seconds
}

// Initialize the game when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initGame();
    initWatchdog();
});

// Add a fallback initialization in case the DOMContentLoaded event already fired
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => {
        initGame();
        initWatchdog();
    }, 100);
}