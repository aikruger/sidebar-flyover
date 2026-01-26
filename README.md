# Sidebar Flyover Plus

**Sidebar Flyover Plus** is an Obsidian plugin that supercharges your sidebar experience. It allows sidebars to expand automatically on hover, pin them open when needed, and dock them to push content aside—all with smooth animations and deep customization.

## Features

- **Hover Expansion**: Automatically expand the left or right sidebar when your mouse approaches the screen edge.
- **Overlay Mode**: By default, sidebars float *over* your content, preserving your layout.
- **Pinning**: Keep a sidebar permanently open with the "Pin" button.
- **Docking (Pegging)**: "Peg" a sidebar to disable overlay mode for that side, forcing it to push your content aside (standard split behavior) while keeping it expanded.
- **Dynamic Width**: Optionally allow sidebars to automatically resize based on their content width.
- **Sync Sidebars**: Option to expand both sidebars simultaneously when either is triggered.
- **Customizable**: extensive settings for timing, triggers, widths, and animation speeds.

## Usage

### Hovering
Move your mouse cursor to the far left or right edge of the Obsidian window. The respective sidebar will slide out. Move your mouse away, and it will slide back (collapse) after a short delay.

### Interface Buttons
The plugin adds two buttons to the top of each sidebar (in the tab header area):

1.  **Pin Icon** (📌):
    -   Click to **Pin** the sidebar.
    -   When pinned, the sidebar stays open and won't auto-collapse.
    -   Click again to unpin and resume hover behavior.

2.  **Square/Dock Icon** (🔳):
    -   Click to **Dock** (or "Peg") the sidebar.
    -   This switches the sidebar from "Overlay" mode to "Push" mode.
    -   The sidebar will stay expanded and shift your main note content to the side.

### Settings

You can fine-tune the plugin in **Settings > Sidebar Flyover Plus**:

#### General
-   **Enable Left/Right Sidebar Hover**: Toggle functionality for each side.
-   **Sync Left & Right**: If enabled, triggering one sidebar opens both.
-   **Overlay Mode**: Global toggle for whether sidebars float over content (default) or push it.

#### Behavior
-   **Trigger Area (px)**: How close (in pixels) the mouse must be to the edge to trigger expansion.

#### Timing
-   **Expand Delay**: How long to hover before the sidebar opens (prevents accidental triggers).
-   **Collapse Delay**: How long the sidebar waits to close after you leave it.
-   **Animation Speed**: Speed of the slide animation.

#### Appearance & Dimensions
-   **Max Width**: Set the maximum width for expanded sidebars.
-   **Dynamic Width**: Enable auto-resizing based on sidebar content (experimental).
-   **Min Width**: Minimum width when using dynamic sizing.

## Commands

The plugin provides several commands accessible via the Command Palette (`Ctrl/Cmd + P`):

-   `Toggle Left Sidebar Pin`
-   `Toggle Right Sidebar Pin`
-   `Toggle Left Sidebar Dock`
-   `Toggle Right Sidebar Dock`
-   `Expand Left Sidebar` / `Collapse Left Sidebar`
-   `Expand Right Sidebar` / `Collapse Right Sidebar`
-   `Expand Both Sidebars` / `Collapse Both Sidebars`

## Installation

1.  Download the latest release (`main.js`, `styles.css`, `manifest.json`) from the GitHub Releases page.
2.  Create a folder named `sidebar-flyover-plus` in your vault's plugin folder: `.obsidian/plugins/sidebar-flyover-plus`.
3.  Place the downloaded files into that folder.
4.  Reload Obsidian.
5.  Enable "Sidebar Flyover Plus" in **Settings > Community Plugins**.

## Support

If you find this plugin useful, consider supporting the development!

https://obsidian.md/pricing

---
*Created by Jules*
