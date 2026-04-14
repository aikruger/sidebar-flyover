import { App, PluginSettingTab, Setting, Plugin } from 'obsidian';
import MyPlugin from './main';

export interface SidebarHoverSettings {
    // General
    leftSidebar: boolean;
    rightSidebar: boolean;
    syncLeftRight: boolean;
    overlayMode: boolean;

    // Trigger
    leftSideBarPixelTrigger: number;
    rightSideBarPixelTrigger: number;

    // Timing
    sidebarDelay: number;
    sidebarExpandDelay: number;
    expandCollapseSpeed: number;

    // Appearance (Dimensions)
    leftSidebarMaxWidth: number;
    rightSidebarMaxWidth: number;

    // Feature: Pin
    leftSidebarPinned: boolean;
    rightSidebarPinned: boolean;

    // Feature: Peg
    leftSidebarPegged: boolean;
    rightSidebarPegged: boolean;

    // Feature: Dynamic Width
    leftSidebarDynamicWidth: boolean;
    rightSidebarDynamicWidth: boolean;
    leftSidebarMinWidth: number;
    rightSidebarMinWidth: number;

    // Feature: Right Sidebar Dropdown
    enableRightSidebarDropdown: boolean;

    // Feature: Ctrl to Activate
    requireCtrlToActivate: boolean;
}

export const DEFAULT_SETTINGS: SidebarHoverSettings = {
    leftSidebar: true,
    rightSidebar: true,
    syncLeftRight: false,
    overlayMode: true,
    leftSideBarPixelTrigger: 20,
    rightSideBarPixelTrigger: 20,
    sidebarDelay: 500,
    sidebarExpandDelay: 200,
    expandCollapseSpeed: 370,
    leftSidebarMaxWidth: 325,
    rightSidebarMaxWidth: 325,
    leftSidebarPinned: false,
    rightSidebarPinned: false,
    leftSidebarPegged: false,
    rightSidebarPegged: false,
    leftSidebarDynamicWidth: false,
    rightSidebarDynamicWidth: false,
    leftSidebarMinWidth: 200,
    rightSidebarMinWidth: 200,
    enableRightSidebarDropdown: true,
    requireCtrlToActivate: false,
};

export class SidebarFlyoverSettingTab extends PluginSettingTab {
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Sidebar Flyover Plus Settings' });

        // General Section
        containerEl.createEl('h3', { text: 'General' });

        new Setting(containerEl)
            .setName('Enable Left Sidebar Hover')
            .setDesc('Enable hover expansion for the left sidebar.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.leftSidebar)
                .onChange(async (value) => {
                    this.plugin.settings.leftSidebar = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Enable Right Sidebar Hover')
            .setDesc('Enable hover expansion for the right sidebar.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.rightSidebar)
                .onChange(async (value) => {
                    this.plugin.settings.rightSidebar = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Sync Left & Right')
            .setDesc('Expand both sidebars when either is triggered.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.syncLeftRight)
                .onChange(async (value) => {
                    this.plugin.settings.syncLeftRight = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Overlay Mode')
            .setDesc('Sidebars float over content instead of pushing it.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.overlayMode)
                .onChange(async (value) => {
                    this.plugin.settings.overlayMode = value;
                    await this.plugin.saveSettings();
                    // Need to toggle class on body if we were running
                    if (this.plugin.applyCSSVariables) this.plugin.applyCSSVariables();
                }));

        // Behavior Section
        containerEl.createEl('h3', { text: 'Behavior' });

        new Setting(containerEl)
            .setName('Require Ctrl to Activate')
            .setDesc(
                'When enabled, sidebars will only fly out when you hold the Ctrl key ' +
                'while moving the mouse to the screen edge. Useful for accidental activation.'
            )
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.requireCtrlToActivate)
                .onChange(async (value) => {
                    this.plugin.settings.requireCtrlToActivate = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Left Sidebar Trigger Area (px)')
            .setDesc('Width of the area to trigger left sidebar expansion.')
            .addText(text => text
                .setValue(String(this.plugin.settings.leftSideBarPixelTrigger))
                .onChange(async (value) => {
                    const num = Number(value);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.leftSideBarPixelTrigger = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Right Sidebar Trigger Area (px)')
            .setDesc('Width of the area to trigger right sidebar expansion.')
            .addText(text => text
                .setValue(String(this.plugin.settings.rightSideBarPixelTrigger))
                .onChange(async (value) => {
                    const num = Number(value);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.rightSideBarPixelTrigger = num;
                        await this.plugin.saveSettings();
                    }
                }));

        // Pinning
        new Setting(containerEl)
            .setName('Pin Left Sidebar')
            .setDesc('Keep left sidebar permanently open.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.leftSidebarPinned)
                .onChange(async (value) => {
                    this.plugin.settings.leftSidebarPinned = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Pin Right Sidebar')
            .setDesc('Keep right sidebar permanently open.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.rightSidebarPinned)
                .onChange(async (value) => {
                    this.plugin.settings.rightSidebarPinned = value;
                    await this.plugin.saveSettings();
                }));

        // Pegging
        new Setting(containerEl)
            .setName('Peg Left Sidebar')
            .setDesc('Push main content when left sidebar expands (overrides overlay).')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.leftSidebarPegged)
                .onChange(async (value) => {
                    this.plugin.settings.leftSidebarPegged = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Peg Right Sidebar')
            .setDesc('Push main content when right sidebar expands (overrides overlay).')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.rightSidebarPegged)
                .onChange(async (value) => {
                    this.plugin.settings.rightSidebarPegged = value;
                    await this.plugin.saveSettings();
                }));

        // Timing Section
        containerEl.createEl('h3', { text: 'Timing' });

        new Setting(containerEl)
            .setName('Expand Delay (ms)')
            .setDesc('Time to hover before expanding.')
            .addText(text => text
                .setValue(String(this.plugin.settings.sidebarExpandDelay))
                .onChange(async (value) => {
                    const num = Number(value);
                    if (!isNaN(num) && num >= 0) {
                        this.plugin.settings.sidebarExpandDelay = num;
                        await this.plugin.saveSettings();
                        if (this.plugin.applyCSSVariables) this.plugin.applyCSSVariables();
                    }
                }));

        new Setting(containerEl)
            .setName('Collapse Delay (ms)')
            .setDesc('Time to wait before collapsing after mouse leave.')
            .addText(text => text
                .setValue(String(this.plugin.settings.sidebarDelay))
                .onChange(async (value) => {
                    const num = Number(value);
                    if (!isNaN(num) && num >= 0) {
                        this.plugin.settings.sidebarDelay = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Animation Speed (ms)')
            .setDesc('Duration of the expansion/collapse animation.')
            .addText(text => text
                .setValue(String(this.plugin.settings.expandCollapseSpeed))
                .onChange(async (value) => {
                    const num = Number(value);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.expandCollapseSpeed = num;
                        await this.plugin.saveSettings();
                        if (this.plugin.applyCSSVariables) this.plugin.applyCSSVariables();
                    }
                }));

        // Appearance Section
        containerEl.createEl('h3', { text: 'Appearance & Dimensions' });

        new Setting(containerEl)
            .setName('Left Sidebar Max Width (px)')
            .setDesc('Maximum width for the left sidebar.')
            .addText(text => text
                .setValue(String(this.plugin.settings.leftSidebarMaxWidth))
                .onChange(async (value) => {
                    const num = Number(value);
                    if (!isNaN(num) && num >= 100) {
                        this.plugin.settings.leftSidebarMaxWidth = num;
                        await this.plugin.saveSettings();
                        if (this.plugin.applyCSSVariables) this.plugin.applyCSSVariables();
                    }
                }));

        new Setting(containerEl)
            .setName('Right Sidebar Max Width (px)')
            .setDesc('Maximum width for the right sidebar.')
            .addText(text => text
                .setValue(String(this.plugin.settings.rightSidebarMaxWidth))
                .onChange(async (value) => {
                    const num = Number(value);
                    if (!isNaN(num) && num >= 100) {
                        this.plugin.settings.rightSidebarMaxWidth = num;
                        await this.plugin.saveSettings();
                        if (this.plugin.applyCSSVariables) this.plugin.applyCSSVariables();
                    }
                }));

        // Dynamic Width
        new Setting(containerEl)
            .setName('Dynamic Width (Left)')
            .setDesc('Automatically adjust left sidebar width based on content.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.leftSidebarDynamicWidth)
                .onChange(async (value) => {
                    this.plugin.settings.leftSidebarDynamicWidth = value;
                    await this.plugin.saveSettings();
                }));

         new Setting(containerEl)
            .setName('Left Sidebar Min Width (px)')
            .setDesc('Minimum width when using dynamic width.')
            .addText(text => text
                .setValue(String(this.plugin.settings.leftSidebarMinWidth))
                .onChange(async (value) => {
                    const num = Number(value);
                    if (!isNaN(num) && num >= 100) {
                        this.plugin.settings.leftSidebarMinWidth = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Dynamic Width (Right)')
            .setDesc('Automatically adjust right sidebar width based on content.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.rightSidebarDynamicWidth)
                .onChange(async (value) => {
                    this.plugin.settings.rightSidebarDynamicWidth = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Right Sidebar Min Width (px)')
            .setDesc('Minimum width when using dynamic width.')
            .addText(text => text
                .setValue(String(this.plugin.settings.rightSidebarMinWidth))
                .onChange(async (value) => {
                    const num = Number(value);
                    if (!isNaN(num) && num >= 100) {
                        this.plugin.settings.rightSidebarMinWidth = num;
                        await this.plugin.saveSettings();
                    }
                }));

        // Right Sidebar Dropdown
        containerEl.createEl('h3', { text: 'Right Sidebar Dropdown' });

        new Setting(containerEl)
            .setName('Enable Dropdown Menu')
            .setDesc('Replace native tab headers with a dropdown menu in the right sidebar.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableRightSidebarDropdown)
                .onChange(async (value) => {
                    this.plugin.settings.enableRightSidebarDropdown = value;
                    await this.plugin.saveSettings();
                    // Trigger update
                    if (this.plugin.toggleRightSidebarDropdown) {
                        this.plugin.toggleRightSidebarDropdown(value);
                    }
                }));
    }
}
