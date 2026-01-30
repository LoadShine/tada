# Changelog

## Version 0.3.4 (Current)
*Release Date: January 30, 2026*

### ✨ New Features
- **Log System**: Added log logic allowing users to access the log folder directly through the system tray to view application logs (Fixes #22).
- **User Settings**: Introduced User Profile Settings (Fixes #21).
- **AI Refinement**: Added support for secondary AI adjustment and polishing of created task content.
- **ICS Export**: Enabled the functionality to export calendar events as `.ics` files.
- **Daily Reports**: Added the ability to generate daily reports and responses at regular intervals (Fixes #8, #18).
- **Task Matching**: New tasks are now automatically matched to the appropriate list.
- **Alert Events**: Added support for alert events.

### 🐛 Bug Fixes
- Fixed an issue where the "Report Issue" button in Tauri failed to open the external browser.
- Solved the problem where icons for ordered lists within the bubble menu were not displayed.
- Fixed a logic error to ensuring that if a user is viewing a specific list, new tasks use that list as the context.

### ❤️ Contributors
Special thanks to the contributors of this release:
**@yili1992**

---

## Version 0.3.3
*Release Date: Jan 5, 2026*

### ✨ New Features & Improvements
- **Accessibility**: Introduced adjustable text size and font weight settings for improved accessibility (fixes #5, #7).
- **Proxy Configuration**: Added support for configuring a proxy connection.
- **Custom Models**: Allowed users to manually input custom model IDs (fixes #1).
- **UI Adjustment**: Moved the "Back to Application" button on the "View Full Version" page to the upper left corner (fixes #14).
- **AI Optimization**: Optimized the logic for AI services usability testing and updated the prompt for generating AI tasks.
- **UI Tweak**: Adjusted the placeholder text for the custom service URL (fixes #12).

### 🐛 Bug Fixes
- **Subtasks**: Fixed an issue that caused duplicate subtask creation.
- **Input Handling**: Resolved an issue with IME composition (e.g., Pinyin/Kana input) in input fields to prevent premature task creation while typing.

---

## Version 0.3.2
*Release Date: December 31, 2025*

### ✨ New Features
- **AI Task Option**: Added a toggle option for "Always use AI task".
- **Model Selection**: Introduced a Model Combo Box for better model selection experience, including translation support.
- **UI Improvement**: The "Always Use AI Task" button is now disabled if the AI API Key is not configured.
- **Echo Function**: The Echo function will now display an alert when the API Key is missing.

### 🐛 Bug Fixes
- Fixed an issue regarding the wrong Ollama endpoint and JSON parsing errors.

### ❤️ Contributors
Special thanks to the contributors of this release:
**@Sheepion**

---

## Version 0.3.1
*Release Date: December 30, 2025*

### 🐛 Bug Fixes
- **Echo Function**: The echo function is enabled by default

---

## Version 0.3.0
*Release Date: December 30, 2025*

### ✨ New Features
- **Echo Function**: Added the new "Echo" function.
- **Context**: Images no longer participate in the model context.
- **UI Update**: Modified and improved the display interface for the Echo function.

### 🐛 Bug Fixes
- Fixed a bug where the `includeEcho` attribute was missing from `importOptions` when importing data.
- Fixed an issue where images would incorrectly turn into strings when deleted.

---

## Version 0.2.1
*Release Date: December 24, 2025*

### 🐛 Bug Fixes
- Urgent fix: The move to today feature on the zen mode page may cause the remaining tasks to hide

---

## Version 0.2.0
*Release Date: December 22, 2025*

### ✨ New Features
- **Tada Zen Mode**: Added a quick delete button for tasks.
- **Tada Zen Mode**: Supported moving expired tasks to "Today" with one click.

### 🐛 Bug Fixes
- Fixed the issue where the "month and day" display in Tada Zen Mode would wrap lines on certain screen resolutions.
- Fixed the issue where the Tada Zen Mode page could not be dragged.
- Fixed the problem where images could not be dragged into the desktop app.

---

## Version 0.1.3
*Released: December 8, 2025*

### ✨ New Features
- **Added Zen Mode**: Introduced a new Zen Mode for a distraction-free experience.
- **Visual Update**: Updated the background styling for Zen Mode.

### 🐛 Bug Fixes
- **Tauri Compatibility**: Fixed an issue where the full-screen functionality in Zen Mode was unavailable in the Tauri environment.

---

## Version 0.1.2
*Released: November 27, 2025*

### ✨ Improvements
- **Tray Icon Optimization**: Optimized the display of the system tray icon.
- **Close Button Behavior**: The close button now hides the application (minimizes to background) instead of exiting the program completely.

### 🐛 Bug Fixes
- **List Display Issue**: Fixed an issue where newly created lists would not appear immediately in the interface.
- **Data Preservation**: Resolved a bug where the last modification was not saved/lost when closing the application.

---

## Version 0.1.1
*Released: November 24, 2025*

### ✨ New Features
- **AI Settings**: When the api-key is not set, clicking on "AI Task" will automatically redirect to the ai Settings page

### 🔧 Changes
- **README updated**: Add screenshots of the application

### 🐛 Bug Fixes
- Some problems have been solved