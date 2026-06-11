# Revolver Simulator — 100 Chambers

An interactive, multi-mode revolver simulator web application with customizable mechanics, dynamic danger visual states, Synthesized Web Audio API sound effects, and unlockable achievements. 

Built with vanilla HTML5, custom CSS (glassmorphism/dark styling), and vanilla JavaScript.

![Revolver Simulator Preview](https://raw.githubusercontent.com/SyraXuz/revolver-sim/main/assets/preview.png) *(Placeholder path or replaced by actual images)*

## 🎮 Game Modes

1. **🎯 Classic Mode**
   * Fully configurable cylinder.
   * Adjust chamber count from **2 to 100**.
   * Adjust live bullets count.
   * Real-time shot probability calculation and visualization.

2. **🌀 Escalation Mode**
   * The cylinder shrinks! Start with 100 chambers and 1 bullet.
   * Every successful blank shot collapses a chamber, increasing the pressure and the probability of a shot on the next pull.

3. **⏱️ Countdown Mode**
   * Shifting layouts and timed targets. 
   * High stakes, fast-paced action.

4. **🎰 Dealer's Choice**
   * Chaos modifiers and presets (e.g., Coin Flip, Insane, Classic).
   * Random chamber counts and shifting live bullet distributions.

## 🛠️ Features

* **Dynamic Danger UI**: The background theme and particle systems change in response to the current threat probability (Low, Medium, High, Extreme).
* **Audio Engine**: Synthesized sound effects generated dynamically via Web Audio API (spinning cylinder, clicking trigger, firing, reloading). No external audio files required.
* **12 Unlockable Achievements**: LocalStorage-persisted achievements and stats (e.g., "Barely Alive", "Centurion Survivor", "Russian Roulette Veteran").
* **Modifiers & Presets**: Easily adjust settings via predefined presets or customize sliders manually.
* **Pure Static Implementation**: Zero external dependencies. Runs completely in the browser.

## 🚀 Getting Started

Since the project is built using vanilla HTML, CSS, and JS, you don't need any complex build pipelines or bundlers to run it.

### Prerequisites

You need a simple HTTP server to run the application (due to Web Audio API browser security and modules policies, running via `file://` directly is discouraged).

### Running Locally

1. **Using Python**:
   ```bash
   python -m http.server 8000
   ```
   Then navigate to `http://localhost:8000`.

2. **Using Node.js (`http-server`)**:
   ```bash
   npx http-server -p 8000
   ```
   Then navigate to `http://localhost:8000`.

3. **Using VS Code Live Server**:
   Right-click `index.html` and select **Open with Live Server**.

## 📁 Project Structure

```
revolver-sim/
│
├── index.html     # Page structure & SVG graphics
├── style.css      # Core styling, glassmorphism, & dynamic animations
├── app.js         # Audio synthesizer, state machine, & game modes logic
└── .gitignore     # Git ignore patterns
```

## 📜 License

This project is licensed under the MIT License.
