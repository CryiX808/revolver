/* ============================================
   REVOLVER SIMULATOR — Enhanced Application Logic
   ============================================ */

// ========== CONSTANTS ==========
const ESCALATION_LEVELS = [100, 75, 50, 25, 10, 6, 3, 2, 1];

const MODIFIERS = [
    { id: 'shield',        icon: '🛡️', name: 'Shield',         desc: 'Survives even if chamber is live', cssClass: 'mod-shield' },
    { id: 'double',        icon: '💀', name: 'Double Barrel',  desc: '2 live rounds loaded this turn',    cssClass: 'mod-double' },
    { id: 'second-chance', icon: '🔄', name: 'Second Chance',  desc: 'If fired, get a re-spin',           cssClass: 'mod-second-chance' },
    { id: 'sniper',        icon: '🎯', name: 'Sniper',         desc: '10 live rounds loaded!',            cssClass: 'mod-sniper' },
    { id: 'lucky',         icon: '🍀', name: 'Lucky Clover',   desc: '0 live rounds — guaranteed safe',   cssClass: 'mod-lucky' },
    { id: 'shuffle',       icon: '🔀', name: 'Shuffle',        desc: 'Chambers re-randomize mid-pull',    cssClass: 'mod-shuffle' },
    { id: 'mirror',        icon: '🪞', name: 'Mirror',         desc: 'Result is inverted!',               cssClass: 'mod-mirror' },
    { id: 'unknown',       icon: '❓', name: 'Unknown',        desc: 'No modifier shown — could be any',  cssClass: 'mod-unknown' },
];

const ACHIEVEMENTS = [
    { id: 'first_blood',  icon: '🐣', name: 'First Blood',    desc: 'Get fired for the first time' },
    { id: 'hot_streak',   icon: '🔥', name: 'Hot Streak',     desc: 'Survive 10 pulls in a row' },
    { id: 'ice_cold',     icon: '🧊', name: 'Ice Cold',       desc: 'Survive 25 pulls in a row' },
    { id: 'diamond',      icon: '💎', name: 'Diamond Hands',  desc: 'Survive 50 pulls in a row' },
    { id: 'speed_demon',  icon: '⚡', name: 'Speed Demon',    desc: '5 pulls in under 10 seconds' },
    { id: 'unlucky',      icon: '🎭', name: 'Cursed',         desc: 'Get fired 3 times in a row' },
    { id: 'untouchable',  icon: '🌟', name: 'Untouchable',    desc: 'Survive 100 pulls total' },
    { id: 'death_wish',   icon: '💀', name: 'Death Wish',     desc: 'Get fired 10 times total' },
    { id: 'jackpot',      icon: '🎰', name: 'Jackpot',        desc: 'Survive at 50% odds (2 chambers)' },
    { id: 'iron_will',    icon: '🦾', name: 'Iron Will',      desc: 'Reach level 7 in Escalation' },
    { id: 'last_second',  icon: '⏱️', name: 'Last Second',    desc: 'Pull trigger with <1s left' },
    { id: 'plot_twist',   icon: '🪞', name: 'Plot Twist',     desc: 'Get saved by Mirror modifier' },
];

// ========== STATE ==========
let state = {
    mode: 'classic',         // classic | escalation | countdown | dealer
    chambers: [],
    totalChambers: 100,
    liveRounds: 1,
    currentChamber: 0,
    isSpun: false,
    isAnimating: false,
    rotation: 0,

    // Escalation
    escalationLevel: 0,

    // Countdown
    countdownTimer: null,
    countdownStartTime: 0,
    countdownRemaining: 5,

    // Dealer
    currentModifier: null,
    secondChanceActive: false,

    // Stats
    totalAttempts: 0,
    totalSurvived: 0,
    totalFired: 0,
    currentStreak: 0,
    bestStreak: 0,
    firedStreak: 0,        // consecutive fires
    history: [],
    pullTimestamps: [],     // for speed demon achievement

    // Achievements
    unlockedAchievements: new Set(),
};

// ========== AUDIO ENGINE ==========
const AudioEngine = {
    ctx: null,

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },

    play(type) {
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        switch (type) {
            case 'spin': this._playSpin(ctx, now); break;
            case 'click': this._playClick(ctx, now); break;
            case 'fire': this._playFire(ctx, now); break;
            case 'tick': this._playTick(ctx, now); break;
            case 'heartbeat': this._playHeartbeat(ctx, now); break;
            case 'achievement': this._playAchievement(ctx, now); break;
            case 'modifier': this._playModifier(ctx, now); break;
            case 'countdown-tick': this._playCountdownTick(ctx, now); break;
            case 'level-up': this._playLevelUp(ctx, now); break;
        }
    },

    _playSpin(ctx, now) {
        for (let i = 0; i < 12; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(800 + Math.random() * 400, now + i * 0.08);
            osc.frequency.exponentialRampToValueAtTime(200, now + i * 0.08 + 0.06);
            gain.gain.setValueAtTime(0.03, now + i * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.06);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now + i * 0.08);
            osc.stop(now + i * 0.08 + 0.07);
        }
    },

    _playClick(ctx, now) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(3200, now);
        osc2.frequency.exponentialRampToValueAtTime(1500, now + 0.15);
        gain2.gain.setValueAtTime(0.06, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc2.connect(gain2).connect(ctx.destination);
        osc2.start(now);
        osc2.stop(now + 0.16);
    },

    _playFire(ctx, now) {
        const bufferSize = ctx.sampleRate * 0.5;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(4000, now);
        filter.frequency.exponentialRampToValueAtTime(200, now + 0.4);
        noise.connect(filter).connect(gain).connect(ctx.destination);
        noise.start(now);
        noise.stop(now + 0.5);

        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
        oscGain.gain.setValueAtTime(0.4, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(oscGain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
    },

    _playTick(ctx, now) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2000, now);
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.03);
    },

    _playHeartbeat(ctx, now) {
        for (let i = 0; i < 2; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(50, now + i * 0.15);
            gain.gain.setValueAtTime(0.2 - i * 0.05, now + i * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.12);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now + i * 0.15);
            osc.stop(now + i * 0.15 + 0.13);
        }
    },

    _playAchievement(ctx, now) {
        const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.12);
            gain.gain.setValueAtTime(0.1, now + i * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now + i * 0.12);
            osc.stop(now + i * 0.12 + 0.35);
        });
    },

    _playModifier(ctx, now) {
        for (let i = 0; i < 8; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400 + Math.random() * 800, now + i * 0.06);
            gain.gain.setValueAtTime(0.04, now + i * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.05);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now + i * 0.06);
            osc.stop(now + i * 0.06 + 0.06);
        }
    },

    _playCountdownTick(ctx, now) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.06);
    },

    _playLevelUp(ctx, now) {
        [440, 554, 659, 880].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + i * 0.1);
            gain.gain.setValueAtTime(0.12, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.2);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.25);
        });
    }
};

// ========== INIT ==========
function init() {
    loadAchievements();
    loadChambers();
    renderCylinder();
    renderAchievements();
    updateUI();
    updateProbabilityArc();
    updateDangerLevel();
    updateConfigUI();
}

function loadChambers() {
    state.chambers = new Array(state.totalChambers).fill(false);
    const count = Math.min(state.liveRounds, state.totalChambers);
    const indices = [];
    while (indices.length < count) {
        const idx = Math.floor(Math.random() * state.totalChambers);
        if (!indices.includes(idx)) {
            indices.push(idx);
            state.chambers[idx] = true;
        }
    }
}

// ========== REVOLVER CONFIGURATION ==========
function adjustConfig(type, delta) {
    const chamberSlider = document.getElementById('chamberSlider');
    const bulletSlider = document.getElementById('bulletSlider');

    let chambers = parseInt(chamberSlider.value);
    let bullets = parseInt(bulletSlider.value);

    if (type === 'chambers') {
        chambers = Math.max(2, Math.min(100, chambers + delta));
        chamberSlider.value = chambers;
        // Ensure bullets don't exceed chambers - 1
        if (bullets >= chambers) {
            bullets = Math.max(1, chambers - 1);
            bulletSlider.value = bullets;
        }
        bulletSlider.max = Math.max(1, chambers - 1);
    } else {
        const maxBullets = Math.max(1, chambers - 1);
        bullets = Math.max(1, Math.min(maxBullets, bullets + delta));
        bulletSlider.value = bullets;
    }

    applyConfig(chambers, bullets);
}

function onConfigSlider() {
    const chamberSlider = document.getElementById('chamberSlider');
    const bulletSlider = document.getElementById('bulletSlider');

    let chambers = parseInt(chamberSlider.value);
    let bullets = parseInt(bulletSlider.value);

    // Clamp bullets to valid range
    const maxBullets = Math.max(1, chambers - 1);
    bulletSlider.max = maxBullets;
    if (bullets > maxBullets) {
        bullets = maxBullets;
        bulletSlider.value = bullets;
    }
    if (bullets < 1) {
        bullets = 1;
        bulletSlider.value = 1;
    }

    applyConfig(chambers, bullets);
}

function applyPreset(chambers, bullets) {
    document.getElementById('chamberSlider').value = chambers;
    document.getElementById('chamberSlider').max = 100;
    const maxBullets = Math.max(1, chambers - 1);
    document.getElementById('bulletSlider').max = maxBullets;
    document.getElementById('bulletSlider').value = Math.min(bullets, maxBullets);

    applyConfig(chambers, Math.min(bullets, maxBullets));
    AudioEngine.play('tick');
}

function applyConfig(chambers, bullets) {
    state.totalChambers = chambers;
    state.liveRounds = bullets;
    state.isSpun = false;

    // Update header chips
    document.getElementById('chipChambersVal').textContent = chambers;
    document.getElementById('chipLiveVal').textContent = bullets;

    // Reload chambers with new config
    loadChambers();

    // Reset cylinder
    state.rotation = 0;
    const cylinder = document.getElementById('cylinder');
    cylinder.style.transition = 'none';
    cylinder.style.transform = 'rotate(0deg)';
    setTimeout(() => { cylinder.style.transition = 'transform 3s var(--ease-out-expo)'; }, 50);

    document.querySelectorAll('.cylinder-chamber').forEach(ch => {
        ch.classList.remove('active', 'empty-revealed', 'live-revealed');
    });

    renderCylinder();
    document.getElementById('chamberNumber').textContent = '?';
    document.getElementById('btnFire').disabled = true;

    updateConfigUI();
    updateProbabilityArc();
    updateDangerLevel();
    updateResult('🎯', 'Ready to play', '');

    // Update mode subtitle
    document.getElementById('modeSubtitle').textContent = `${chambers}-CHAMBER • ${bullets} LIVE`;
}

function updateConfigUI() {
    const chamberSlider = document.getElementById('chamberSlider');
    const bulletSlider = document.getElementById('bulletSlider');
    if (!chamberSlider || !bulletSlider) return;

    const chambers = parseInt(chamberSlider.value);
    const bullets = parseInt(bulletSlider.value);

    document.getElementById('chamberValueDisplay').textContent = chambers;
    document.getElementById('bulletValueDisplay').textContent = bullets;

    // Update chance display
    const chance = ((bullets / chambers) * 100);
    const chanceEl = document.getElementById('configChanceValue');
    chanceEl.textContent = chance < 10 ? chance.toFixed(1) + '%' : Math.round(chance) + '%';

    // Color the chance value based on danger
    if (chance <= 5) {
        chanceEl.style.color = '#44ff88';
    } else if (chance <= 20) {
        chanceEl.style.color = '#ffcc44';
    } else if (chance <= 50) {
        chanceEl.style.color = '#ff8844';
    } else {
        chanceEl.style.color = '#ff3b3b';
    }
}

// ========== GAME MODE SWITCHING ==========
function switchMode(mode) {
    if (state.isAnimating) return;

    // Stop any countdown
    stopCountdown();

    state.mode = mode;
    state.isSpun = false;

    // Update tab UI
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    // Reset mode-specific state
    state.escalationLevel = 0;
    state.currentModifier = null;
    state.secondChanceActive = false;

    // Mode-specific setup
    const escDisplay = document.getElementById('escalationDisplay');
    const modDisplay = document.getElementById('modifierDisplay');
    const countdownRing = document.getElementById('countdownRing');
    const countdownNum = document.getElementById('countdownNumber');

    const configPanel = document.getElementById('configPanel');

    escDisplay.style.display = 'none';
    modDisplay.style.display = 'none';
    countdownRing.style.display = 'none';
    countdownNum.style.display = 'none';
    configPanel.classList.add('hidden');

    switch (mode) {
        case 'classic': {
            configPanel.classList.remove('hidden');
            const cs = parseInt(document.getElementById('chamberSlider').value);
            const bs = parseInt(document.getElementById('bulletSlider').value);
            state.totalChambers = cs;
            state.liveRounds = bs;
            document.getElementById('modeSubtitle').textContent = `${cs}-CHAMBER • ${bs} LIVE`;
            updateConfigUI();
            break;
        }

        case 'escalation':
            state.totalChambers = ESCALATION_LEVELS[0];
            state.liveRounds = 1;
            escDisplay.style.display = '';
            renderEscalationLevels();
            document.getElementById('modeSubtitle').textContent = 'ESCALATION MODE';
            break;

        case 'countdown':
            state.totalChambers = 100;
            state.liveRounds = 1;
            countdownRing.style.display = '';
            countdownNum.style.display = '';
            document.getElementById('modeSubtitle').textContent = 'COUNTDOWN MODE';
            break;

        case 'dealer':
            state.totalChambers = 100;
            state.liveRounds = 1;
            modDisplay.style.display = '';
            resetModifierSlot();
            document.getElementById('modeSubtitle').textContent = "DEALER'S CHOICE";
            break;
    }

    // Update chips
    document.getElementById('chipChambersVal').textContent = state.totalChambers;
    document.getElementById('chipLiveVal').textContent = state.liveRounds;

    loadChambers();
    state.rotation = 0;
    const cylinder = document.getElementById('cylinder');
    cylinder.style.transition = 'none';
    cylinder.style.transform = 'rotate(0deg)';
    setTimeout(() => { cylinder.style.transition = 'transform 3s var(--ease-out-expo)'; }, 50);

    renderCylinder();
    updateResult('🎯', 'Ready to play', '');
    document.getElementById('chamberNumber').textContent = '?';
    document.getElementById('btnFire').disabled = true;

    updateProbabilityArc();
    updateDangerLevel();
}

// ========== RENDER CYLINDER ==========
function renderCylinder() {
    const cylinder = document.getElementById('cylinder');
    cylinder.innerHTML = '';

    const radius = cylinder.offsetWidth / 2;
    const containerWidth = document.getElementById('cylinderContainer').offsetWidth;

    let chamberRadius, chamberSizeActual;
    if (containerWidth <= 240) {
        chamberRadius = 90; chamberSizeActual = 14;
    } else if (containerWidth <= 280) {
        chamberRadius = 108; chamberSizeActual = 18;
    } else {
        chamberRadius = 128; chamberSizeActual = 22;
    }

    // Show up to 40 chambers visually
    const visibleCount = Math.min(state.totalChambers, 40);
    const step = state.totalChambers / visibleCount;

    for (let i = 0; i < visibleCount; i++) {
        const chamberIndex = Math.round(i * step) % state.totalChambers;
        const angle = (i / visibleCount) * 360;
        const rad = (angle - 90) * (Math.PI / 180);

        const x = radius + chamberRadius * Math.cos(rad) - chamberSizeActual / 2;
        const y = radius + chamberRadius * Math.sin(rad) - chamberSizeActual / 2;

        const el = document.createElement('div');
        el.className = 'cylinder-chamber';
        el.dataset.chamberIndex = chamberIndex;
        el.dataset.visualIndex = i;
        el.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            width: ${chamberSizeActual}px;
            height: ${chamberSizeActual}px;
            transform-origin: center center;
        `;
        el.innerHTML = '<div class="chamber-dot"></div>';
        cylinder.appendChild(el);
    }
}

// ========== SPIN CYLINDER ==========
function spinCylinder() {
    if (state.isAnimating) return;

    AudioEngine.play('spin');
    state.isAnimating = true;

    const btnSpin = document.getElementById('btnSpin');
    const btnFire = document.getElementById('btnFire');
    const container = document.getElementById('cylinderContainer');
    const cylinder = document.getElementById('cylinder');

    btnSpin.disabled = true;
    btnFire.disabled = true;
    container.classList.add('spinning');

    // Reset chamber highlights
    document.querySelectorAll('.cylinder-chamber').forEach(ch => {
        ch.classList.remove('active', 'empty-revealed', 'live-revealed');
    });

    // Mode-specific setup before spin
    if (state.mode === 'dealer') {
        rollModifier();
    }

    // Load chambers based on mode & modifier
    let liveCount = state.liveRounds;
    if (state.mode === 'dealer' && state.currentModifier) {
        if (state.currentModifier.id === 'double') liveCount = 2;
        if (state.currentModifier.id === 'sniper') liveCount = 10;
        if (state.currentModifier.id === 'lucky') liveCount = 0;
    }

    state.chambers = new Array(state.totalChambers).fill(false);
    const indices = [];
    while (indices.length < Math.min(liveCount, state.totalChambers)) {
        const idx = Math.floor(Math.random() * state.totalChambers);
        if (!indices.includes(idx)) {
            indices.push(idx);
            state.chambers[idx] = true;
        }
    }

    state.currentChamber = Math.floor(Math.random() * state.totalChambers);

    const extraRotations = 5 + Math.floor(Math.random() * 5);
    const targetAngle = (state.currentChamber / state.totalChambers) * 360;
    const totalDegrees = extraRotations * 360 + targetAngle;
    state.rotation += totalDegrees;
    cylinder.style.transform = `rotate(${state.rotation}deg)`;

    const chamberNum = document.getElementById('chamberNumber');
    chamberNum.textContent = '?';

    updateResult('🎰', 'Spinning...', '');

    // Update chips for current round
    document.getElementById('chipChambersVal').textContent = state.totalChambers;
    document.getElementById('chipLiveVal').textContent = liveCount;

    setTimeout(() => {
        state.isAnimating = false;
        state.isSpun = true;
        container.classList.remove('spinning');

        chamberNum.textContent = state.currentChamber + 1;
        highlightActiveChamber();

        updateResult('🎯', `Chamber #${state.currentChamber + 1} aligned`, '');

        btnSpin.disabled = false;
        btnFire.disabled = false;

        AudioEngine.play('tick');

        // Start countdown if in countdown mode
        if (state.mode === 'countdown') {
            startCountdown();
        }

        updateProbabilityArc();
    }, 2600);
}

function highlightActiveChamber() {
    const chambers = document.querySelectorAll('.cylinder-chamber');
    let closestVisual = 0;
    let closestDist = Infinity;

    chambers.forEach((ch, i) => {
        const idx = parseInt(ch.dataset.chamberIndex);
        const dist = Math.abs(idx - state.currentChamber);
        if (dist < closestDist) {
            closestDist = dist;
            closestVisual = i;
        }
    });

    chambers.forEach((ch, i) => {
        ch.classList.remove('active');
        if (i === closestVisual) ch.classList.add('active');
    });
}

// ========== PULL TRIGGER ==========
function pullTrigger() {
    if (state.isAnimating || !state.isSpun) return;

    state.isAnimating = true;
    state.isSpun = false;

    // Stop countdown
    stopCountdown();

    // Record timestamp for speed demon
    state.pullTimestamps.push(Date.now());

    const btnSpin = document.getElementById('btnSpin');
    const btnFire = document.getElementById('btnFire');
    btnSpin.disabled = true;
    btnFire.disabled = true;

    let isLive = state.chambers[state.currentChamber];

    // Dealer's Choice modifier logic
    if (state.mode === 'dealer' && state.currentModifier) {
        const mod = state.currentModifier;

        if (mod.id === 'unknown') {
            // Pick a random real modifier
            const realMod = MODIFIERS[Math.floor(Math.random() * (MODIFIERS.length - 1))]; // exclude unknown
            state.currentModifier = realMod;
        }

        if (mod.id === 'shield' && isLive) {
            isLive = false; // protected!
        }

        if (mod.id === 'mirror') {
            const original = isLive;
            isLive = !isLive;
            if (original && !isLive) {
                // Mirror saved them
                unlockAchievement('plot_twist');
            }
        }

        if (mod.id === 'shuffle') {
            // Re-randomize right now
            const liveCount = state.chambers.filter(c => c).length;
            state.chambers = new Array(state.totalChambers).fill(false);
            const idxs = [];
            while (idxs.length < liveCount) {
                const idx = Math.floor(Math.random() * state.totalChambers);
                if (!idxs.includes(idx)) {
                    idxs.push(idx);
                    state.chambers[idx] = true;
                }
            }
            isLive = state.chambers[state.currentChamber];
        }

        if (mod.id === 'second-chance' && isLive) {
            state.secondChanceActive = true;
        }
    }

    // Suspense delay
    setTimeout(() => {
        if (state.secondChanceActive && isLive) {
            // Second chance: re-spin once
            state.secondChanceActive = false;
            AudioEngine.play('spin');
            updateResult('🔄', 'Second Chance! Re-rolling...', '');

            setTimeout(() => {
                state.currentChamber = Math.floor(Math.random() * state.totalChambers);
                isLive = state.chambers[state.currentChamber];
                resolveResult(isLive);
            }, 800);
            return;
        }

        resolveResult(isLive);
    }, 400);
}

function resolveResult(isLive) {
    if (isLive) {
        handleFire();
    } else {
        handleClick();
    }

    // Update stats
    state.totalAttempts++;
    if (isLive) {
        state.totalFired++;
        state.firedStreak++;
        state.currentStreak = 0;
    } else {
        state.totalSurvived++;
        state.currentStreak++;
        state.firedStreak = 0;
        if (state.currentStreak > state.bestStreak) {
            state.bestStreak = state.currentStreak;
        }
    }

    // Build history entry
    const liveCount = state.chambers.filter(c => c).length;
    const historyEntry = {
        attempt: state.totalAttempts,
        chamber: state.currentChamber + 1,
        result: isLive ? 'fired' : 'safe',
        odds: `${liveCount}/${state.totalChambers}`,
        mode: state.mode,
        modifier: state.mode === 'dealer' && state.currentModifier ? state.currentModifier.icon : null,
    };
    state.history.unshift(historyEntry);

    updateUI();
    renderHistory();
    checkAchievements(isLive);

    // Mode-specific post-pull
    const recoveryTime = isLive ? 2000 : 600;

    setTimeout(() => {
        state.isAnimating = false;

        if (state.mode === 'escalation' && !isLive) {
            // Advance to next level
            if (state.escalationLevel < ESCALATION_LEVELS.length - 1) {
                state.escalationLevel++;
                const newChambers = ESCALATION_LEVELS[state.escalationLevel];
                state.totalChambers = newChambers;
                state.liveRounds = 1;

                AudioEngine.play('level-up');
                renderEscalationLevels();
                updateResult('🌀', `Level ${state.escalationLevel + 1} — ${newChambers} Chambers!`, 'result-safe');

                document.getElementById('escalationInfo').textContent = `Level ${state.escalationLevel + 1} — ${newChambers} Chambers`;
                document.getElementById('chipChambersVal').textContent = newChambers;

                loadChambers();
                state.rotation = 0;
                const cyl = document.getElementById('cylinder');
                cyl.style.transition = 'none';
                cyl.style.transform = 'rotate(0deg)';
                setTimeout(() => { cyl.style.transition = 'transform 3s var(--ease-out-expo)'; }, 50);

                renderCylinder();
                updateDangerLevel();
                updateProbabilityArc();

                // Check iron will achievement
                if (state.escalationLevel >= 6) {
                    unlockAchievement('iron_will');
                }
            }
        }

        document.getElementById('btnSpin').disabled = false;
        document.getElementById('btnFire').disabled = true;

        updateDangerLevel();
    }, recoveryTime);
}

function handleClick() {
    AudioEngine.play('click');

    const chambers = document.querySelectorAll('.cylinder-chamber.active');
    chambers.forEach(ch => {
        ch.classList.remove('active');
        ch.classList.add('empty-revealed');
    });

    updateResult('😮‍💨', 'CLICK — Empty chamber!', 'result-safe');
    document.getElementById('chamberNumber').textContent = '✓';

    // Jackpot check: survived at 50% odds
    if (state.totalChambers === 2) {
        unlockAchievement('jackpot');
    }
}

function handleFire() {
    AudioEngine.play('fire');

    const flash = document.getElementById('flashOverlay');
    flash.classList.add('active');
    setTimeout(() => flash.classList.remove('active'), 700);

    const muzzle = document.getElementById('muzzleFlash');
    muzzle.classList.add('active');
    setTimeout(() => muzzle.classList.remove('active'), 600);

    const chambers = document.querySelectorAll('.cylinder-chamber.active');
    chambers.forEach(ch => {
        ch.classList.remove('active');
        ch.classList.add('live-revealed');
    });

    const container = document.getElementById('cylinderContainer');
    container.classList.add('fired');
    setTimeout(() => container.classList.remove('fired'), 2000);

    updateResult('💥', 'BANG! — Live round fired!', 'result-fired');
    document.getElementById('chamberNumber').textContent = '☠';

    document.body.style.animation = 'none';
    document.body.offsetHeight;
    document.body.style.animation = 'shake 0.5s ease';
    setTimeout(() => { document.body.style.animation = ''; }, 600);

    // Reset escalation on fire
    if (state.mode === 'escalation') {
        state.escalationLevel = 0;
        state.totalChambers = ESCALATION_LEVELS[0];
        setTimeout(() => {
            renderEscalationLevels();
            document.getElementById('escalationInfo').textContent = `Level 1 — ${ESCALATION_LEVELS[0]} Chambers — Reset!`;
            document.getElementById('chipChambersVal').textContent = state.totalChambers;
            loadChambers();
            renderCylinder();
            updateDangerLevel();
            updateProbabilityArc();
        }, 1500);
    }
}

// ========== COUNTDOWN MODE ==========
function startCountdown() {
    const duration = 5000; // 5 seconds
    state.countdownStartTime = Date.now();
    state.countdownRemaining = 5;

    const ringFill = document.getElementById('countdownRingFill');
    const numDisplay = document.getElementById('countdownNumber');
    const circumference = 2 * Math.PI * 165;

    ringFill.style.stroke = '#4488ff';
    numDisplay.classList.remove('urgent');

    state.countdownTimer = setInterval(() => {
        const elapsed = Date.now() - state.countdownStartTime;
        const remaining = Math.max(0, duration - elapsed);
        const fraction = remaining / duration;

        state.countdownRemaining = remaining / 1000;

        // Update ring
        ringFill.setAttribute('stroke-dashoffset', (1 - fraction) * circumference);

        // Update number
        numDisplay.textContent = (remaining / 1000).toFixed(1);

        // Color shift
        if (remaining < 2000) {
            ringFill.style.stroke = '#ff3b3b';
            numDisplay.classList.add('urgent');
            if (remaining > 100 && Math.floor(remaining / 500) !== Math.floor((remaining + 16) / 500)) {
                AudioEngine.play('countdown-tick');
            }
        } else if (remaining < 3500) {
            ringFill.style.stroke = '#ffcc44';
        }

        // Auto-fire at 0
        if (remaining <= 0) {
            stopCountdown();
            numDisplay.textContent = '0.0';

            // Auto-fire with double rounds!
            state.liveRounds = 2;
            state.chambers = new Array(state.totalChambers).fill(false);
            const idxs = [];
            while (idxs.length < 2) {
                const idx = Math.floor(Math.random() * state.totalChambers);
                if (!idxs.includes(idx)) {
                    idxs.push(idx);
                    state.chambers[idx] = true;
                }
            }
            document.getElementById('chipLiveVal').textContent = 2;
            updateResult('⏱️', 'TOO SLOW! Double rounds loaded!', 'result-fired');

            setTimeout(() => {
                if (state.isSpun) {
                    pullTrigger();
                }
            }, 500);
        }
    }, 16);
}

function stopCountdown() {
    if (state.countdownTimer) {
        clearInterval(state.countdownTimer);
        state.countdownTimer = null;
    }
    // Check last second achievement
    if (state.mode === 'countdown' && state.countdownRemaining < 1 && state.countdownRemaining > 0) {
        unlockAchievement('last_second');
    }
}

// ========== DEALER'S CHOICE ==========
function rollModifier() {
    const slot = document.getElementById('modifierSlot');
    const icon = document.getElementById('modifierIcon');
    const name = document.getElementById('modifierName');
    const desc = document.getElementById('modifierDesc');

    // Remove old modifier classes
    MODIFIERS.forEach(m => slot.classList.remove(m.cssClass));

    // Spinning animation
    slot.classList.add('spinning');
    slot.classList.remove('revealed');
    AudioEngine.play('modifier');

    // Pick random modifier
    const mod = MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];
    state.currentModifier = mod;

    // Reveal after delay
    setTimeout(() => {
        slot.classList.remove('spinning');
        slot.classList.add('revealed');
        slot.classList.add(mod.cssClass);
        icon.textContent = mod.icon;
        name.textContent = mod.name;
        desc.textContent = mod.desc;
    }, 1200);
}

function resetModifierSlot() {
    const slot = document.getElementById('modifierSlot');
    MODIFIERS.forEach(m => slot.classList.remove(m.cssClass));
    slot.classList.remove('spinning', 'revealed');
    document.getElementById('modifierIcon').textContent = '❓';
    document.getElementById('modifierName').textContent = 'Spin to reveal';
    document.getElementById('modifierDesc').textContent = 'A random modifier will change the rules';
    state.currentModifier = null;
}

// ========== ESCALATION ==========
function renderEscalationLevels() {
    const container = document.getElementById('escalationLevels');
    container.innerHTML = '';

    ESCALATION_LEVELS.forEach((chambers, i) => {
        if (i > 0) {
            const conn = document.createElement('div');
            conn.className = 'esc-connector' + (i <= state.escalationLevel ? ' completed' : '');
            container.appendChild(conn);
        }

        const level = document.createElement('div');
        level.className = 'esc-level';
        if (i < state.escalationLevel) level.classList.add('completed');
        if (i === state.escalationLevel) level.classList.add('current');
        if (i > state.escalationLevel) level.classList.add('locked');
        level.textContent = chambers;
        container.appendChild(level);
    });
}

// ========== PROBABILITY VISUALIZER ==========
function updateProbabilityArc() {
    const liveCount = state.chambers ? state.chambers.filter(c => c).length : state.liveRounds;
    const survivalOdds = state.totalChambers > 0 ? ((state.totalChambers - liveCount) / state.totalChambers) * 100 : 0;
    const circumference = 2 * Math.PI * 170;

    const arcFill = document.getElementById('probArcFill');
    const offset = (1 - survivalOdds / 100) * circumference;
    arcFill.setAttribute('stroke-dashoffset', offset);

    // Update text
    const probValue = document.getElementById('probValue');
    probValue.textContent = `${survivalOdds.toFixed(1)}%`;

    // Color based on odds
    if (survivalOdds >= 80) {
        probValue.style.color = '#44ff88';
    } else if (survivalOdds >= 50) {
        probValue.style.color = '#ffcc44';
    } else if (survivalOdds >= 20) {
        probValue.style.color = '#ff8844';
    } else {
        probValue.style.color = '#ff3b3b';
    }

    document.getElementById('probDetail').textContent = `${liveCount} live / ${state.totalChambers} chambers`;
}

// ========== DANGER LEVEL THEMING ==========
function updateDangerLevel() {
    const body = document.getElementById('appBody');
    body.classList.remove('danger-low', 'danger-medium', 'danger-high', 'danger-critical');

    if (state.totalChambers <= 3) {
        body.classList.add('danger-critical');
    } else if (state.totalChambers <= 10) {
        body.classList.add('danger-high');
    } else if (state.totalChambers <= 50) {
        body.classList.add('danger-medium');
    } else {
        body.classList.add('danger-low');
    }
}

// ========== RESET ==========
function resetGame() {
    if (state.isAnimating) return;

    stopCountdown();
    state.isSpun = false;
    state.currentChamber = 0;
    state.rotation = 0;
    state.secondChanceActive = false;

    if (state.mode === 'escalation') {
        state.escalationLevel = 0;
        state.totalChambers = ESCALATION_LEVELS[0];
        renderEscalationLevels();
        document.getElementById('escalationInfo').textContent = `Level 1 — ${ESCALATION_LEVELS[0]} Chambers`;
    }

    if (state.mode === 'dealer') {
        resetModifierSlot();
    }

    if (state.mode === 'countdown') {
        const ringFill = document.getElementById('countdownRingFill');
        ringFill.setAttribute('stroke-dashoffset', 0);
        document.getElementById('countdownNumber').textContent = '5.0';
        document.getElementById('countdownNumber').classList.remove('urgent');
    }

    state.liveRounds = 1;
    loadChambers();

    document.getElementById('chipChambersVal').textContent = state.totalChambers;
    document.getElementById('chipLiveVal').textContent = state.liveRounds;

    const cylinder = document.getElementById('cylinder');
    cylinder.style.transition = 'none';
    cylinder.style.transform = 'rotate(0deg)';
    setTimeout(() => { cylinder.style.transition = 'transform 3s var(--ease-out-expo)'; }, 50);

    document.querySelectorAll('.cylinder-chamber').forEach(ch => {
        ch.classList.remove('active', 'empty-revealed', 'live-revealed');
    });

    renderCylinder();
    document.getElementById('chamberNumber').textContent = '?';
    document.getElementById('btnFire').disabled = true;

    updateResult('🎯', 'Ready to play', '');
    updateProbabilityArc();
    updateDangerLevel();
}

// ========== ACHIEVEMENTS ==========
function loadAchievements() {
    try {
        const saved = localStorage.getItem('revolver_achievements');
        if (saved) {
            state.unlockedAchievements = new Set(JSON.parse(saved));
        }
    } catch(e) { /* ignore */ }
    updateBadgeCount();
}

function saveAchievements() {
    try {
        localStorage.setItem('revolver_achievements', JSON.stringify([...state.unlockedAchievements]));
    } catch(e) { /* ignore */ }
}

function unlockAchievement(id) {
    if (state.unlockedAchievements.has(id)) return;

    state.unlockedAchievements.add(id);
    saveAchievements();
    updateBadgeCount();

    const ach = ACHIEVEMENTS.find(a => a.id === id);
    if (!ach) return;

    // Show toast
    const toast = document.getElementById('achievementToast');
    document.getElementById('toastIcon').textContent = ach.icon;
    document.getElementById('toastName').textContent = ach.name;
    toast.classList.add('visible');

    AudioEngine.play('achievement');
    fireConfetti();

    setTimeout(() => toast.classList.remove('visible'), 3500);

    // Update drawer if open
    renderAchievements();
}

function checkAchievements(wasFired) {
    if (wasFired) {
        if (state.totalFired >= 1) unlockAchievement('first_blood');
        if (state.totalFired >= 10) unlockAchievement('death_wish');
        if (state.firedStreak >= 3) unlockAchievement('unlucky');
    } else {
        if (state.currentStreak >= 10) unlockAchievement('hot_streak');
        if (state.currentStreak >= 25) unlockAchievement('ice_cold');
        if (state.currentStreak >= 50) unlockAchievement('diamond');
        if (state.totalSurvived >= 100) unlockAchievement('untouchable');
    }

    // Speed demon: 5 pulls in under 10 seconds
    const now = Date.now();
    const recent = state.pullTimestamps.filter(t => now - t < 10000);
    state.pullTimestamps = recent; // prune old
    if (recent.length >= 5) {
        unlockAchievement('speed_demon');
    }
}

function updateBadgeCount() {
    document.getElementById('badgeCount').textContent = state.unlockedAchievements.size;
}

function renderAchievements() {
    const grid = document.getElementById('badgeGrid');
    grid.innerHTML = ACHIEVEMENTS.map(ach => {
        const unlocked = state.unlockedAchievements.has(ach.id);
        return `
            <div class="badge-card ${unlocked ? 'unlocked' : 'locked'}">
                <span class="badge-emoji">${ach.icon}</span>
                <span class="badge-name">${ach.name}</span>
                <span class="badge-desc">${ach.desc}</span>
            </div>
        `;
    }).join('');
}

function toggleAchievements() {
    const drawer = document.getElementById('achievementDrawer');
    const backdrop = document.getElementById('achievementBackdrop');
    const isOpen = drawer.classList.contains('open');

    drawer.classList.toggle('open');
    backdrop.classList.toggle('open');

    if (!isOpen) renderAchievements();
}

// ========== CONFETTI ==========
function fireConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#ff3b3b', '#ff8844', '#ffd700', '#44ff88', '#4488ff', '#aa66ff', '#44ddff'];

    for (let i = 0; i < 80; i++) {
        pieces.push({
            x: canvas.width / 2 + (Math.random() - 0.5) * 200,
            y: canvas.height / 3,
            vx: (Math.random() - 0.5) * 15,
            vy: -Math.random() * 12 - 4,
            size: Math.random() * 8 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 10,
            gravity: 0.25 + Math.random() * 0.15,
            opacity: 1,
        });
    }

    let frame = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;

        pieces.forEach(p => {
            p.x += p.vx;
            p.vy += p.gravity;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;
            p.vx *= 0.99;
            p.opacity -= 0.008;

            if (p.opacity > 0 && p.y < canvas.height + 50) {
                alive = true;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation * Math.PI / 180);
                ctx.globalAlpha = Math.max(0, p.opacity);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                ctx.restore();
            }
        });

        frame++;
        if (alive && frame < 200) {
            requestAnimationFrame(animate);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    animate();
}

// ========== UI UPDATES ==========
function updateResult(emoji, text, className) {
    const content = document.getElementById('resultContent');
    document.getElementById('resultEmoji').textContent = emoji;
    document.getElementById('resultText').textContent = text;
    content.className = 'result-content' + (className ? ` ${className}` : '');
}

function updateUI() {
    document.getElementById('totalAttempts').textContent = state.totalAttempts;
    document.getElementById('totalSurvived').textContent = state.totalSurvived;
    document.getElementById('totalFired').textContent = state.totalFired;
    document.getElementById('currentStreak').textContent = state.currentStreak;
    document.getElementById('bestStreak').textContent = state.bestStreak;

    if (state.totalAttempts > 0) {
        const rate = ((state.totalSurvived / state.totalAttempts) * 100).toFixed(1);
        document.getElementById('survivalRate').textContent = `${rate}%`;
    } else {
        document.getElementById('survivalRate').textContent = '—';
    }
}

function renderHistory() {
    const log = document.getElementById('historyLog');

    if (state.history.length === 0) {
        log.innerHTML = '<div class="history-empty">No pulls yet — spin the cylinder to begin</div>';
        return;
    }

    log.innerHTML = state.history.slice(0, 50).map(entry => `
        <div class="history-entry ${entry.result}">
            <div class="history-number">#${entry.attempt}</div>
            <div class="history-icon">${entry.result === 'safe' ? '✅' : '💥'}</div>
            <div class="history-details">
                <div class="history-result">
                    ${entry.result === 'safe' ? 'Empty — Survived' : 'BANG — Fired!'}
                    ${entry.modifier ? `<span style="margin-left:4px">${entry.modifier}</span>` : ''}
                </div>
                <div class="history-chamber">Chamber #${entry.chamber} • ${entry.mode}</div>
            </div>
            <div class="history-odds">${entry.odds}</div>
        </div>
    `).join('');
}

// ========== PARTICLES ==========
function createParticles() {
    const container = document.getElementById('particles');
    const count = 30;

    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        const size = Math.random() * 3 + 1;
        particle.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            background: rgba(255, 255, 255, ${Math.random() * 0.04 + 0.01});
            border-radius: 50%;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation: particle-drift ${15 + Math.random() * 20}s linear infinite;
            animation-delay: ${-Math.random() * 20}s;
        `;
        container.appendChild(particle);
    }

    const style = document.createElement('style');
    style.textContent = `
        @keyframes particle-drift {
            0% { transform: translateY(0) translateX(0); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateY(-100vh) translateX(${Math.random() > 0.5 ? '' : '-'}50px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// ========== RESIZE ==========
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        renderCylinder();
        if (state.isSpun) highlightActiveChamber();
    }, 250);
});

// ========== BOOTSTRAP ==========
document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    init();
});
