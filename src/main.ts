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
        });

        this.addSettingTab(new SidebarFlyoverSettingTab(this.app, this));
    }

    async onunload() {
        await this.saveSettings();

        document.body.classList.remove('open-sidebar-hover-plugin');
        document.body.classList.remove('sidebar-overlay-mode');

        // Remove pinned/pegged/dynamic classes if any (optional, but good practice)
        if (this.leftSplit && this.leftSplit.containerEl) {
             this.leftSplit.containerEl.classList.remove('pinned', 'pegged', 'dynamic-width');
             // Remove buttons? Usually Obsidian handles DOM cleanup of plugin containers, but we modified existing DOM.
             // We should remove the buttons we added.
             const buttons = this.leftSplit.containerEl.querySelectorAll('.sidebar-flyover-btn');
             buttons.forEach((b: HTMLElement) => b.remove());
        }
        if (this.rightSplit && this.rightSplit.containerEl) {
             this.rightSplit.containerEl.classList.remove('pinned', 'pegged', 'dynamic-width');
             const buttons = this.rightSplit.containerEl.querySelectorAll('.sidebar-flyover-btn');
             buttons.forEach((b: HTMLElement) => b.remove());
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
        if (this.leftSplit && this.leftSplit.containerEl) {
            const pinBtn = this.leftSplit.containerEl.querySelector('.pin-btn');
            if (pinBtn) this.updatePinState(this.leftSplit, this.settings.leftSidebarPinned, pinBtn as HTMLElement);

            const pegBtn = this.leftSplit.containerEl.querySelector('.peg-btn');
            if (pegBtn) this.updatePegBtnState(pegBtn as HTMLElement, this.settings.leftSidebarPegged);
        }

        if (this.rightSplit && this.rightSplit.containerEl) {
             const pinBtn = this.rightSplit.containerEl.querySelector('.pin-btn');
             if (pinBtn) this.updatePinState(this.rightSplit, this.settings.rightSidebarPinned, pinBtn as HTMLElement);

             const pegBtn = this.rightSplit.containerEl.querySelector('.peg-btn');
             if (pegBtn) this.updatePegBtnState(pegBtn as HTMLElement, this.settings.rightSidebarPegged);
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

    addSidebarButtons(split: any, isLeft: boolean) {
        if (!split || !split.containerEl) return;

        // FIND THE NATIVE EXPAND/COLLAPSE BUTTON
        // The native button is typically in the header as a clickable-icon
        const nativeButton = split.containerEl.querySelector(
            '.workspace-tab-header-container .clickable-icon'
        );

        // Hide the native button (don't remove it, just hide it)
        if (nativeButton) {
            nativeButton.style.display = 'none';
            nativeButton.setAttribute('aria-hidden', 'true');
            nativeButton.setAttribute('inert', 'true');
        }

        // Now find the proper header container for your buttons
        const headerContainer = split.containerEl.querySelector(
            '.workspace-tab-header-container-inner'
        );

        if (!headerContainer) return;

        // Create a button group container that mimics Obsidian's button style
        const buttonGroup = document.createElement('div');
        buttonGroup.addClass('sidebar-flyover-button-group');
        buttonGroup.style.display = 'flex';
        buttonGroup.style.alignItems = 'center';
        buttonGroup.style.gap = '2px';
        buttonGroup.style.marginRight = 'auto'; // Push subsequent elements to the right
        buttonGroup.style.marginLeft = '0px';
        buttonGroup.style.paddingLeft = '4px';

        // Clean up existing group if present (re-injection safety)
        const existingGroup = headerContainer.querySelector(".sidebar-flyover-button-group");
        if (existingGroup) {
            existingGroup.remove();
        }

        // INSERT AS FIRST CHILD to ensure left positioning
        if (headerContainer.firstChild) {
            headerContainer.insertBefore(buttonGroup, headerContainer.firstChild);
        } else {
            headerContainer.appendChild(buttonGroup);
        }

        // CREATE PIN BUTTON with proper Obsidian styling
        const pinBtn = document.createElement('div');
        pinBtn.addClass('clickable-icon'); // Use Obsidian's native class
        pinBtn.addClass('sidebar-pin-btn');
        pinBtn.addClass('pin-btn'); // Add identifying class for update logic
        pinBtn.addClass(isLeft ? 'pin-btn-left' : 'pin-btn-right');
        pinBtn.setAttribute('aria-label', isLeft ? 'Pin left sidebar' : 'Pin right sidebar');
        pinBtn.setAttribute('role', 'button');
        pinBtn.setAttribute('tabindex', '0');
        pinBtn.style.width = '24px';
        pinBtn.style.height = '24px';
        pinBtn.style.display = 'flex';
        pinBtn.style.alignItems = 'center';
        pinBtn.style.justifyContent = 'center';

        setIcon(pinBtn, 'pin'); // PIN icon

        pinBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();

            if (isLeft) {
                this.settings.leftSidebarPinned = !this.settings.leftSidebarPinned;
                this.saveSettings();
                this.updatePinState(split, this.settings.leftSidebarPinned, pinBtn);
                if (this.settings.leftSidebarPinned) this.expandLeft(); // Auto-expand when pinned
            } else {
                this.settings.rightSidebarPinned = !this.settings.rightSidebarPinned;
                this.saveSettings();
                this.updatePinState(split, this.settings.rightSidebarPinned, pinBtn);
                if (this.settings.rightSidebarPinned) this.expandRight(); // Auto-expand when pinned
            }
        };

        // Handle keyboard accessibility
        pinBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                pinBtn.click();
            }
        });

        buttonGroup.appendChild(pinBtn);

        // CREATE DOCK/ANCHOR BUTTON with proper styling
        const dockBtn = document.createElement('div');
        dockBtn.addClass('clickable-icon'); // Use Obsidian's native class
        dockBtn.addClass('sidebar-dock-btn');
        dockBtn.addClass('peg-btn'); // Add identifying class for update logic
        dockBtn.addClass(isLeft ? 'dock-btn-left' : 'dock-btn-right');
        dockBtn.setAttribute('aria-label', isLeft ? 'Dock left sidebar' : 'Dock right sidebar');
        dockBtn.setAttribute('role', 'button');
        dockBtn.setAttribute('tabindex', '0');
        dockBtn.style.width = '24px';
        dockBtn.style.height = '24px';
        dockBtn.style.display = 'flex';
        dockBtn.style.alignItems = 'center';
        dockBtn.style.justifyContent = 'center';

        setIcon(dockBtn, 'square');

        dockBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.toggleDockState(isLeft);
            this.updatePegBtnState(dockBtn, isLeft ? this.settings.leftSidebarPegged : this.settings.rightSidebarPegged);
        };

        // Handle keyboard accessibility
        dockBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                dockBtn.click();
            }
        });

        buttonGroup.appendChild(dockBtn);

        // Set initial states
        this.updatePinState(split, isLeft ? this.settings.leftSidebarPinned : this.settings.rightSidebarPinned, pinBtn);
        this.updatePegBtnState(dockBtn, isLeft ? this.settings.leftSidebarPegged : this.settings.rightSidebarPegged);
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
}
