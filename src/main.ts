import { App, Plugin, PluginSettingTab, Setting, WorkspaceSidedock, setIcon, Menu } from 'obsidian';
import { SidebarHoverSettings, DEFAULT_SETTINGS, SidebarFlyoverSettingTab } from './settings';

export default class SidebarFlyoverPlus extends Plugin {
    settings: SidebarHoverSettings;
    leftSplit: any;
    rightSplit: any;
    leftRibbon: any;
    isHoveringLeft: boolean = false;
    isHoveringRight: boolean = false;
	private isMenuOpen = false;

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

            // Initial Dropdown Setup
            this.toggleRightSidebarDropdown(this.settings.enableRightSidebarDropdown);

            // Re-check buttons periodically to ensure they persist
            // when other plugins manipulate the sidebar
            this.checkButtonsInterval = setInterval(() => {
                this.ensureButtonsPersist();
                // Ensure dropdowns persist if enabled
                if (this.settings.enableRightSidebarDropdown) {
                    this.injectDropdowns();
                }
            }, 2000); // Check every 2 seconds

            // Dropdown Events
            this.registerEvent(
                this.app.workspace.on('layout-change', () => {
                    if (this.settings.enableRightSidebarDropdown) {
                        this.injectDropdowns();
                    }
                })
            );

            this.registerEvent(
                this.app.workspace.on('active-leaf-change', () => {
                    if (this.settings.enableRightSidebarDropdown) {
                        this.updateAllDropdownStates();
                    }
                })
            );

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
        document.body.classList.remove('use-right-sidebar-dropdown');

        // Clean up custom elements
        document.querySelectorAll('.right-sidebar-dropdown-btn').forEach(el => el.remove());

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

            // Trigger expansion
            if (isNearRight && isRightCollapsed && !this.isHoveringRight) {
                this.isHoveringRight = true;

                setTimeout(() => {
                    if (this.isHoveringRight && this.rightSplit.collapsed) {
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
		// GUARD: Never collapse while menu is open
		if (this.isMenuOpen) {
			console.log('🛑 DROPDOWN: Blocked collapse - menu is open');
			return;
		}

		const related = e.relatedTarget as HTMLElement;

		if (related) {
			// Moving into the menu
			if (related.classList?.contains('menu') || related.closest('.menu')) {
				console.log('Mouse moved to menu - blocking collapse');
				return;
			}

			// Moving into header containers
			if (related.closest('.workspace-tab-header-container-inner') ||
				related.closest('.workspace-tab-header-container')) {
				return;
			}

			// Moving onto the dropdown button itself
			if (related.classList?.contains('right-sidebar-dropdown-btn') ||
				related.closest('.right-sidebar-dropdown-btn')) {
				return;
			}
		}

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

		// If click is inside an Obsidian menu, ignore
		if (target.closest('.menu')) {
			console.log('🛑 Click inside menu - ignoring');
			return;
		}

		// Ignore clicks on dropdown trigger itself
		if (target.closest('.right-sidebar-dropdown-btn')) {
			console.log('🛑 Click on dropdown button - ignoring');
			return;
		}

		// If menu still marked open, allow it to finish processing
		if (this.isMenuOpen) {
			console.log('🛑 Menu still marked as open - ignoring click');
			return;
		}

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

        let headerContainer: Element | null = null;

        if (t) {
            // LEFT Sidebar: use the inner container
            headerContainer = e.containerEl.querySelector(".workspace-tab-header-container-inner");
        } else {
            // RIGHT Sidebar: use the outer container because we hide the inner one when dropdown is enabled
            // and even if disabled, appending to outer is cleaner for avoiding layout issues with tabs
            headerContainer = e.containerEl.querySelector(".workspace-tab-header-container");
        }

        if (!headerContainer) {
            console.log(`Cannot find header container for ${sidebarLabel} sidebar`);
            return;
        }

        // Create PIN button
        const pinButton = document.createElement("div");
        pinButton.addClass("clickable-icon");
        pinButton.addClass("sidebar-pin-btn");
        pinButton.addClass(t ? "pin-btn-left" : "pin-btn-right");
        pinButton.setAttribute("aria-label", t ? "Pin left sidebar" : "Pin right sidebar");
        pinButton.setAttribute("role", "button");
        pinButton.setAttribute("tabindex", "0");
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

        if (t) {
            // LEFT SIDEBAR
            const nativeCollapseBtn = e.containerEl.querySelector(
                ".workspace-tab-header-container .clickable-icon"
            );
            if (nativeCollapseBtn) {
                nativeCollapseBtn.style.display = "none";
                nativeCollapseBtn.setAttribute("aria-hidden", "true");
                nativeCollapseBtn.setAttribute("inert", "true");
            }

            if (headerContainer.firstChild) {
                headerContainer.insertBefore(pinButton, headerContainer.firstChild);
                headerContainer.insertBefore(pegButton, pinButton.nextSibling);
            } else {
                headerContainer.appendChild(pinButton);
                headerContainer.appendChild(pegButton);
            }
        } else {
            // RIGHT SIDEBAR
            // Clean up old buttons first
            const existingGroup = e.containerEl.querySelector(".sidebar-right-icons-container");
            if (existingGroup) {
                existingGroup.remove();
            }

            const rightIconContainer = document.createElement("div");
            rightIconContainer.addClass("sidebar-right-icons-container");

            rightIconContainer.appendChild(pinButton);
            rightIconContainer.appendChild(pegButton);

            headerContainer.appendChild(rightIconContainer);
        }

        this.updatePinState(e, t ? this.settings.leftSidebarPinned : this.settings.rightSidebarPinned, pinButton);
        this.updatePegBtnState(pegButton, t ? this.settings.leftSidebarPegged : this.settings.rightSidebarPegged);

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
                this.expandLeft();
                this.leftSplit.containerEl.classList.add('docked');
                document.body.classList.remove('sidebar-overlay-mode');
            } else {
                this.leftSplit.containerEl.classList.remove('docked');
                this.collapseLeft();
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
        this.leftResizeObserver = new ResizeObserver(entries => {
            if (this.settings.leftSidebarDynamicWidth && this.leftSplit && !this.leftSplit.collapsed) {
                this.debouncedDynamicUpdate(true);
            }
        });

        this.rightResizeObserver = new ResizeObserver(entries => {
            if (this.settings.rightSidebarDynamicWidth && this.rightSplit && !this.rightSplit.collapsed) {
                this.debouncedDynamicUpdate(false);
            }
        });

        if (this.leftSplit) {
             const child = this.leftSplit.containerEl.firstElementChild;
             if (child) this.leftResizeObserver.observe(child);
        }

        if (this.rightSplit) {
            const child = this.rightSplit.containerEl.firstElementChild;
            if (child) this.rightResizeObserver.observe(child);
        }
    }

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
        const content = split.containerEl.querySelector('.workspace-tab-container') || split.containerEl.querySelector('.workspace-leaf');
        if (!content) return isLeft ? this.settings.leftSidebarMaxWidth : this.settings.rightSidebarMaxWidth;

        const scrollWidth = content.scrollWidth;
        const minWidth = isLeft ? this.settings.leftSidebarMinWidth : this.settings.rightSidebarMinWidth;
        const maxWidth = isLeft ? this.settings.leftSidebarMaxWidth : this.settings.rightSidebarMaxWidth;

        return Math.min(Math.max(scrollWidth + 20, minWidth), maxWidth);
    }

    ensureButtonsPersist() {
        const leftPinMissing = !this.leftSplit?.containerEl?.querySelector(".pin-btn-left");
        const leftPegMissing = !this.leftSplit?.containerEl?.querySelector(".dock-btn-left");

        if (leftPinMissing || leftPegMissing) {
            console.log("Left sidebar buttons missing - re-adding...");
            this.addSidebarButtons(this.leftSplit, true);
        }

        const rightPinMissing = !this.rightSplit?.containerEl?.querySelector(".pin-btn-right");
        const rightPegMissing = !this.rightSplit?.containerEl?.querySelector(".dock-btn-right");

        if (rightPinMissing || rightPegMissing) {
            console.log("Right sidebar buttons missing - re-adding...");
            this.addSidebarButtons(this.rightSplit, false);
        }
    }

    // --- Dropdown Feature ---

    toggleRightSidebarDropdown(enable: boolean) {
        if (enable) {
            document.body.classList.add('use-right-sidebar-dropdown');
            this.injectDropdowns();
        } else {
            document.body.classList.remove('use-right-sidebar-dropdown');
            document.querySelectorAll('.right-sidebar-dropdown-btn').forEach(el => el.remove());
        }
    }

    injectDropdowns() {
        if (!this.settings.enableRightSidebarDropdown) return;

        // Target all tab containers inside the right sidebar
        const rightContainers = document.querySelectorAll('.workspace-split.mod-right-split .workspace-tab-header-container');

        rightContainers.forEach(container => {
            // Prevent duplicate injections
            if (container.querySelector('.right-sidebar-dropdown-btn')) {
                this.updateDropdownState(container);
                return;
            }

            const btn = document.createElement('div');
            btn.className = 'right-sidebar-dropdown-btn';

            const iconEl = document.createElement('div');
            iconEl.className = 'dropdown-active-icon';

            const titleEl = document.createElement('div');
            titleEl.className = 'dropdown-active-title';

            const chevronEl = document.createElement('div');
            chevronEl.className = 'dropdown-chevron';
            setIcon(chevronEl, 'chevron-down');

            btn.appendChild(iconEl);
            btn.appendChild(titleEl);
            btn.appendChild(chevronEl);

            btn.addEventListener('click', (evt) => {
                this.showMenu(evt, container);
            });

            // Prepend so it sits nicely if there are native UI action buttons on the right
            container.insertBefore(btn, container.firstChild);
            this.updateDropdownState(container);
        });
    }

    updateAllDropdownStates() {
        const rightContainers = document.querySelectorAll('.workspace-split.mod-right-split .workspace-tab-header-container');
        rightContainers.forEach(container => this.updateDropdownState(container));
    }

    updateDropdownState(container: Element) {
        const btn = container.querySelector('.right-sidebar-dropdown-btn');
		if (!btn) return;

		const activeTab = container.querySelector('.workspace-tab-header.is-active');
		const targetIconEl = btn.querySelector('.dropdown-active-icon');
		const targetTitleEl = btn.querySelector('.dropdown-active-title');

		if (!activeTab) {
			if (targetTitleEl) targetTitleEl.textContent = 'No active tab';
			if (targetIconEl) targetIconEl.innerHTML = '';
			return;
		}

		const title = activeTab.getAttribute('aria-label') || 'Select Application';
		const sourceIcon = activeTab.querySelector('.workspace-tab-header-inner-icon');

		if (targetTitleEl) targetTitleEl.textContent = title;
		if (targetIconEl && sourceIcon) {
			targetIconEl.innerHTML = sourceIcon.innerHTML;
		}
    }

	showMenu(evt: MouseEvent, container: Element) {
		evt.preventDefault();
		evt.stopPropagation();

		console.log('🔽 DROPDOWN: Opening menu, setting isMenuOpen=true');
		// CRITICAL: Set flag BEFORE creating menu
		this.isMenuOpen = true;

		// SAFETY: Force clear flag after 10s in case onHide never fires
		const safetyTimeout = setTimeout(() => {
			if (this.isMenuOpen) {
				console.warn('Menu flag stuck open - force clearing');
				this.isMenuOpen = false;
			}
		}, 10000);

		const menu = new Menu();

		const tabHeaders = container.querySelectorAll(
			'.workspace-tab-header:not(.right-sidebar-dropdown-btn)'
		);

		tabHeaders.forEach((header: HTMLElement) => {
			const title = header.getAttribute('aria-label') || header.innerText || 'Tab';
			const dataType = header.getAttribute('data-type');
			const isActive = header.classList.contains('is-active');

			menu.addItem((item) => {
				item.setTitle(title);
				item.setChecked(isActive);
				if (dataType) {
					item.setIcon(dataType);
				}
				item.onClick(() => {
					// Clear flag BEFORE clicking to allow normal sidebar behavior
					this.isMenuOpen = false;
					header.click();
					setTimeout(() => {
						this.updateAllDropdownStates();
					}, 50);
				});
			});
		});

		// Register hide callback to clear flag when menu closes by ANY means
		// (Escape key, click outside, etc.)
		if (typeof (menu as any).onHide === 'function') {
			(menu as any).onHide(() => {
				clearTimeout(safetyTimeout);
				console.log('🔼 DROPDOWN: Menu hidden, clearing isMenuOpen in 100ms');
				setTimeout(() => {
					this.isMenuOpen = false;
					console.log('✅ DROPDOWN: isMenuOpen cleared');
				}, 100);
			});
		}

		// Show the menu
		if (typeof (menu as any).showAtMouseEvent === 'function') {
			(menu as any).showAtMouseEvent(evt);
		} else {
			menu.showAtPosition({ x: evt.pageX, y: evt.pageY });
		}

		// DO NOT set isMenuOpen = false here - let onHide handle it
	}
}
