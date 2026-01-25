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
        } else {
            document.body.classList.remove('sidebar-overlay-mode');
        }

        this.updatePegState();
    }

    applySidebarWidth(split: any, width: number) {
        if (!split || !split.containerEl) return;

        // Dynamic width check
        if ((split === this.leftSplit && this.settings.leftSidebarDynamicWidth) ||
            (split === this.rightSplit && this.settings.rightSidebarDynamicWidth)) {
             width = this.calculateDynamicWidth(split, split === this.leftSplit);
        }

        split.containerEl.style.transition = `width ${this.settings.expandCollapseSpeed}ms ease, max-width ${this.settings.expandCollapseSpeed}ms ease`;
        split.containerEl.style.width = `${width}px`;
        split.containerEl.style.maxWidth = `${width}px`;

        try {
            // Try Obsidian internal methods to resize
            if (typeof split.setSize === 'function') split.setSize(width);
            else if (typeof split.setWidth === 'function') split.setWidth(width);
            else if (typeof split.resize === 'function') split.resize();
            else if (typeof split.onResize === 'function') split.onResize();
        } catch (e) {
            // Ignore errors
        }
    }

    // --- Expansion/Collapse Methods ---

    expandRight() {
        if (!this.rightSplit) return;
        this.rightSplit.expand();
        this.isHoveringRight = true;
        setTimeout(() => {
            this.applySidebarWidth(this.rightSplit, this.settings.rightSidebarMaxWidth);
            if (this.settings.rightSidebarPegged) this.updatePegState();
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
        if (this.settings.rightSidebarPinned) return;
        if (!this.rightSplit) return;

        this.isHoveringRight = false;
        this.rightSplit.collapse();
        if (this.settings.rightSidebarPegged) this.updatePegState();
    }

    collapseLeft() {
        if (this.settings.leftSidebarPinned) return;
        if (!this.leftSplit) return;

        this.isHoveringLeft = false;
        this.leftSplit.collapse();
        if (this.settings.leftSidebarPegged) this.updatePegState();
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
        const viewportWidth = document.body.clientWidth; // or app.workspace.containerEl.clientWidth

        // Right Sidebar Logic
        if (this.settings.rightSidebar && !this.isHoveringRight && this.rightSplit && this.rightSplit.collapsed) {
             if (clientX >= (viewportWidth - this.settings.rightSideBarPixelTrigger)) {
                 this.isHoveringRight = true;
                 setTimeout(() => {
                     if (this.isHoveringRight) {
                         if (this.settings.syncLeftRight) this.expandBoth();
                         else this.expandRight();
                     }
                 }, this.settings.sidebarExpandDelay);

                 // Fallback check
                 setTimeout(() => {
                     if (!this.isHoveringRight) {
                         if (this.settings.syncLeftRight) this.collapseBoth();
                         else this.collapseRight();
                     }
                 }, this.settings.sidebarDelay);
             }
        }

        // Left Sidebar Logic
        if (this.settings.leftSidebar && !this.isHoveringLeft && this.leftSplit && this.leftSplit.collapsed) {
            if (clientX <= this.settings.leftSideBarPixelTrigger) {
                this.isHoveringLeft = true;
                setTimeout(() => {
                    if (this.isHoveringLeft) {
                        if (this.settings.syncLeftRight) this.expandBoth();
                        else this.expandLeft();
                    }
                }, this.settings.sidebarExpandDelay);

                 setTimeout(() => {
                     if (!this.isHoveringLeft) {
                         if (this.settings.syncLeftRight) this.collapseBoth();
                         else this.collapseLeft();
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

        // Find header container. usually .workspace-tab-header-container
        // Or .workspace-split > .workspace-tabs > .workspace-tab-header-container
        const header = split.containerEl.querySelector('.workspace-tab-header-container');
        if (!header) return;

        // Container for our buttons
        const btnContainer = document.createElement('div');
        btnContainer.addClass('sidebar-flyover-buttons');
        btnContainer.style.display = 'flex';
        btnContainer.style.alignItems = 'center';
        btnContainer.style.position = 'absolute';
        btnContainer.style.top = '0';
        btnContainer.style.right = isLeft ? '0' : '0'; // Both right of header? Or maybe left for left sidebar?
        // Usually headers have tabs. We should probably prepend or append to header inner.
        // Or just float absolute.
        // Prompt says "Position it in the top-right corner of the sidebar header"
        btnContainer.style.zIndex = '10';

        header.appendChild(btnContainer);

        // Pin Button
        const pinBtn = btnContainer.createEl('div', { cls: 'sidebar-flyover-btn pin-btn clickable-icon' });
        setIcon(pinBtn, 'pin');
        pinBtn.onclick = () => {
            if (isLeft) {
                this.settings.leftSidebarPinned = !this.settings.leftSidebarPinned;
                this.saveSettings();
                this.updatePinState(split, this.settings.leftSidebarPinned, pinBtn);
            } else {
                this.settings.rightSidebarPinned = !this.settings.rightSidebarPinned;
                this.saveSettings();
                this.updatePinState(split, this.settings.rightSidebarPinned, pinBtn);
            }
        };
        this.updatePinState(split, isLeft ? this.settings.leftSidebarPinned : this.settings.rightSidebarPinned, pinBtn);

        // Peg Button
        const pegBtn = btnContainer.createEl('div', { cls: 'sidebar-flyover-btn peg-btn clickable-icon' });
        setIcon(pegBtn, 'anchor'); // 'anchor' looks like a peg? or 'lock'? 'anchor' is fine.
        pegBtn.onclick = () => {
            if (isLeft) {
                this.settings.leftSidebarPegged = !this.settings.leftSidebarPegged;
                this.saveSettings();
                this.updatePegState();
                this.updatePegBtnState(pegBtn, this.settings.leftSidebarPegged);
            } else {
                this.settings.rightSidebarPegged = !this.settings.rightSidebarPegged;
                this.saveSettings();
                this.updatePegState();
                this.updatePegBtnState(pegBtn, this.settings.rightSidebarPegged);
            }
        };
        this.updatePegBtnState(pegBtn, isLeft ? this.settings.leftSidebarPegged : this.settings.rightSidebarPegged);
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
        // Handle Pegging logic (margins on body or main container)
        // We can set margins on .app-container or document.body

        let leftMargin = 0;
        let rightMargin = 0;

        if (this.settings.leftSidebarPegged && this.leftSplit && !this.leftSplit.collapsed) {
             // Calculate target width to avoid transition timing issues
             if (this.settings.leftSidebarDynamicWidth) {
                 leftMargin = this.calculateDynamicWidth(this.leftSplit, true);
             } else {
                 leftMargin = this.settings.leftSidebarMaxWidth;
             }
        }

        if (this.settings.rightSidebarPegged && this.rightSplit && !this.rightSplit.collapsed) {
             if (this.settings.rightSidebarDynamicWidth) {
                 rightMargin = this.calculateDynamicWidth(this.rightSplit, false);
             } else {
                 rightMargin = this.settings.rightSidebarMaxWidth;
             }
        }

        // Apply to main content container.
        // In Obsidian, .app-container usually contains splits.
        // If we want to "push" main content, and we are in overlay mode (absolute positioning),
        // we need to add margin to the element that sits UNDER the sidebars.
        // But the sidebars are normally flex items.
        // If overlayMode is ON, sidebars are absolute.
        // So we need to add margin to .workspace-split.mod-root (the center)
        // or just document.body if we want simple shift.

        // Wait, "When left sidebar pegged: ... document.body.style.marginLeft = ${width}px"
        // Prompt instructions say: "Apply width adjustment: document.body.style.marginLeft = ${width}px when expanded"

        if (this.settings.leftSidebarPegged && this.leftSplit && !this.leftSplit.collapsed) {
            document.body.style.marginLeft = `${leftMargin}px`;
            this.leftSplit.containerEl.classList.add('pegged');
        } else {
            document.body.style.marginLeft = '0px';
             if (this.leftSplit) this.leftSplit.containerEl.classList.remove('pegged');
        }

        if (this.settings.rightSidebarPegged && this.rightSplit && !this.rightSplit.collapsed) {
            document.body.style.marginRight = `${rightMargin}px`;
            this.rightSplit.containerEl.classList.add('pegged');
        } else {
            document.body.style.marginRight = '0px';
            if (this.rightSplit) this.rightSplit.containerEl.classList.remove('pegged');
        }
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
