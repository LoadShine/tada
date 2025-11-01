# Tada - A Modern, Offline-First, AI-Powered Task Management App

[中文简介](README.zh-CN.md)

**Tada** is more than just a to-do list. It's an intelligent, private, and highly customizable task-management workspace that runs entirely in your browser. It combines a powerful AI assistant with a seamless user experience to help you plan, execute, and summarize your work like never before.

## ✨ Core Features

*   **🚀 Offline-First & Privacy-Focused**:
    *   **No registration, no login required**. All your data is securely stored in your browser's local storage.
    *   Your tasks, lists, and settings are yours alone and are never sent to any server.

*   **🤖 Powerful AI Assistant**:
    *   **AI Task Creation**: Simply describe a task in natural language (e.g., "Plan a team-building event for next month"), and AI will automatically break it down into a structured task with a detailed description, subtasks, tags, and priority.
    *   **AI Work Summary**: Generate professional, insightful Markdown reports from your completed and future tasks with a single click.
    *   **Highly Configurable**: Freely choose and configure your preferred AI provider, including OpenAI, Claude, Gemini, Ollama (for local models), and many others.

*   **✍️ Advanced Markdown Editor (Moondown)**:
    *   A rich WYSIWYG Markdown editor is built-in.
    *   Features a **bubble menu** for quick formatting and **slash commands (`/`)** to instantly insert elements like tables and lists.
    *   Integrated **AI text continuation** helps you effortlessly complete your notes and documents.

*   **✅ Comprehensive Task Organization**:
    *   Organize your tasks clearly with **lists**, **tags**, **due dates**, and **priorities**.
    *   Supports **subtasks** to break down complex work into manageable steps.
    *   Intuitive **drag-and-drop** functionality to easily reorder tasks.

*   **📅 Multiple Views**:
    *   In addition to the classic list view, it offers a **Calendar View** to give you a clear overview of your deadlines.

*   **🎨 Highly Customizable**:
    *   Supports **Light**, **Dark**, and **System** appearance modes.
    *   Comes with multiple **theme colors** to personalize the application's look and feel.
    *   Supports both **English** and **Chinese** languages.

## 🛠️ Tech Stack

*   **Frontend Framework**: React + TypeScript
*   **Build Tool**: Vite
*   **State Management**: Jotai
*   **Routing**: React Router
*   **Styling**: Tailwind CSS
*   **UI Components**: Radix UI (Headless) & Lucide Icons
*   **Markdown Editor**: Moondown (based on CodeMirror 6)
*   **Drag & Drop**: @dnd-kit

## 🚀 Getting Started

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-username/tada.git
    cd tada
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Start the development server**:
    ```bash
    npm run dev
    ```
    The application will be running at `http://localhost:5173` (or another available port).

4.  **Configure AI Features (Optional)**:
    *   After launching the app, click the settings icon in the bottom-left corner.
    *   Navigate to the "AI Settings" tab.
    *   Select your desired AI provider and enter your API Key and other required information.
    *   Click "Test Connection" to verify your setup.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## 📄 License

This project is licensed under the [MIT License](LICENSE).