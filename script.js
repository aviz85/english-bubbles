// Game configuration
const config = {
    bubbleSpeed: 0.5,       // האטת מהירות הבועות (היה 1)
    bubbleInterval: 3000,   // הגדלת הזמן בין בועות חדשות (היה 2000)
    maxBubbles: 5,          // הפחתת מספר הבועות המקסימלי (היה 8)
    initialLives: 3,        // Number of lives player starts with
    arrowSpeed: 10,         // Speed of the arrows
    debugMode: false,        // Enable debug features
    fuzzyMatching: true,    // Enable fuzzy matching for word recognition
    superDebugMode: true,   // Enable super verbose logging
    words: [                // מילים קלות לזיהוי
        'cat', 'dog', 'red', 'blue', 'one', 'two', 'yes', 'no',
        'sun', 'moon', 'car', 'go', 'up', 'down', 'ball', 'book'
    ]
};

// Game state
const gameState = {
    activeBubbles: [],
    score: 0,
    lives: config.initialLives,
    isGameRunning: false,
    bubbleCreationInterval: null,
    speechRecognition: null,
    lastRecognizedWord: ''
};

// DOM Elements
const elements = {
    gameContainer: document.getElementById('game-container'),
    bubbleContainer: document.getElementById('bubble-container'),
    cannon: document.getElementById('cannon'),
    scoreValue: document.getElementById('score-value'),
    livesValue: document.getElementById('lives-value'),
    startScreen: document.getElementById('start-screen'),
    gameOverScreen: document.getElementById('game-over-screen'),
    startButton: document.getElementById('start-button'),
    restartButton: document.getElementById('restart-button'),
    finalScore: document.getElementById('final-score'),
    recognizedWords: document.getElementById('recognized-words'),
    lastWordValue: document.getElementById('last-word-value'),
    speechDebug: document.getElementById('speech-debug')
};

// Initialize speech recognition
function initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        // Create speech recognition instance
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        gameState.speechRecognition = new SpeechRecognition();
        
        // Configure speech recognition
        gameState.speechRecognition.continuous = true;
        gameState.speechRecognition.interimResults = true;
        gameState.speechRecognition.lang = 'en-US';
        
        // More aggressive recognition settings
        if (gameState.speechRecognition.maxAlternatives !== undefined) {
            gameState.speechRecognition.maxAlternatives = 5; // Get multiple interpretations
        }

        if (config.superDebugMode) {
            console.log('Speech recognition initialized with settings:', {
                continuous: gameState.speechRecognition.continuous,
                interimResults: gameState.speechRecognition.interimResults,
                maxAlternatives: gameState.speechRecognition.maxAlternatives,
                lang: gameState.speechRecognition.lang
            });
        }

        // Handle recognition results
        gameState.speechRecognition.onresult = (event) => {
            if (config.superDebugMode) {
                console.log('Speech recognition event:', event);
                console.log('Results count:', event.results.length);
            }
            
            const result = event.results[event.results.length - 1];
            const transcript = result[0].transcript.trim().toLowerCase();
            
            if (config.superDebugMode) {
                console.log('Latest transcript:', transcript);
                console.log('Is final:', result.isFinal);
                console.log('Confidence:', result[0].confidence);
            }
            
            // Update debug display with full transcript
            if (config.debugMode) {
                elements.recognizedWords.textContent = transcript;
            }
            
            // Check for SpeechRecognitionAlternative
            let alternativesChecked = false;
            
            // If this is a final result
            if (result.isFinal) {
                // Split transcript into words
                const words = transcript.split(' ');
                // Get the last word from the transcript
                const lastWord = words[words.length - 1];
                gameState.lastRecognizedWord = lastWord;
                
                if (config.superDebugMode) {
                    console.log('Words in transcript:', words);
                    console.log('Last word:', lastWord);
                }
                
                // Update debug display
                elements.lastWordValue.textContent = lastWord;
                
                try {
                    // Check the last word first
                    const matchFound = checkForWordMatch(lastWord);
                    
                    if (config.superDebugMode) {
                        console.log('Match found for last word?', matchFound);
                    }
                    
                    // If no match with the last word, try individual words
                    if (!matchFound && words.length > 1) {
                        console.log('Trying each word in transcript...');
                        // Try each individual word
                        for (const word of words) {
                            if (word.length >= 2) {
                                const wordMatch = checkForWordMatch(word);
                                if (wordMatch) {
                                    console.log('Match found for word:', word);
                                    break; // Stop once we found a match
                                }
                            }
                        }
                    }
                    
                    // Try alternatives if available and no match yet
                    if (!matchFound && result.length > 1 && !alternativesChecked) {
                        alternativesChecked = true;
                        console.log('Trying alternative transcripts...');
                        
                        // Loop through alternatives
                        for (let i = 1; i < Math.min(result.length, 5); i++) {
                            const altTranscript = result[i].transcript.trim().toLowerCase();
                            if (config.debugMode) {
                                elements.recognizedWords.textContent += ` (Alt ${i}: ${altTranscript})`;
                            }
                            
                            if (config.superDebugMode) {
                                console.log(`Alternative ${i}:`, altTranscript);
                            }
                            
                            // Check if any word in this alternative matches
                            const altWords = altTranscript.split(' ');
                            for (const word of altWords) {
                                if (word.length >= 2 && checkForWordMatch(word)) {
                                    if (config.superDebugMode) {
                                        console.log('Match found for alternative word:', word);
                                    }
                                    return; // Stop once we found a match
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error in speech recognition processing:', error);
                }
            }
        };

        gameState.speechRecognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            // Update debug display
            elements.recognizedWords.textContent = `Error: ${event.error}`;
            
            if (config.superDebugMode) {
                console.log('Error details:', event);
            }
            
            // Restart recognition if it fails
            if (gameState.isGameRunning) {
                gameState.speechRecognition.start();
            }
        };

        gameState.speechRecognition.onend = () => {
            // Update debug display
            elements.recognizedWords.textContent += ' (Recognition ended, restarting...)';
            
            if (config.superDebugMode) {
                console.log('Speech recognition ended, attempting restart...');
            }
            
            // Restart recognition when it ends
            if (gameState.isGameRunning) {
                gameState.speechRecognition.start();
            }
        };
        
        gameState.speechRecognition.onnomatch = (event) => {
            if (config.superDebugMode) {
                console.log('No speech match event:', event);
            }
        };
        
        gameState.speechRecognition.onaudiostart = () => {
            if (config.superDebugMode) {
                console.log('Audio capture started');
            }
        };
        
        gameState.speechRecognition.onaudioend = () => {
            if (config.superDebugMode) {
                console.log('Audio capture ended');
            }
        };
        
        gameState.speechRecognition.onsoundstart = () => {
            if (config.superDebugMode) {
                console.log('Sound detected');
            }
        };
        
        gameState.speechRecognition.onsoundend = () => {
            if (config.superDebugMode) {
                console.log('Sound ended');
            }
        };
        
        gameState.speechRecognition.onspeechstart = () => {
            if (config.superDebugMode) {
                console.log('Speech started');
            }
        };
        
        gameState.speechRecognition.onspeechend = () => {
            if (config.superDebugMode) {
                console.log('Speech ended');
            }
        };
    } else {
        alert('Speech recognition is not supported in your browser. Please try Chrome or Edge.');
        elements.recognizedWords.textContent = 'Speech recognition not supported';
    }
}

// Create a special debug mode restart function
function restartSpeechRecognition() {
    if (gameState.speechRecognition && gameState.isGameRunning) {
        try {
            gameState.speechRecognition.stop();
            
            // Small delay before restarting
            setTimeout(() => {
                try {
                    if (gameState.isGameRunning) {
                        gameState.speechRecognition.start();
                        if (config.debugMode) {
                            elements.recognizedWords.prepend(document.createElement('div')).textContent = 
                                'Speech recognition restarted';
                        }
                    }
                } catch (error) {
                    console.error('Error restarting recognition:', error);
                }
            }, 300);
        } catch (error) {
            console.error('Error stopping recognition:', error);
        }
    }
}

// Check if a spoken word matches any bubble
function checkForWordMatch(word) {
    let matchFound = false;
    
    // Super debug
    if (config.superDebugMode) {
        console.log('--------- MATCHING WORD ----------');
        console.log('Checking for word match:', word);
        console.log('Active bubbles count:', gameState.activeBubbles.length);
        console.log('Words on screen:', gameState.activeBubbles.map(b => b.word));
    }
    
    // Update debug display
    if (config.debugMode) {
        // Add word to debug history with timestamp
        const time = new Date().toLocaleTimeString();
        const debugEntry = document.createElement('div');
        debugEntry.textContent = `${time}: "${word}"`;
        elements.recognizedWords.prepend(debugEntry);
        
        // Limit debug history to last 5 entries
        while (elements.recognizedWords.childNodes.length > 5) {
            elements.recognizedWords.removeChild(elements.recognizedWords.lastChild);
        }
    }
    
    if (gameState.activeBubbles.length === 0) {
        if (config.superDebugMode) {
            console.log('No active bubbles to match');
        }
        return false;
    }
    
    for (let i = 0; i < gameState.activeBubbles.length; i++) {
        const bubble = gameState.activeBubbles[i];
        
        if (!bubble || !bubble.word) {
            if (config.superDebugMode) {
                console.warn('Invalid bubble at index', i, bubble);
            }
            continue;
        }
        
        // Super debug
        if (config.superDebugMode) {
            console.log(`Comparing "${word}" to bubble word "${bubble.word}"`);
        }
        
        // Exact match
        if (bubble.word.toLowerCase() === word.toLowerCase()) {
            if (config.superDebugMode) {
                console.log('EXACT MATCH FOUND!');
            }
            
            try {
                // הסרה מיידית של הבועה ללא אנימציה כלל
                instantRemoveBubble(bubble);
                matchFound = true;
                break; // Only pop one bubble per word
            } catch (error) {
                console.error('Error removing bubble:', error);
                if (config.debugMode) {
                    const errorDiv = document.createElement('div');
                    errorDiv.textContent = `Error: ${error.message}`;
                    errorDiv.style.color = 'red';
                    elements.recognizedWords.prepend(errorDiv);
                }
            }
        }
        
        // Fuzzy matching if enabled
        if (config.fuzzyMatching && !matchFound) {
            // Simple fuzzy match: check if bubble word contains spoken word or vice versa
            if (bubble.word.toLowerCase().includes(word.toLowerCase()) || 
                word.toLowerCase().includes(bubble.word.toLowerCase())) {
                
                // Words should be at least 2 characters long and 70% similar
                if (bubble.word.length >= 2 && word.length >= 2 && 
                    (bubble.word.length / word.length < 1.3 || word.length / bubble.word.length < 1.3)) {
                    
                    if (config.superDebugMode) {
                        console.log('FUZZY MATCH FOUND!');
                    }
                    
                    // Add visual feedback in debug mode
                    if (config.debugMode) {
                        elements.lastWordValue.textContent = `${word} ≈ ${bubble.word}`;
                    }
                    
                    try {
                        // הסרה מיידית של הבועה ללא אנימציה כלל
                        instantRemoveBubble(bubble);
                        matchFound = true;
                        break;
                    } catch (error) {
                        console.error('Error removing bubble in fuzzy match:', error);
                    }
                }
            }
        }
    }
    
    if (config.superDebugMode) {
        console.log('Match found:', matchFound);
        console.log('--------- END MATCHING ----------');
    }
    
    return matchFound;
}

// הסרה מיידית של הבועה ללא אנימציה
function instantRemoveBubble(bubble) {
    if (config.superDebugMode) {
        console.log('Instantly removing bubble with word:', bubble.word);
    }
    
    try {
        // Verify bubble is valid and in the DOM
        if (!bubble || !bubble.element || !bubble.element.parentNode) {
            console.error('Invalid bubble or already removed:', bubble);
            return;
        }
        
        // הוספת אפקט פיצוץ מהיר
        const hitEffect = document.createElement('div');
        hitEffect.className = 'hit-effect';
        hitEffect.style.left = (bubble.x - 60) + 'px';
        hitEffect.style.top = (bubble.y - 60) + 'px';
        elements.gameContainer.appendChild(hitEffect);
        
        // Play pop sound
        const popSound = new Audio('data:audio/wav;base64,UklGRigCAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQCAACtmYyFfXdxbGZhXVlVUlBOTk5OT1FTVlldYGRpbnN4foOIjpOYnqKmqq2vsrO0tbW0s7KwrqyppqOgm5eTj4uGgn56dnJubGlnZWRjYmJjY2RlaGpscXR4fIGFiY2Rk5ebnZ+goqOjoqKhoJ+dnJqYlpSSj42LiYeEgn98enl3dXVzcnJxcHBwcXFydHV3eXx+gYOGiIqMjpCQkpKSkpKSkI+OjYuKiIaFg4GAfnx7eXh3dXV0c3NycnJzc3R1dnh6e32AgoSGiImLjI2Oj5CQkJCPj4+OjYyLioiHhYSCgH9+fHt6eXh3d3Z2dnZ2d3d4eXp7fH5/gYKEhYaHiImJiouLi4uLi4qKiYmIh4aFhIOCgYB/fn18e3t6enl5eXl5eXl6ent8fX5/gIGCg4SFhYaGhoaGhoaGhoWFhISDgoGBgH9+fn19fHx7e3t7e3t7e3t8fH1+fn9/gICBgYGBgYGBgYGBgYGBgICAgH9/f39+fn5+fn5+fn5+fn5+fn5+fn9/f39/f39/f39/f39/f3+AgICAgICAgICAgICAgICAgICAgH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+AgICA');
        try {
            popSound.play().catch(err => {
                console.log('Pop sound error:', err);
            });
        } catch (e) {
            console.log('Pop sound error:', e);
        }
        
        // הוספת אפקט קצר של הבהוב לפני ההסרה
        bubble.element.style.boxShadow = '0 0 20px 10px rgba(255, 255, 0, 0.8)';
        bubble.element.style.transform = 'scale(1.2)';
        bubble.element.style.opacity = '0.8';
        
        // הסרה מהירה אך עם מעט השהייה לאפקט הויזואלי
        setTimeout(() => {
            try {
                // Remove element
                if (bubble.element.parentNode) {
                    bubble.element.parentNode.removeChild(bubble.element);
                }
                
                // Remove from active bubbles
                const index = gameState.activeBubbles.indexOf(bubble);
                if (index > -1) {
                    gameState.activeBubbles.splice(index, 1);
                }
                
                // Remove hit effect
                setTimeout(() => {
                    if (hitEffect.parentNode) {
                        hitEffect.parentNode.removeChild(hitEffect);
                    }
                }, 300);
                
                if (config.superDebugMode) {
                    console.log('Bubble successfully removed');
                    console.log('Remaining bubbles:', gameState.activeBubbles.length);
                }
            } catch (error) {
                console.error('Error removing bubble:', error);
            }
        }, 100); // השהייה קצרה מאוד, מספיק רק לאפקט
        
        // Increase score
        gameState.score += 10;
        elements.scoreValue.textContent = gameState.score;
        
    } catch (error) {
        console.error('Error in instantRemoveBubble:', error);
    }
}

// Point cannon at a bubble without shooting an arrow
function pointCannonAtBubble(bubble) {
    // Calculate angle between cannon and bubble
    const cannonX = elements.gameContainer.offsetWidth / 2;
    const cannonY = elements.gameContainer.offsetHeight - 20;
    const deltaX = bubble.x - cannonX;
    const deltaY = bubble.y - cannonY;
    const angle = Math.atan2(deltaY, deltaX);
    const degrees = angle * (180 / Math.PI);
    
    // Rotate cannon to point at bubble
    elements.cannon.style.transform = `translateX(-50%) rotate(${degrees - 90}deg)`;
    
    // Add firing sound effect
    const fireSound = new Audio('data:audio/wav;base64,UklGRlwHAABXQVZFZm10IBAAAAABAAEARKwAAESsAAABAAgAZGF0YTgHAACBgIF/gn6Dfn+AgIF/gn2CfICAfX99fHx9fnx9fH1+fX5+f4CBgIGCg4GDgYGAfn18enp4d3Z1c3JycXBxcHFvcG9wcXJzdHV3eXp7fH1+f4GBg4WEhoaHiIiJiouKjIuMjIyMjIuMi4uLioqKiYiIh4eGhoWFhISDg4KCgYCBgICAfn9+fX18fHx7fHt7e3t7ent7fHx9fX5/f4CAgYGCgoODhISFhYaGh4iIiImJiYqKioqLi4uLi4uLi4qKiomJiIiIh4aGhYSEg4KCgYCAfn59fHt6eXh3dnV0c3JxcG9ubWxsampqaWlpampqa2xtbm9wcnN1dnd5ent9f4CBg4SFh4iJi4yNjpCQkZKTlJSUlZWWlZWWlZWUlJOTkpGQj4+OjYuLiomIhoWEg4GAfn18e3l4dnVzcnFvbmxraWhnZmVkY2NiYmJiYmJjY2RlZmdoaWptbnBydHV3eXx+f4GDhYeJioyOkJGTlJWXmJmampubm5ycnJycnJuampmYl5aVlJKRkI6Mi4qIhoSDgYB+fHp4d3Vzcm9ubGppZmVjYmBfXl1cW1tbW1pbW1xdXV5fYGFjZGZoamxvcXN2eHp9f4GDhomLjY+RlJWXmZqcnZ6foKGioqKjo6OjoqKioaCfnp2cm5qYl5WUkpCOjImIhoSDgYB+fHp4dnRycG5sa2lnZWRiYV9eXVxbWlpZWVlZWVpbXF1eX2BiY2VnaWttcHJ0d3l8foGDhomLjpCSlJaYmpyeoKGio6SlpaanpqampqWlpKSjoqGgnp2cm5mXlZSSkI6Mi4mHhYOBf317eXd1c3FvbWtpZ2VkYmBfXVxbWVhYV1dXV1hYWVlaW1xeX2FjZWdpbG5wc3V4e31/goSGiYuOkJKVl5manJ6goqOlpqeoqaqqqqurqqqqqqmoqKempaSjoqCfnZuZl5WTkY+NioiGhIJ/fXt5d3Vyb21raGZkYWBfXVtaWFdWVVRUVFRUVVVWV1hZW11eYGJlZ2ptcHJ1d3p9f4KFh4qMj5GUlpibnZ+ho6WmqKmqq6uurq+vr6+vr6+urq2sq6qpqKalpKKgnpyamJaTkY+MioeFgn98endzc3BtbGlnZGNgXl1bWVhWVVRTUlJSUlJSU1RVVlhaW11fYWRmaWxucnR3en2Ag4WIi46QlJaZm56go6WnqaqsrbCwsbKysrOzs7OysbCwrq2rqqinpqSioJ6bmZeUkpCMioeFgn98endzc3BtamdlYmFfXVtZV1VUVFJRUE9PT09PUFFSU1RWWFpcXmBjZWlrbXF0d3p+gYSHio2QkpWYm52foqSnqauur7CytLW1tra3t7e3tra1tLOysbCurKupp6WjoZ+cmpiVk5CNi4iFgn98endzc29saWdkYmBeXFpYVlVTUVBOTk1MTU1OT1BSU1VXWVxeYGNmamxwc3Z5fYCEh4qNkJOWmZyfoqSnqauur7K0tba4uLm6urq6urm5uLe2tbSysa+sq6mno6GempiVko+MioeFgX57eHVycG1qaGViYF1bWVdVU1FPTkxLSkpKS0xNT1FTVVZYW15hZGdqbnF0eHt/goWJjI+SlZianZ+ipKepq66xsrS2t7m6u7y8vLy8vLy7urm3trWzsrCurKqopaOgnZuYlZKPjImGg398eXZzcW5rZ2RiX11aWFZTUU9NTEpJSEhISUpLTU9RU1ZYW15gY2ZqbXF1eHyAg4aKjZCTlpmdoKOmqKuusLK0tre5uru8vb6+vr6+vr69vLu6uLe1tLKwr62rqKakoZ+cmpeUkY6LiISBfnt4dXJvbGlmY2BeW1lXVVJQTkxKSUdHR0dISUpMT1BTVVdaXWBjZ2ptcXV4fIGEiIuPkZSXmp2hpKerrrCytLa4uru9vr+/wMDAwMC/v7++vby7urm3tbSysK6sqaekop+dmpeUkY2KhoN/e3h1cm9saWZjYF1bWFVTUU5MS0lHRkZGRkdISkxPUVNWWVxfYmVpbXF0eHyBhIiLj5KVmJygo6aprbCys7a4uru9vr/AwcHCwsLCwsHBwL++vby7urm3trSysK6rqaejoZ6bmZaSj4yIhIB9eXZzcm9raGViX1xaV1RST01LSEZFRERERUZHSUtNUFJVWFteYWRobHB0d3uAg4eKjpGUl5qeoaSnqq2wsrS2uLq7vb6/wMDBwcHAwMC/v768u7q5t7a0srCuq6mmoqCdmpaSkI2JhYJ+end0cW5raGViX1xaV1RST01LSEZFRERERUZHSUtOUFNVWFteYWVpbXF0eHyAg4eKjpGUl5qeoaSnqq2wsrS2uLq7vb6/wMDBwcHBwcHAwL++vby7urm3trSysK6rqKWioJ2al5SSj4uHg398eXZzcW5rZ2ViX1xaV1RST01LSEZFRERERUZHSUtOUFNVWFteYWVpbXF0eHyAg4eKjpGUl5qeoaSnqq2vsrS2uLq7vb6/wMDBwcHCwsHBwMC/vr28u7q4trazsrCuq6mmoqCdmpeUkY6KhoJ+end0cW5raGViX1xaV1RST01LSEdFREREREVHSEtNUFJVV1teYWRobHB0d3uAg4eKjpGUl5qeoaSnqq2wsrS2uLq7vb6/wMDAwcHBwcHAwL+/vr28u7q4t7a0srCuq6mmoqCdmpeUkY6KhoN/e3h1cm9saWZjYF1bWFZTUU9MS0lHRkZGRkdJSkxPUVNWWFteYWRobHB0d3uAg4eKjpGUl5qeoaSnqq2vsrS2uLq7vb6');
    fireSound.volume = 0.3;
    fireSound.play();
    
    // Debug indicator
    if (config.debugMode) {
        elements.recognizedWords.prepend(document.createElement('div')).textContent = 
            `Matching "${bubble.word}" (x:${Math.round(bubble.x)}, y:${Math.round(bubble.y)})`;
    }
}

// Create a new bubble
function createBubble() {
    if (gameState.activeBubbles.length >= config.maxBubbles || !gameState.isGameRunning) {
        return;
    }

    // Pick a random word from the list
    const word = config.words[Math.floor(Math.random() * config.words.length)];
    
    // Random x position (keeping away from edges)
    const minX = 50;
    const maxX = elements.gameContainer.offsetWidth - 50;
    const x = Math.random() * (maxX - minX) + minX;
    
    // Create the bubble element
    const bubbleElement = document.createElement('div');
    bubbleElement.className = 'bubble';
    bubbleElement.textContent = word;
    bubbleElement.style.left = x + 'px';
    bubbleElement.style.top = '0px';
    
    // Generate random color for the bubble
    const hue = Math.floor(Math.random() * 360);
    bubbleElement.style.backgroundColor = `hsla(${hue}, 70%, 80%, 0.8)`;
    bubbleElement.style.borderColor = `hsl(${hue}, 70%, 60%)`;
    
    // Add debug click handler if in debug mode
    if (config.debugMode) {
        bubbleElement.addEventListener('click', (e) => {
            e.preventDefault();
            const bubble = gameState.activeBubbles.find(b => b.element === bubbleElement);
            if (bubble) {
                pointCannonAtBubble(bubble);
                popBubble(bubble);
            }
        });
    }
    
    elements.bubbleContainer.appendChild(bubbleElement);
    
    // Add bubble to active bubbles
    const bubble = {
        element: bubbleElement,
        word: word,
        x: x,
        y: 0,
        speed: config.bubbleSpeed * (0.8 + Math.random() * 0.4) // Slight speed variation
    };
    
    gameState.activeBubbles.push(bubble);
}

// Move bubbles down
function moveBubbles() {
    const containerHeight = elements.gameContainer.offsetHeight;
    
    for (let i = gameState.activeBubbles.length - 1; i >= 0; i--) {
        const bubble = gameState.activeBubbles[i];
        
        // Update bubble position
        bubble.y += bubble.speed;
        bubble.element.style.top = bubble.y + 'px';
        
        // Check if bubble reached the bottom
        if (bubble.y > containerHeight - 120) {
            // Remove bubble
            elements.bubbleContainer.removeChild(bubble.element);
            gameState.activeBubbles.splice(i, 1);
            
            // Lose a life
            gameState.lives--;
            elements.livesValue.textContent = gameState.lives;
            
            // Check if game over
            if (gameState.lives <= 0) {
                endGame();
            }
        }
    }
}

// Shoot a bubble
function shootBubble(bubble) {
    // Calculate angle between cannon and bubble
    const cannonX = elements.gameContainer.offsetWidth / 2;
    const cannonY = elements.gameContainer.offsetHeight - 20;
    const deltaX = bubble.x - cannonX;
    const deltaY = bubble.y - cannonY;
    const angle = Math.atan2(deltaY, deltaX);
    const degrees = angle * (180 / Math.PI);
    
    // Rotate cannon to point at bubble
    elements.cannon.style.transform = `translateX(-50%) rotate(${degrees - 90}deg)`;
    
    // Add firing sound effect
    const fireSound = new Audio('data:audio/wav;base64,UklGRlwHAABXQVZFZm10IBAAAAABAAEARKwAAESsAAABAAgAZGF0YTgHAACBgIF/gn6Dfn+AgIF/gn2CfICAfX99fHx9fnx9fH1+fX5+f4CBgIGCg4GDgYGAfn18enp4d3Z1c3JycXBxcHFvcG9wcXJzdHV3eXp7fH1+f4GBg4WEhoaHiIiJiouKjIuMjIyMjIuMi4uLioqKiYiIh4eGhoWFhISDg4KCgYCBgICAfn9+fX18fHx7fHt7e3t7ent7fHx9fX5/f4CAgYGCgoODhISFhYaGh4iIiImJiYqKioqLi4uLi4uLi4qKiomJiIiIh4aGhYSEg4KCgYCAfn59fHt6eXh3dnV0c3JxcG9ubWxsampqaWlpampqa2xtbm9wcnN1dnd5ent9f4CBg4SFh4iJi4yNjpCQkZKTlJSUlZWWlZWWlZWUlJOTkpGQj4+OjYuLiomIhoWEg4GAfn18e3l4dnVzcnFvbmxraWhnZmVkY2NiYmJiYmJjY2RlZmdoaWptbnBydHV3eXx+f4GDhYeJioyOkJGTlJWXmJmampubm5ycnJycnJuampmYl5aVlJKRkI6Mi4qIhoSDgYB+fHp4d3Vzcm9ubGppZmVjYmBfXl1cW1tbW1pbW1xdXV5fYGFjZGZoamxvcXN2eHp9f4GDhomLjY+RlJWXmZqcnZ6foKGioqKjo6OjoqKioaCfnp2cm5qYl5WUkpCOjImIhoSDgYB+fHp4dnRycG5sa2lnZWRiYV9eXVxbWlpZWVlZWVpbXF1eX2BiY2VnaWttcHJ0d3l8foGDhomLjpCSlJaYmpyeoKGio6SlpaanpqampqWlpKSjoqGgnp2cm5mXlZSSkI6Mi4mHhYOBf317eXd1c3FvbWtpZ2VkYmBfXVxbWVhYV1dXV1hYWVlaW1xeX2FjZWdpbG5wc3V4e31/goSGiYuOkJKVl5manJ6goqOlpqeoqaqqqqurqqqqqqmoqKempaSjoqCfnZuZl5WTkY+NioiGhIJ/fXt5d3Vyb21raGZkYWBfXVtaWFdWVVRUVFRUVVVWV1hZW11eYGJlZ2ptcHJ1d3p9f4KFh4qMj5GUlpibnZ+ho6WmqKmqq6uurq+vr6+vr6+urq2sq6qpqKalpKKgnpyamJaTkY+MioeFgn98endzc3BtbGlnZGNgXl1bWVhWVVRTUlJSUlJSU1RVVlhaW11fYWRmaWxucnR3en2Ag4WIi46QlJaZm56go6WnqaqsrbCwsbKysrOzs7OysbCwrq2rqqinpqSioJ6bmZeUkpCMioeFgn98endzc3BtamdlYmFfXVtZV1VUVFJRUE9PT09PUFFSU1RWWFpcXmBjZWlrbXF0d3p+gYSHio2QkpWYm52foqSnqauur7CytLW1tra3t7e3tra1tLOysbCurKupp6WjoZ+cmpiVk5CNi4iFgn98endzc29saWdkYmBeXFpYVlVTUVBOTk1MTU1OT1BSU1VXWVxeYGNmamxwc3Z5fYCEh4qNkJOWmZyfoqSnqauur7K0tba4uLm6urq6urm5uLe2tbSysa+sq6mno6GempiVko+MioeFgX57eHVycG1qaGViYF1bWVdVU1FPTkxLSkpKS0xNT1FTVVZYW15hZGdqbnF0eHt/goWJjI+SlZianZ+ipKepq66xsrS2t7m6u7y8vLy8vLy7urm3trWzsrCurKqopaOgnZuYlZKPjImGg398eXZzcW5rZ2RiX11aWFZTUU9NTEpJSEhISUpLTU9RU1ZYW15gY2ZqbXF1eHyAg4aKjZCTlpmdoKOmqKuusLK0tre5uru8vb6+vr6+vr69vLu6uLe1tLKwr62rqKakoZ+cmpeUkY6LiISBfnt4dXJvbGlmY2BeW1lXVVJQTkxKSUdHR0dISUpMT1BTVVdaXWBjZ2ptcXV4fIGEiIuPkZSXmp2hpKerrrCytLa4uru9vr+/wMDAwMC/v7++vby7urm3tbSysK6sqaekop+dmpeUkY2KhoN/e3h1cm9saWZjYF1bWFVTUU5MS0lHRkZGRkdISkxPUVNWWVxfYmVpbXF0eHyBhIiLj5KVmJygo6aprbCys7a4uru9vr/AwcHCwsLCwsHBwL++vby7urm3trSysK6rqaejoZ6bmZaSj4yIhIB9eXZzcm9raGViX1xaV1RST01LSEZFRERERUZHSUtNUFJVWFteYWRobHB0d3uAg4eKjpGUl5qeoaSnqq2wsrS2uLq7vb6/wMDBwcHAwMC/v768u7q5t7a0srCuq6mmoqCdmpaSkI2JhYJ+end0cW5raGViX1xaV1RST01LSEZFRERERUZHSUtOUFNVWFteYWVpbXF0eHyAg4eKjpGUl5qeoaSnqq2wsrS2uLq7vb6/wMDBwcHBwcHAwL++vby7urm3trSysK6rqKWioJ2al5SSj4uHg398eXZzcW5rZ2ViX1xaV1RST01LSEZFRERERUZHSUtOUFNVWFteYWVpbXF0eHyAg4eKjpGUl5qeoaSnqq2vsrS2uLq7vb6/wMDBwcHCwsHBwMC/vr28u7q4trazsrCuq6mmoqCdmpeUkY6KhoJ+end0cW5raGViX1xaV1RST01LSEdFREREREVHSEtNUFJVV1teYWRobHB0d3uAg4eKjpGUl5qeoaSnqq2wsrS2uLq7vb6/wMDAwcHBwcHAwL+/vr28u7q4t7a0srCuq6mmoqCdmpeUkY6KhoN/e3h1cm9saWZjYF1bWFZTUU9MS0lHRkZGRkdJSkxPUVNWWFteYWRobHB0d3uAg4eKjpGUl5qeoaSnqq2vsrS2uLq7vb6');
    fireSound.play();
    
    // Debug indicator
    if (config.debugMode) {
        elements.recognizedWords.prepend(document.createElement('div')).textContent = 
            `Shooting at "${bubble.word}" (x:${Math.round(bubble.x)}, y:${Math.round(bubble.y)})`;
    }
    
    // Create the arrow
    const arrow = document.createElement('div');
    arrow.className = 'arrow';
    arrow.style.left = cannonX + 'px';
    arrow.style.top = cannonY + 'px';
    arrow.style.transform = `rotate(${degrees}deg)`;
    elements.gameContainer.appendChild(arrow);
    
    // Initial position for the arrow
    let arrowX = cannonX;
    let arrowY = cannonY;
    
    // Make sure the arrow is visible
    arrow.style.position = 'absolute';
    arrow.style.zIndex = '100';
    arrow.style.transformOrigin = 'center bottom';
    
    // Move the arrow towards the bubble
    const arrowAnimation = setInterval(() => {
        // Move arrow along the angle
        arrowX += Math.cos(angle) * config.arrowSpeed;
        arrowY += Math.sin(angle) * config.arrowSpeed;
        
        arrow.style.left = arrowX + 'px';
        arrow.style.top = arrowY + 'px';
        
        // Debug visualization
        if (config.debugMode) {
            arrow.style.backgroundColor = 'red';
            arrow.style.width = '8px'; // Make it more visible
        }
        
        // Check if arrow reached the bubble
        const distance = Math.sqrt(
            Math.pow(arrowX - bubble.x, 2) + 
            Math.pow(arrowY - bubble.y, 2)
        );
        
        // Debug distance
        if (config.debugMode && distance % 30 === 0) {
            console.log(`Arrow distance: ${Math.round(distance)}`);
        }
        
        if (distance < 40) { // Increased hit radius
            // Hit the bubble
            clearInterval(arrowAnimation);
            elements.gameContainer.removeChild(arrow);
            popBubble(bubble);
        }
        
        // Check if arrow is out of bounds
        if (
            arrowX < 0 || 
            arrowX > elements.gameContainer.offsetWidth || 
            arrowY < 0 || 
            arrowY > elements.gameContainer.offsetHeight
        ) {
            clearInterval(arrowAnimation);
            elements.gameContainer.removeChild(arrow);
        }
    }, 20);
}

// Pop a bubble
function popBubble(bubble) {
    if (config.superDebugMode) {
        console.log('Popping bubble with word:', bubble.word);
    }
    
    try {
        // Verify bubble is valid and in the DOM
        if (!bubble || !bubble.element || !bubble.element.parentNode) {
            console.error('Invalid bubble or already removed:', bubble);
            return;
        }
        
        // Create hit effect at bubble position
        const hitEffect = document.createElement('div');
        hitEffect.className = 'hit-effect';
        hitEffect.style.left = (bubble.x - 60) + 'px';
        hitEffect.style.top = (bubble.y - 60) + 'px';
        elements.gameContainer.appendChild(hitEffect);
        
        // Play pop sound
        const popSound = new Audio('data:audio/wav;base64,UklGRigCAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQCAACtmYyFfXdxbGZhXVlVUlBOTk5OT1FTVlldYGRpbnN4foOIjpOYnqKmqq2vsrO0tbW0s7KwrqyppqOgm5eTj4uGgn56dnJubGlnZWRjYmJjY2RlaGpscXR4fIGFiY2Rk5ebnZ+goqOjoqKhoJ+dnJqYlpSSj42LiYeEgn98enl3dXVzcnJxcHBwcXFydHV3eXx+gYOGiIqMjpCQkpKSkpKSkI+OjYuKiIaFg4GAfnx7eXh3dXV0c3NycnJzc3R1dnh6e32AgoSGiImLjI2Oj5CQkJCPj4+OjYyLioiHhYSCgH9+fHt6eXh3d3Z2dnZ2d3d4eXp7fH5/gYKEhYaHiImJiouLi4uLi4qKiYmIh4aFhIOCgYB/fn18e3t6enl5eXl5eXl6ent8fX5/gIGCg4SFhYaGhoaGhoaGhoWFhISDgoGBgH9+fn19fHx7e3t7e3t7e3t8fH1+fn9/gICBgYGBgYGBgYGBgYGBgICAgH9/f39+fn5+fn5+fn5+fn5+fn5+fn9/f39/f39/f39/f39/f3+AgICAgICAgICAgICAgICAgICAgH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+AgICA');
        try {
            popSound.play().catch(err => {
                console.log('Pop sound error:', err);
            });
        } catch (e) {
            console.log('Pop sound error:', e);
        }
        
        // Add pop animation
        bubble.element.classList.add('pop-animation');
        
        // Force repaint to ensure animation runs
        bubble.element.getBoundingClientRect();
        
        // Remove bubble after animation
        setTimeout(() => {
            try {
                if (bubble.element && bubble.element.parentNode) {
                    bubble.element.parentNode.removeChild(bubble.element);
                }
                
                // Remove from active bubbles
                const index = gameState.activeBubbles.indexOf(bubble);
                if (index > -1) {
                    gameState.activeBubbles.splice(index, 1);
                }
                
                // Remove hit effect
                if (hitEffect.parentNode) {
                    hitEffect.parentNode.removeChild(hitEffect);
                }
                
                if (config.superDebugMode) {
                    console.log('Bubble successfully removed');
                    console.log('Remaining bubbles:', gameState.activeBubbles.length);
                }
            } catch (error) {
                console.error('Error removing bubble:', error);
            }
        }, 500);
        
        // Increase score
        gameState.score += 10;
        elements.scoreValue.textContent = gameState.score;
        
    } catch (error) {
        console.error('Error in popBubble:', error);
    }
}

// Start the game
function startGame() {
    // Reset game state
    gameState.activeBubbles = [];
    gameState.score = 0;
    gameState.lives = config.initialLives;
    gameState.isGameRunning = true;
    
    // Update UI
    elements.scoreValue.textContent = gameState.score;
    elements.livesValue.textContent = gameState.lives;
    elements.startScreen.classList.add('hidden');
    elements.gameOverScreen.classList.add('hidden');
    elements.speechDebug.style.display = 'block';
    elements.recognizedWords.textContent = 'Waiting for speech...';
    elements.lastWordValue.textContent = 'None';
    
    // Clear any existing bubbles
    elements.bubbleContainer.innerHTML = '';
    
    // Start creating bubbles
    gameState.bubbleCreationInterval = setInterval(createBubble, config.bubbleInterval);
    
    // Start the game loop
    requestAnimationFrame(gameLoop);
    
    // Start speech recognition
    if (gameState.speechRecognition) {
        gameState.speechRecognition.start();
    }
}

// End the game
function endGame() {
    gameState.isGameRunning = false;
    
    // Stop creating bubbles
    clearInterval(gameState.bubbleCreationInterval);
    
    // Stop speech recognition
    if (gameState.speechRecognition) {
        gameState.speechRecognition.stop();
    }
    
    // Show game over screen
    elements.finalScore.textContent = gameState.score;
    elements.gameOverScreen.classList.remove('hidden');
}

// Game loop
function gameLoop() {
    if (gameState.isGameRunning) {
        moveBubbles();
        requestAnimationFrame(gameLoop);
    }
}

// Event listeners
elements.startButton.addEventListener('click', () => {
    initSpeechRecognition();
    startGame();
});

elements.restartButton.addEventListener('click', () => {
    startGame();
});

// Add keyboard debug controls
document.addEventListener('keydown', (e) => {
    // Only if debug mode is enabled
    if (!config.debugMode) return;
    
    // Space to pause/resume game
    if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault(); // Prevent page scrolling
        if (gameState.isGameRunning) {
            gameState.isGameRunning = false;
            elements.recognizedWords.prepend(document.createElement('div')).textContent = 'Game paused';
            if (gameState.speechRecognition) {
                gameState.speechRecognition.stop();
            }
        } else {
            gameState.isGameRunning = true;
            elements.recognizedWords.prepend(document.createElement('div')).textContent = 'Game resumed';
            requestAnimationFrame(gameLoop);
            if (gameState.speechRecognition) {
                gameState.speechRecognition.start();
            }
        }
    }
    
    // D to toggle debug panel
    if (e.code === 'KeyD' && e.ctrlKey) {
        e.preventDefault();
        elements.speechDebug.style.display = 
            elements.speechDebug.style.display === 'none' ? 'block' : 'none';
    }
    
    // M to test speech matching with keyboard input
    if (e.code === 'KeyM' && e.ctrlKey) {
        e.preventDefault();
        const word = prompt('Enter a word to test speech matching:');
        if (word && word.trim()) {
            checkForWordMatch(word.trim().toLowerCase());
        }
    }
    
    // R to restart speech recognition
    if (e.code === 'KeyR' && e.ctrlKey) {
        e.preventDefault();
        restartSpeechRecognition();
    }
    
    // P to force pop all bubbles (emergency debug)
    if (e.code === 'KeyP' && e.ctrlKey) {
        e.preventDefault();
        forcePopAllBubbles();
    }
    
    // L to list all active bubble words in console
    if (e.code === 'KeyL' && e.ctrlKey) {
        e.preventDefault();
        console.log('Active bubbles:');
        gameState.activeBubbles.forEach((bubble, index) => {
            console.log(`Bubble ${index}: "${bubble.word}" at x:${Math.round(bubble.x)}, y:${Math.round(bubble.y)}`);
        });
    }
});

// Initialize the game
window.addEventListener('load', () => {
    // Show start screen
    elements.startScreen.classList.remove('hidden');
    elements.gameOverScreen.classList.add('hidden');
    
    // Hide debug panel initially if not in debug mode
    if (!config.debugMode) {
        elements.speechDebug.style.display = 'none';
    }
    
    // Initialize speech recognition
    initSpeechRecognition();
});

// Force pop all bubbles (debug feature)
function forcePopAllBubbles() {
    if (config.superDebugMode) {
        console.log('Force popping all bubbles');
    }
    
    // Create a copy of the array to avoid modification issues during iteration
    const bubblesSnapshot = [...gameState.activeBubbles];
    
    // Pop each bubble
    bubblesSnapshot.forEach(bubble => {
        try {
            popBubble(bubble);
        } catch (error) {
            console.error('Error force popping bubble:', error);
        }
    });
} 