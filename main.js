const { Plugin, PluginSettingTab, Setting, Notice } = require('obsidian');
const { remote } = require('electron');

const DEFAULT_SETTINGS = {
    filePath: '',
    prefixSymbol: '',
    suffixSymbol: '',
    notFoundHotkey: ''
};

class CustomDictPlugin extends Plugin {
    async onload() {
        await this.loadSettings();
        this.addSettingTab(new CustomDictSettingTab(this.app, this));

        this.addCommand({
            id: 'check-inclusion',
            name: 'Check Inclusion',
            editorCallback: async (editor, view) => {
                let selectedText = editor.getSelection();

                if (!selectedText.trim()) {
                    new Notice("请先选中文字");
                    return;
                }

                // 获取修剪后的文本和选中的开始与结束位置
                const trimmedText = selectedText.trim();
                const selectionStart = editor.getCursor('from');
                const selectionEnd = editor.getCursor('to');
                const startOffset = selectedText.length - selectedText.trimStart().length;
                const endOffset = selectedText.length - selectedText.trimEnd().length;

                // 更新编辑器中的选中状态
                editor.setSelection(
                    { line: selectionStart.line, ch: selectionStart.ch + startOffset },
                    { line: selectionEnd.line, ch: selectionEnd.ch - endOffset }
                );

                const { filePath, prefixSymbol, suffixSymbol, notFoundHotkey } = this.settings;

                if (!filePath) {
                    new Notice("Please set the file path in the plugin settings.");
                    return;
                }

                const fileB = await this.app.vault.getAbstractFileByPath(filePath);
                if (!fileB) {
                    new Notice(`File ${filePath} not found.`);
                    return;
                }

                const fileBContent = await this.app.vault.read(fileB);
                const searchString = `${prefixSymbol}${trimmedText}${suffixSymbol}`;

                const lines = fileBContent.split('\n');
                const matchedLine = lines.find(line => line.includes(searchString));

                if (matchedLine) {
                    new Notice(`✅✅已收录✅✅\n${matchedLine}`, 5000);
                } else {
                    if (notFoundHotkey) {
                        this.triggerHotkey(notFoundHotkey);
                    }
                }
            }
        });
    }

    onunload() {
        console.log("Unloading Custom Dict Plugin");
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    triggerHotkey(hotkey) {
        const { globalShortcut } = remote;
        globalShortcut.register(hotkey, () => {
            console.log(`Hotkey ${hotkey} triggered`);
        });

        // Trigger the hotkey
        const modifiers = hotkey.split('+').map(key => key.trim().toLowerCase());
        const key = modifiers.pop();
        const eventInit = {
            key,
            bubbles: true,
            cancelable: true
        };

        modifiers.forEach(modifier => {
            eventInit[`${modifier}Key`] = true;
        });

        const event = new KeyboardEvent('keydown', eventInit);
        document.dispatchEvent(event);

        // Unregister the hotkey
        setTimeout(() => {
            globalShortcut.unregister(hotkey);
        }, 100);
    }
}

class CustomDictSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'Custom Dict 设置' });

        new Setting(containerEl)
        .setName('自定义字典')
        .setDesc('填写字典的路径')
        .addText(text => text
        .setPlaceholder('path/to/dict.md')
        .setValue(this.plugin.settings.filePath)
        .onChange(async (value) => {
            this.plugin.settings.filePath = value;
            await this.plugin.saveSettings();
        }));

        new Setting(containerEl)
        .setName('词组前缀')
        .setDesc('搜索词组+前缀')
        .addText(text => text
        .setPlaceholder('')
        .setValue(this.plugin.settings.prefixSymbol)
        .onChange(async (value) => {
            this.plugin.settings.prefixSymbol = value;
            await this.plugin.saveSettings();
        }));

        new Setting(containerEl)
        .setName('词组后缀')
        .setDesc('搜索词组+后缀')
        .addText(text => text
        .setPlaceholder('')
        .setValue(this.plugin.settings.suffixSymbol)
        .onChange(async (value) => {
            this.plugin.settings.suffixSymbol = value;
            await this.plugin.saveSettings();
        }));

        let hotkeyTextInput;

        new Setting(containerEl)
        .setName('热键启用其它插件')
        .setDesc('通过模拟按下热键来调用其它插件')
        .addText(text => {
            hotkeyTextInput = text;
            text.setPlaceholder('点击右边图标捕捉热键')
            .setValue(this.plugin.settings.notFoundHotkey)
            .onChange(async (value) => {
                this.plugin.settings.notFoundHotkey = value;
                await this.plugin.saveSettings();
            });
        })
        .addExtraButton(button => {
            button.setIcon('keyboard')
            .setTooltip('Record Hotkey')
            .onClick(async () => {
                const handler = (event) => {
                    event.preventDefault();
                    const modifiers = [];
                    if (event.ctrlKey) modifiers.push('Ctrl');
                    if (event.shiftKey) modifiers.push('Shift');
                    if (event.altKey) modifiers.push('Alt');
                    if (event.metaKey) modifiers.push('Meta');

                    const key = event.key.toUpperCase();
                    if (!['CONTROL', 'SHIFT', 'ALT', 'META'].includes(key)) {
                        const hotkey = [...modifiers, key].join('+');
                        this.plugin.settings.notFoundHotkey = hotkey;
                        hotkeyTextInput.setValue(hotkey);
                        this.plugin.saveSettings();

                        document.removeEventListener('keydown', handler);
                    }
                };

                document.addEventListener('keydown', handler);
            });
        });
    }
}

module.exports = CustomDictPlugin;
