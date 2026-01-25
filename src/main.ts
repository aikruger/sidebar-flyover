import { App, Plugin, PluginSettingTab, Setting, WorkspaceSidedock, setIcon } from 'obsidian';
import { SidebarHoverSettings, DEFAULT_SETTINGS, SidebarFlyoverSettingTab } from './settings';

export default class SidebarFlyoverPlus extends Plugin {
    settings: SidebarHoverSettings;
    leftSplit: any;
    rightSplit: any;
    leftRibbon: any;
    isHoveringLeft: boolean = false;
    isHoveringRight: boolean = false;

    // Handler function references
    documentClickHandler: (e: MouseEvent) => void;
    mouseMoveHandler: (e: MouseEvent) => void;

    // Sidebar Event Handlers
    leftSplitMouseEnterHandler: (e: MouseEvent) => void;
    leftSplitMouseMoveHandler: (e: MouseEvent) => void;
    leftSplitMouseLeaveHandler: (e: MouseEvent) => void;

    rightSplitMouseEnterHandler: (e: MouseEvent) => void;
    rightSplitMouseMoveHandler: (e: MouseEvent) => void;
    rightSplitMouseLeaveHandler: (e: MouseEvent) => void;

    leftRibbonMouseEnterHandler: (e: MouseEvent) => void;

    // Resize Observers
    leftResizeObserver: ResizeObserver;
    rightResizeObserver: ResizeObserver;

    // Check buttons interval
    checkButtonsInterval: NodeJS.Timeout;

    async onload() {
        await this.loadSettings();

        // Add body classes
        document.body.classList.add('open-sidebar-hover-plugin');
        if (this.settings.overlayMode) {
            document.body.classList.add('sidebar-overlay-mode');
        }

        this.applyCSSVariables();

        this.app.workspace.onLayoutReady(() => {
            this.leftSplit = this.app.workspace.leftSplit;
            this.rightSplit = this.app.workspace.rightSplit;
            this.leftRibbon = (this.app.workspace as any).leftRibbon; // Access ribbon if available

            // Apply widths
            this.applySidebarWidth(this.leftSplit, this.settings.leftSidebarMaxWidth);
            this.applySidebarWidth(this.rightSplit, this.settings.rightSidebarMaxWidth);

            // Register handlers
            this.registerHandlers();

            // Add UI buttons (Pin/Peg)
            this.addSidebarButtons(this.leftSplit, true);
            this.addSidebarButtons(this.rightSplit, false);

            // Setup dynamic width
            this.setupDynamicWidth();

            // Apply initial Peg state
            this.updatePegState();

            // Re-check buttons periodically to ensure they persist
            // when other plugins manipulate the sidebar
            this.checkButtonsInterval = setInterval(() => {
                this.ensureButtonsPersist();
            }, 2000); // Check every 2 seconds

            // ===== ADD COMMANDS FOR COMMANDER PLUGIN =====

            // LEFT SIDEBAR PIN COMMAND
            this.addCommand({
                id: "sidebar-flyover-plus-toggle-left-pin",
                name: "Toggle Left Sidebar Pin",
                callback: () => {
                    console.log("Command: Toggle Left Sidebar Pin");
                    this.settings.leftSidebarPinned = !this.settings.leftSidebarPinned;
                    this.saveSettings();

                    if (this.leftSplit) {
                        this.updatePinState(this.leftSplit, this.settings.leftSidebarPinned, this.leftPinButton);
                        if (this.settings.leftSidebarPinned) {
                            this.expandLeft();
                        } else {
                            this.collapseLeft();
                        }
                    }
                }
            });

            // LEFT SIDEBAR DOCK/PEG COMMAND
            this.addCommand({
                id: "sidebar-flyover-plus-toggle-left-dock",
                name: "Toggle Left Sidebar Dock",
                callback: () => {
                    console.log("Command: Toggle Left Sidebar Dock");
                    this.toggleDockState(true); // true = left
                }
            });

            // RIGHT SIDEBAR PIN COMMAND
            this.addCommand({
                id: "sidebar-flyover-plus-toggle-right-pin",
                name: "Toggle Right Sidebar Pin",
                callback: () => {
                    console.log("Command: Toggle Right Sidebar Pin");
                    this.settings.rightSidebarPinned = !this.settings.rightSidebarPinned;
                    this.saveSettings();

                    if (this.rightSplit) {
                        this.updatePinState(this.rightSplit, this.settings.rightSidebarPinned, this.rightPinButton);
                        if (this.settings.rightSidebarPinned) {
                            this.expandRight();
                        } else {
                            this.collapseRight();
                        }
                    }
                }
            });

            // RIGHT SIDEBAR DOCK/PEG COMMAND
            this.addCommand({
                id: "sidebar-flyover-plus-toggle-right-dock",
                name: "Toggle Right Sidebar Dock",
                callback: () => {
                    console.log("Command: Toggle Right Sidebar Dock");
                    this.toggleDockState(false); // false = right
                }
            });

            // BONUS: Commands to expand/collapse without affecting pin state
            this.addCommand({
                id: "sidebar-flyover-plus-expand-left",
                name: "Expand Left Sidebar",
                callback: () => {
                    console.log("Command: Expand Left Sidebar");
                    this.expandLeft();
                }
            });

            this.addCommand({
                id: "sidebar-flyover-plus-collapse-left",
                name: "Collapse Left Sidebar",
                callback: () => {
                    console.log("Command: Collapse Left Sidebar");
                    this.collapseLeft();
                }
            });

            this.addCommand({
                id: "sidebar-flyover-plus-expand-right",
                name: "Expand Right Sidebar",
                callback: () => {
                    console.log("Command: Expand Right Sidebar");
                    this.expandRight();
                }
            });

            this.addCommand({
                id: "sidebar-flyover-plus-collapse-right",
                name: "Collapse Right Sidebar",
                callback: () => {
                    console.log("Command: Collapse Right Sidebar");
                    this.collapseRight();
                }
            });

            // BONUS: Sync commands
            this.addCommand({
                id: "sidebar-flyover-plus-expand-both",
                name: "Expand Both Sidebars",
                callback: () => {
                    console.log("Command: Expand Both Sidebars");
                    this.expandBoth();
                }
            });

            this.addCommand({
                id: "sidebar-flyover-plus-collapse-both",
                name: "Collapse Both Sidebars",
                callback: () => {
                    console.log("Command: Collapse Both Sidebars");
                    this.collapseBoth();
                }
            });
        });

        this.addSettingTab(new SidebarFlyoverSettingTab(this.app, this));
    }

    async onunload() {
        await this.saveSettings();

        document.body.classList.remove('open-sidebar-hover-plugin');
        document.body.classList.remove('sidebar-overlay-mode');

        // Clean up interval
        if (this.checkButtonsInterval) {
            clearInterval(this.checkButtonsInterval);
        }

        // Clean up left sidebar
        if (this.leftSplit && this.leftSplit.containerEl) {
            this.leftSplit.containerEl.classList.remove('pinned', 'pegged', 'dynamic-width');
            // Remove only OUR buttons, not native Obsidian elements
            const leftPinBtn = this.leftSplit.containerEl.querySelector('.pin-btn-left');
            if (leftPinBtn) leftPinBtn.remove();
            const leftPegBtn = this.leftSplit.containerEl.querySelector('.dock-btn-left');
            if (leftPegBtn) leftPegBtn.remove();
        }

        // Clean up right sidebar
        if (this.rightSplit && this.rightSplit.containerEl) {
            this.rightSplit.containerEl.classList.remove('pinned', 'pegged', 'dynamic-width');
            // Remove the entire right icon container and buttons
            const rightIconContainer = this.rightSplit.containerEl.querySelector('.sidebar-right-icons-container');
            if (rightIconContainer) rightIconContainer.remove();
        }

        // Cleanup Event Listeners
        this.removeHandlers();

        // Disconnect Observers
        if (this.leftResizeObserver) this.leftResizeObserver.disconnect();
        if (this.rightResizeObserver) this.rightResizeObserver.disconnect();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.updateButtonStates();
    }

    updateButtonStates() {
        // Update left sidebar buttons
        if (this.leftPinButton) {
            this.updatePinState(this.leftSplit, this.settings.leftSidebarPinned, this.leftPinButton);
        }
        if (this.leftPegButton) {
            this.updatePegBtnState(this.leftPegButton, this.settings.leftSidebarPegged);
        }

        // Update right sidebar buttons
        if (this.rightPinButton) {
            this.updatePinState(this.rightSplit, this.settings.rightSidebarPinned, this.rightPinButton);
        }
        if (this.rightPegButton) {
            this.updatePegBtnState(this.rightPegButton, this.settings.rightSidebarPegged);
        }

        this.updatePegState();
    }

    applyCSSVariables() {
        const root = document.documentElement.style;
        root.setProperty('--sidebar-expand-collapse-speed', `${this.settings.expandCollapseSpeed}ms`);
        root.setProperty('--sidebar-expand-delay', `${this.settings.sidebarExpandDelay}ms`);
        root.setProperty('--left-sidebar-max-width', `${this.settings.leftSidebarMaxWidth}px`);
        root.setProperty('--right-sidebar-max-width', `${this.settings.rightSidebarMaxWidth}px`);

        // Body variables
        document.body.style.setProperty('--sidebar-width', `${this.settings.leftSidebarMaxWidth}px`);
        document.body.style.setProperty('--right-sidebar-width', `${this.settings.rightSidebarMaxWidth}px`);

        // Toggle overlay class
        if (this.settings.overlayMode) {
            document.body.classList.add('sidebar-overlay-mode');
            console.log("Overlay mode ENABLED");
        } else {
            document.body.classList.remove('sidebar-overlay-mode');
            console.log("Overlay mode DISABLED");
        }

        this.updatePegState();
    }

    applySidebarWidth(split: any, width: number) {
        if (!split || !split.containerEl) {
            console.log("Cannot apply width - split or containerEl is null");
            return;
        }

        const isRight = split === this.rightSplit;
        const label = isRight ? "RIGHT" : "LEFT";

        console.log(`Applying width to ${label} sidebar: ${width}px`);

        // Dynamic width check
        if ((split === this.leftSplit && this.settings.leftSidebarDynamicWidth) ||
            (split === this.rightSplit && this.settings.rightSidebarDynamicWidth)) {
             width = this.calculateDynamicWidth(split, split === this.leftSplit);
             console.log(`Dynamic width calculated: ${width}px`);
        }

        split.containerEl.style.transition = `width ${this.settings.expandCollapseSpeed}ms ease, max-width ${this.settings.expandCollapseSpeed}ms ease`;
        split.containerEl.style.width = `${width}px`;
        split.containerEl.style.maxWidth = `${width}px`;

        console.log(`${label} sidebar CSS applied: width=${width}px, maxWidth=${width}px`);

        try {
            // Try Obsidian internal methods to resize
            if (typeof split.setSize === 'function') {
                split.setSize(width);
                console.log(`${label} sidebar: setSize(${width}) called`);
            } else if (typeof split.setWidth === 'function') {
                split.setWidth(width);
                console.log(`${label} sidebar: setWidth(${width}) called`);
            } else if (typeof split.resize === 'function') {
                split.resize();
                console.log(`${label} sidebar: resize() called`);
            } else if (typeof split.onResize === 'function') {
                split.onResize();
                console.log(`${label} sidebar: onResize() called`);
            }
        } catch (e: any) {
            console.log(`${label} sidebar sizing error:`, e.message);
        }
    }

    // --- Expansion/Collapse Methods ---

    expandRight() {
        if (!this.rightSplit) {
            console.log("✗ rightSplit is null - cannot expand");
            return;
        }

        console.log("Calling rightSplit.expand()");
        this.rightSplit.expand();
        this.isHoveringRight = true;

        setTimeout(() => {
            console.log("Applying width to right sidebar");
            this.applySidebarWidth(this.rightSplit, this.settings.rightSidebarMaxWidth);

            if (this.settings.rightSidebarPegged) {
                this.updatePegState();
            }
        }, 50);
    }

    expandLeft() {
        if (!this.leftSplit) return;
        this.leftSplit.expand();
        this.isHoveringLeft = true;
        setTimeout(() => {
            this.applySidebarWidth(this.leftSplit, this.settings.leftSidebarMaxWidth);
            if (this.settings.leftSidebarPegged) this.updatePegState();
        }, 50);
    }

    expandBoth() {
        this.expandLeft();
        this.expandRight();
    }

    collapseRight() {
        // Check pin AND peg states - don't collapse if either is active
        if (this.settings.rightSidebarPinned || this.settings.rightSidebarPegged) {
            console.log("Right sidebar pinned or pegged - not collapsing");
            return;
        }

        if (!this.rightSplit) {
            console.log("✗ rightSplit is null - cannot collapse");
            return;
        }

        console.log("Calling rightSplit.collapse()");
        this.isHoveringRight = false;
        this.rightSplit.collapse();
        this.updatePegState();
    }

    collapseLeft() {
        if (this.settings.leftSidebarPinned) return;
        // Prevent collapse if docked/pegged
        if (this.settings.leftSidebarPegged) return;

        if (!this.leftSplit) return;

        this.isHoveringLeft = false;
        this.leftSplit.collapse();
        this.updatePegState();
    }

    collapseBoth() {
        this.collapseLeft();
        this.collapseRight();
    }

    // --- Event Logic ---

    registerHandlers() {
        // Global Handlers
        this.mouseMoveHandler = this.onMouseMove.bind(this);
        this.documentClickHandler = this.onDocumentClick.bind(this);

        document.addEventListener('mousemove', this.mouseMoveHandler);
        document.addEventListener('click', this.documentClickHandler);

        // Sidebar Handlers
        this.bindSidebarHandlers();

        if (this.leftSplit && this.leftSplit.containerEl) {
            this.leftSplit.containerEl.addEventListener('mouseenter', this.leftSplitMouseEnterHandler);
            this.leftSplit.containerEl.addEventListener('mousemove', this.leftSplitMouseMoveHandler);
            this.leftSplit.containerEl.addEventListener('mouseleave', this.leftSplitMouseLeaveHandler);
        }

        if (this.rightSplit && this.rightSplit.containerEl) {
            this.rightSplit.containerEl.addEventListener('mouseenter', this.rightSplitMouseEnterHandler);
            this.rightSplit.containerEl.addEventListener('mousemove', this.rightSplitMouseMoveHandler);
            this.rightSplit.containerEl.addEventListener('mouseleave', this.rightSplitMouseLeaveHandler);
        }

        // Ribbon Handler (Wait, ribbon might not be containerEl. usually .workspace-ribbon.mod-left)
        // If leftRibbon is set, use it.
        const ribbon = document.querySelector('.workspace-ribbon.mod-left');
        if (ribbon) {
             this.leftRibbon = ribbon; // Ensure reference
             this.leftRibbonMouseEnterHandler = this.onRibbonMouseEnter.bind(this);
             ribbon.addEventListener('mouseenter', this.leftRibbonMouseEnterHandler);
        }
    }

    bindSidebarHandlers() {
        // Left
        this.leftSplitMouseEnterHandler = (e) => {
            this.isHoveringLeft = true;
            if (this.leftSplit) this.leftSplit.containerEl.classList.add('hovered');
        };
        this.leftSplitMouseMoveHandler = (e) => {
            if (this.leftSplit) this.leftSplit.containerEl.classList.add('hovered');
        };
        this.leftSplitMouseLeaveHandler = (e) => {
            this.handleSidebarLeave(e, true);
        };

        // Right
        this.rightSplitMouseEnterHandler = (e) => {
            this.isHoveringRight = true;
            if (this.rightSplit) this.rightSplit.containerEl.classList.add('hovered');
        };
        this.rightSplitMouseMoveHandler = (e) => {
            if (this.rightSplit) this.rightSplit.containerEl.classList.add('hovered');
        };
        this.rightSplitMouseLeaveHandler = (e) => {
            this.handleSidebarLeave(e, false);
        };
    }

    removeHandlers() {
        document.removeEventListener('mousemove', this.mouseMoveHandler);
        document.removeEventListener('click', this.documentClickHandler);

        if (this.leftSplit && this.leftSplit.containerEl) {
            this.leftSplit.containerEl.removeEventListener('mouseenter', this.leftSplitMouseEnterHandler);
            this.leftSplit.containerEl.removeEventListener('mousemove', this.leftSplitMouseMoveHandler);
            this.leftSplit.containerEl.removeEventListener('mouseleave', this.leftSplitMouseLeaveHandler);
        }

        if (this.rightSplit && this.rightSplit.containerEl) {
            this.rightSplit.containerEl.removeEventListener('mouseenter', this.rightSplitMouseEnterHandler);
            this.rightSplit.containerEl.removeEventListener('mousemove', this.rightSplitMouseMoveHandler);
            this.rightSplit.containerEl.removeEventListener('mouseleave', this.rightSplitMouseLeaveHandler);
        }

        if (this.leftRibbon) {
            this.leftRibbon.removeEventListener('mouseenter', this.leftRibbonMouseEnterHandler);
        }
    }

    onMouseMove(e: MouseEvent) {
        const clientX = e.clientX;
        const viewportWidth = document.body.clientWidth;

        // RIGHT SIDEBAR DEBUG
        if (this.settings.rightSidebar && this.rightSplit) {
            const isRightCollapsed = this.rightSplit.collapsed === true;
            const distanceFromRight = viewportWidth - clientX;
            const isNearRight = distanceFromRight <= this.settings.rightSideBarPixelTrigger;

            // DEBUG LOGGING
            console.log(`
                Right Sidebar Status:
                - Collapsed: ${isRightCollapsed}
                - Mouse X: ${clientX}
                - Viewport Width: ${viewportWidth}
                - Distance from right: ${distanceFromRight}
                - Trigger threshold: ${this.settings.rightSideBarPixelTrigger}
                - Is near right: ${isNearRight}
                - Currently hovering: ${this.isHoveringRight}
                - Overlay mode: ${this.settings.overlayMode}
                - Right sidebar element exists: ${!!this.rightSplit}
            `);

            // Trigger expansion
            if (isNearRight && isRightCollapsed && !this.isHoveringRight) {
                console.log("✓ RIGHT SIDEBAR TRIGGERED - Should expand");
                this.isHoveringRight = true;

                setTimeout(() => {
                    if (this.isHoveringRight && this.rightSplit.collapsed) {
                        console.log("✓ RIGHT SIDEBAR EXPANDING");
                        if (this.settings.syncLeftRight && this.settings.leftSidebar) {
                            this.expandBoth();
                        } else {
                            this.expandRight();
                        }
                    }
                }, this.settings.sidebarExpandDelay);
            }

            // Schedule collapse
            if (!isNearRight && this.isHoveringRight) {
                setTimeout(() => {
                    if (!this.isHoveringRight) {
                        console.log("✓ RIGHT SIDEBAR COLLAPSING");
                        if (this.settings.syncLeftRight && this.settings.leftSidebar) {
                            this.collapseBoth();
                        } else {
                            this.collapseRight();
                        }
                    }
                }, this.settings.sidebarDelay);
            }
        }

        // LEFT SIDEBAR - mirror logic
        if (this.settings.leftSidebar && this.leftSplit) {
            const isLeftCollapsed = this.leftSplit.collapsed === true;
            const isNearLeft = clientX <= this.settings.leftSideBarPixelTrigger;

            if (isNearLeft && isLeftCollapsed && !this.isHoveringLeft) {
                this.isHoveringLeft = true;

                setTimeout(() => {
                    if (this.isHoveringLeft && this.leftSplit.collapsed) {
                        if (this.settings.syncLeftRight && this.settings.rightSidebar) {
                            this.expandBoth();
                        } else {
                            this.expandLeft();
                        }
                    }
                }, this.settings.sidebarExpandDelay);
            }

            if (!isNearLeft && this.isHoveringLeft) {
                setTimeout(() => {
                    if (!this.isHoveringLeft) {
                        if (this.settings.syncLeftRight && this.settings.rightSidebar) {
                            this.collapseBoth();
                        } else {
                            this.collapseLeft();
                        }
                    }
                }, this.settings.sidebarDelay);
            }
        }
    }

    handleSidebarLeave(e: MouseEvent, isLeft: boolean) {
        const relatedTarget = e.relatedTarget as HTMLElement;
        const isSafe = relatedTarget && (
            relatedTarget.closest('.workspace-tab-header-container-inner') ||
            relatedTarget.classList.contains('menu') ||
            relatedTarget.closest('.menu')
        );

        if (!isSafe) {
            if (isLeft) {
                this.isHoveringLeft = false;
                if (this.leftSplit) this.leftSplit.containerEl.classList.remove('hovered');
                setTimeout(() => {
                    if (!this.isHoveringLeft) this.collapseLeft();
                }, this.settings.sidebarDelay);
            } else {
                this.isHoveringRight = false;
                if (this.rightSplit) this.rightSplit.containerEl.classList.remove('hovered');
                setTimeout(() => {
                    if (!this.isHoveringRight) this.collapseRight();
                }, this.settings.sidebarDelay);
            }
        }
    }

    onRibbonMouseEnter(e: MouseEvent) {
        this.isHoveringLeft = true;
        setTimeout(() => {
            if (this.isHoveringLeft) {
                if (this.settings.syncLeftRight) this.expandBoth();
                else this.expandLeft();
            }
        }, this.settings.sidebarExpandDelay);
    }

    onDocumentClick(e: MouseEvent) {
        const target = e.target as HTMLElement;

        // Check if click is inside sidebars
        const insideLeft = this.leftSplit && this.leftSplit.containerEl.contains(target);
        const insideRight = this.rightSplit && this.rightSplit.containerEl.contains(target);

        if (!insideLeft && !insideRight) {
            if (this.leftSplit && !this.leftSplit.collapsed && this.settings.leftSidebar) {
                this.collapseLeft();
            }
            if (this.rightSplit && !this.rightSplit.collapsed && this.settings.rightSidebar) {
                this.collapseRight();
            }
        }
    }

    // --- Feature Implementations ---

    leftPinButton: HTMLElement;
    leftPegButton: HTMLElement;
    rightPinButton: HTMLElement;
    rightPegButton: HTMLElement;

    addSidebarButtons(e: any, t: boolean) {
        // e = sidebar split, t = isLeft (true for left, false for right)
        if (!e || !e.containerEl) return;

        const sidebarLabel = t ? "left" : "right";
        console.log(`Adding buttons to ${sidebarLabel} sidebar`);

        // Step 1: Find the header container where OTHER plugins add their icons
        const headerContainer = e.containerEl.querySelector(
            ".workspace-tab-header-container-inner"
        );
        if (!headerContainer) {
            console.log(`Cannot find header container for ${sidebarLabel} sidebar`);
            return;
        }

        // Step 2: Create INDIVIDUAL clickable icons (like other plugins do)
        // Don't create a wrapper - just add icons directly to the native container

        // Create PIN button
        const pinButton = document.createElement("div");
        pinButton.addClass("clickable-icon");
        pinButton.addClass("sidebar-pin-btn");
        pinButton.addClass(t ? "pin-btn-left" : "pin-btn-right");
        pinButton.setAttribute("aria-label", t ? "Pin left sidebar" : "Pin right sidebar");
        pinButton.setAttribute("role", "button");
        pinButton.setAttribute("tabindex", "0");
        pinButton.style.width = "24px";
        pinButton.style.height = "24px";
        pinButton.style.display = "flex";
        pinButton.style.alignItems = "center";
        pinButton.style.justifyContent = "center";
        setIcon(pinButton, "pin");

        pinButton.onclick = (event) => {
            event.stopPropagation();
            event.preventDefault();
            if (t) {
                // LEFT sidebar pin
                this.settings.leftSidebarPinned = !this.settings.leftSidebarPinned;
                this.saveSettings();
                this.updatePinState(e, this.settings.leftSidebarPinned, pinButton);
                if (this.settings.leftSidebarPinned) {
                    this.expandLeft();
                }
            } else {
                // RIGHT sidebar pin
                this.settings.rightSidebarPinned = !this.settings.rightSidebarPinned;
                this.saveSettings();
                this.updatePinState(e, this.settings.rightSidebarPinned, pinButton);
                if (this.settings.rightSidebarPinned) {
                    this.expandRight();
                }
            }
        };

        pinButton.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                pinButton.click();
            }
        });

        // Create DOCK/PEG button
        const pegButton = document.createElement("div");
        pegButton.addClass("clickable-icon");
        pegButton.addClass("sidebar-dock-btn");
        pegButton.addClass("peg-btn");
        pegButton.addClass(t ? "dock-btn-left" : "dock-btn-right");
        pegButton.setAttribute("aria-label", t ? "Dock left sidebar" : "Dock right sidebar");
        pegButton.setAttribute("role", "button");
        pegButton.setAttribute("tabindex", "0");
        pegButton.style.width = "24px";
        pegButton.style.height = "24px";
        pegButton.style.display = "flex";
        pegButton.style.alignItems = "center";
        pegButton.style.justifyContent = "center";
        setIcon(pegButton, "square");

        pegButton.onclick = (event) => {
            event.stopPropagation();
            event.preventDefault();
            this.toggleDockState(t);
            this.updatePegBtnState(pegButton, t ? this.settings.leftSidebarPegged : this.settings.rightSidebarPegged);
        };

        pegButton.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                pegButton.click();
            }
        });

        // Step 3: CRITICAL - Add buttons to DIFFERENT positions based on sidebar
        // LEFT sidebar: Add buttons to the LEFT (after native icons)
        // RIGHT sidebar: Add buttons to the RIGHT (as the LAST items)

        if (t) {
            // LEFT SIDEBAR: Insert after any native expand/collapse button
            // Find and hide the native expand/collapse button
            const nativeCollapseBtn = e.containerEl.querySelector(
                ".workspace-tab-header-container .clickable-icon"
            );
            if (nativeCollapseBtn) {
                nativeCollapseBtn.style.display = "none";
                nativeCollapseBtn.setAttribute("aria-hidden", "true");
                nativeCollapseBtn.setAttribute("inert", "true");
            }

            // Add our buttons FIRST (left side)
            if (headerContainer.firstChild) {
                headerContainer.insertBefore(pinButton, headerContainer.firstChild);
                // Insert peg button right after pin button
                headerContainer.insertBefore(pegButton, pinButton.nextSibling);
            } else {
                headerContainer.appendChild(pinButton);
                headerContainer.appendChild(pegButton);
            }
        } else {
            // RIGHT SIDEBAR: Add buttons to the RIGHTMOST position
            // These should be at the END of the header container to stay visible

            // First, find and remove any existing button container from right sidebar
            const existingGroup = e.containerEl.querySelector(".sidebar-right-icons-container");
            if (existingGroup) {
                existingGroup.remove();
            }

            // Create a persistent container for right sidebar icons
            // This container will have special CSS to keep it at the right edge
            const rightIconContainer = document.createElement("div");
            rightIconContainer.addClass("sidebar-right-icons-container");
            rightIconContainer.style.display = "flex";
            rightIconContainer.style.alignItems = "center";
            rightIconContainer.style.gap = "2px";
            rightIconContainer.style.marginLeft = "auto";  // Push to right
            rightIconContainer.style.marginRight = "4px";  // Small right spacing
            rightIconContainer.style.flexShrink = "0";     // Don't shrink
            rightIconContainer.style.paddingRight = "4px"; // Right padding

            // Append buttons to the right container
            rightIconContainer.appendChild(pinButton);
            rightIconContainer.appendChild(pegButton);

            // Add the container to the header
            headerContainer.appendChild(rightIconContainer);
        }

        // Step 4: Update button states
        this.updatePinState(e, t ? this.settings.leftSidebarPinned : this.settings.rightSidebarPinned, pinButton);
        this.updatePegBtnState(pegButton, t ? this.settings.leftSidebarPegged : this.settings.rightSidebarPegged);

        // Store references to buttons for later updates
        if (t) {
            this.leftPinButton = pinButton;
            this.leftPegButton = pegButton;
        } else {
            this.rightPinButton = pinButton;
            this.rightPegButton = pegButton;
        }
    }

    updatePinState(split: any, pinned: boolean, btn: HTMLElement) {
        if (pinned) {
            split.containerEl.classList.add('pinned');
            btn.classList.add('is-active');
        } else {
            split.containerEl.classList.remove('pinned');
            btn.classList.remove('is-active');
        }
    }

    updatePegBtnState(btn: HTMLElement, pegged: boolean) {
        if (pegged) btn.classList.add('is-active');
        else btn.classList.remove('is-active');
    }

    updatePegState() {
        // This method is now simplified - docking is handled in toggleDockState()
        // This just manages CSS classes for visual feedback

        if (this.leftSplit) {
            if (this.settings.leftSidebarPegged && !this.leftSplit.collapsed) {
                this.leftSplit.containerEl.classList.add('docked');
            } else {
                this.leftSplit.containerEl.classList.remove('docked');
            }
        }

        if (this.rightSplit) {
            if (this.settings.rightSidebarPegged && !this.rightSplit.collapsed) {
                this.rightSplit.containerEl.classList.add('docked');
            } else {
                this.rightSplit.containerEl.classList.remove('docked');
            }
        }
    }

    toggleDockState(isLeft: boolean) {
        if (isLeft) {
            this.settings.leftSidebarPegged = !this.settings.leftSidebarPegged;

            if (this.settings.leftSidebarPegged) {
                // DOCK IS NOW ACTIVE
                // Keep the sidebar expanded and prevent collapse
                this.expandLeft();
                this.leftSplit.containerEl.classList.add('docked');
                // Also ensure it stays in overlay: false mode OR resets to push mode
                // by NOT using overlay mode for docked sidebars
                document.body.classList.remove('sidebar-overlay-mode');
            } else {
                // DOCK IS NOW INACTIVE
                // Return to normal hover behavior
                this.leftSplit.containerEl.classList.remove('docked');
                this.collapseLeft();
                // Restore overlay mode if it was enabled
                if (this.settings.overlayMode) {
                    document.body.classList.add('sidebar-overlay-mode');
                }
            }
        } else {
            this.settings.rightSidebarPegged = !this.settings.rightSidebarPegged;

            if (this.settings.rightSidebarPegged) {
                this.expandRight();
                this.rightSplit.containerEl.classList.add('docked');
                document.body.classList.remove('sidebar-overlay-mode');
            } else {
                this.rightSplit.containerEl.classList.remove('docked');
                this.collapseRight();
                if (this.settings.overlayMode) {
                    document.body.classList.add('sidebar-overlay-mode');
                }
            }
        }

        this.saveSettings();
    }

    setupDynamicWidth() {
        // Implement ResizeObserver
        this.leftResizeObserver = new ResizeObserver(entries => {
            if (this.settings.leftSidebarDynamicWidth && this.leftSplit && !this.leftSplit.collapsed) {
                // Debounce? Prompt says debounce.
                // For simplicity, I'll just call logic directly or use a small timeout if needed.
                // But ResizeObserver loop limit might be hit.
                // Let's rely on standard debouncing.
                this.debouncedDynamicUpdate(true);
            }
        });

        this.rightResizeObserver = new ResizeObserver(entries => {
            if (this.settings.rightSidebarDynamicWidth && this.rightSplit && !this.rightSplit.collapsed) {
                this.debouncedDynamicUpdate(false);
            }
        });

        // Observe content containers
        if (this.leftSplit) {
            const content = this.leftSplit.containerEl.querySelector('.workspace-leaf-content'); // This might be too deep.
            // Usually we observe the container or the children.
            // "Measure scrollWidth of content" -> "ResizeObserver on the sidebar's inner content container"
            // .workspace-sidedock-content is likely what we want.
            // But let's find .workspace-leaf or similar.
            // .workspace-split > .workspace-tabs > ...
            // Let's observe the split container itself to trigger updates, or better, the content.
            // I'll observe the split container for now, but really we want to know when content changes.
            // Actually, if content grows, we want to expand.
            // Let's try to observe the immediate child of the split container.
             const child = this.leftSplit.containerEl.firstElementChild;
             if (child) this.leftResizeObserver.observe(child);
        }

        if (this.rightSplit) {
            const child = this.rightSplit.containerEl.firstElementChild;
            if (child) this.rightResizeObserver.observe(child);
        }
    }

    // Simple debounce
    leftDebounceTimer: any = null;
    rightDebounceTimer: any = null;

    debouncedDynamicUpdate(isLeft: boolean) {
        if (isLeft) {
            if (this.leftDebounceTimer) clearTimeout(this.leftDebounceTimer);
            this.leftDebounceTimer = setTimeout(() => {
                this.applySidebarWidth(this.leftSplit, this.settings.leftSidebarMaxWidth);
                this.leftDebounceTimer = null;
            }, 300);
        } else {
            if (this.rightDebounceTimer) clearTimeout(this.rightDebounceTimer);
            this.rightDebounceTimer = setTimeout(() => {
                this.applySidebarWidth(this.rightSplit, this.settings.rightSidebarMaxWidth);
                this.rightDebounceTimer = null;
            }, 300);
        }
    }

    calculateDynamicWidth(split: any, isLeft: boolean): number {
        if (!split || !split.containerEl) return isLeft ? this.settings.leftSidebarMaxWidth : this.settings.rightSidebarMaxWidth;

        // Find content to measure
        // We want the width of the content inside.
        // Sidebars usually contain a tab container.
        const content = split.containerEl.querySelector('.workspace-tab-container') || split.containerEl.querySelector('.workspace-leaf');

        if (!content) return isLeft ? this.settings.leftSidebarMaxWidth : this.settings.rightSidebarMaxWidth;

        const scrollWidth = content.scrollWidth;
        const minWidth = isLeft ? this.settings.leftSidebarMinWidth : this.settings.rightSidebarMinWidth;
        const maxWidth = isLeft ? this.settings.leftSidebarMaxWidth : this.settings.rightSidebarMaxWidth;

        return Math.min(Math.max(scrollWidth + 20, minWidth), maxWidth);
    }

    ensureButtonsPersist() {
        // Check left sidebar buttons
        const leftPinMissing = !this.leftSplit?.containerEl?.querySelector(".pin-btn-left");
        const leftPegMissing = !this.leftSplit?.containerEl?.querySelector(".dock-btn-left");

        if (leftPinMissing || leftPegMissing) {
            console.log("Left sidebar buttons missing - re-adding...");
            this.addSidebarButtons(this.leftSplit, true);
        }

        // Check right sidebar buttons
        const rightPinMissing = !this.rightSplit?.containerEl?.querySelector(".pin-btn-right");
        const rightPegMissing = !this.rightSplit?.containerEl?.querySelector(".dock-btn-right");

        if (rightPinMissing || rightPegMissing) {
            console.log("Right sidebar buttons missing - re-adding...");
            this.addSidebarButtons(this.rightSplit, false);
        }
    }
}
