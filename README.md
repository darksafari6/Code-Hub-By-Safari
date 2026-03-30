# Safari AI Dev Studio

A next-generation, autonomous AI Developer Studio built for Linux (Zorin OS).

## 🚀 Features

- **Autonomous AI System:** Multi-agent planning (Planner, Executor, Debugger, Reviewer, Tester, DevOps)
- **Real-time Code Editing:** Monaco editor with live synchronization
- **Secure Sandbox:** All code execution happens in a secure `/workspace` environment
- **Native Terminal:** Integrated `xterm.js` connected to a real `bash` shell
- **Bonus Features:**
  - Offline mode with local AI fallback
  - AI self-learning system & smart caching
  - Multi-output tabs (Preview, Console, Network)
  - Split-screen resizing
  - Auto-update system

## 🛠️ Installation (Zorin OS / Ubuntu / Debian)

1. **Run the setup script:**
   ```bash
   ./setup.sh
   ```
   This will install all necessary system dependencies, Node.js, and npm packages.

2. **Start the Studio:**
   ```bash
   ./run.sh
   ```

## 📦 Building a Desktop App (.deb)

To package the studio into a standalone `.deb` installer for Zorin OS:

```bash
./build.sh
```

The compiled package will be available in the `dist` directory.

## 🤖 How to use Auto Mode

1. Open the studio.
2. Click the **Auto Mode** button in the top right.
3. Type your request (e.g., "Build a snake game").
4. Watch the autonomous agents plan, write code, debug, and deploy your app instantly in the Live Preview!
