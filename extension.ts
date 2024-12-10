import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

let currentPage = 0;
let textContent: string[] = [];
let isEnabled = false;
let pageDirection: 'forward' | 'backward' = 'forward';
let statusBarItem: vscode.StatusBarItem;
let lastHoverContent: vscode.MarkdownString | undefined;
let globalContext: vscode.ExtensionContext;
let lastHoverTime = 0;

// 检查是否为 git 提交记录
function isGitCommit(document: vscode.TextDocument, position: vscode.Position): boolean {
    // 检查文件名是否为 git 相关
    const fileName = document.fileName.toLowerCase();
    if (fileName.includes('.git') || fileName.includes('git-') || fileName.includes('scm')) {
        return true;
    }

    // 检查当前行是否为 git 提交记录
    const lineText = document.lineAt(position.line).text.trim();
    
    // git 提交记录的特征
    const isCommitHash = /^[a-f0-9]{7,40}\b/.test(lineText);
    const hasGitKeywords = /\b(commit|author|date|merge|pull|push|branch)\b/i.test(lineText);
    const isGitDiff = lineText.startsWith('diff --git') || lineText.startsWith('@@') || lineText.startsWith('+') || lineText.startsWith('-');
    
    return isCommitHash || hasGitKeywords || isGitDiff;
}

// 更新状态栏图标
function updateStatusBarItem() {
    if (isEnabled) {
        const config = vscode.workspace.getConfiguration('hoverReader');
        const linesPerPage = config.get<number>('linesPerPage', 2);
        const maxPages = Math.ceil(textContent.length / linesPerPage);

        statusBarItem.text = `$(book) ${pageDirection === 'forward' ? '$(arrow-right)' : '$(arrow-left)'}`;
        statusBarItem.tooltip = new vscode.MarkdownString(`### Hover Reader 设置\n\n` +
            `- 状态：已启用\n` +
            `- 翻页方向：${pageDirection === 'forward' ? '向后' : '向前'}\n` +
            `- 当前页码：${currentPage + 1}/${maxPages}\n\n` +
            `---\n\n` +
            `$(folder) [选择文件](command:hover-reader.selectFile)\n` +
            `$(arrow-right) [设置每页行数](command:hover-reader.setLinesPerPage)\n` +
            `$(go-to-file) [跳转页数](command:hover-reader.gotoPage)\n` +
            `$(sync) [重置到第一页](command:hover-reader.reset)\n`
        );
        statusBarItem.tooltip.isTrusted = true;
    } else {
        statusBarItem.text = '$(book)';
        statusBarItem.tooltip = new vscode.MarkdownString(
            `### Hover Reader\n\n` +
            `点击开启阅读器\n\n` +
            `---\n\n` +
            `$(folder) [选择文件](command:hover-reader.selectFile)\n` +
            `$(gear) [更改设置](command:workbench.action.openSettings)`
        );
        statusBarItem.tooltip.isTrusted = true;
    }
}

// 从全局状态加载设置
function loadState(context: vscode.ExtensionContext) {
    currentPage = context.globalState.get('currentPage', 0);
    isEnabled = false;
    pageDirection = context.globalState.get('pageDirection', 'forward');
}

// 保存设置到全局状态
function saveState(context: vscode.ExtensionContext) {
    context.globalState.update('currentPage', currentPage);
    context.globalState.update('pageDirection', pageDirection);
}

// 翻页
function turnPage() {
    const config = vscode.workspace.getConfiguration('hoverReader');
    const linesPerPage = config.get<number>('linesPerPage', 2);
    const maxPages = Math.ceil(textContent.length / linesPerPage);
    if (pageDirection === 'forward') {
        currentPage = (currentPage + 1) % maxPages;
    } else {
        currentPage = (currentPage - 1 + maxPages) % maxPages;
    }
    saveState(globalContext);
    updateStatusBarItem();
}

// 跳转到指定页数
function gotoPage(pageNumber: number) {
    const config = vscode.workspace.getConfiguration('hoverReader');
    const linesPerPage = config.get<number>('linesPerPage', 2);
    const maxPages = Math.ceil(textContent.length / linesPerPage);
    
    // 确保页码在有效范围内
    currentPage = Math.max(0, Math.min(pageNumber - 1, maxPages - 1));
    saveState(globalContext);
    updateStatusBarItem();
    if (lastHoverContent) {
        lastHoverContent = createHoverContent();
    }
}

// 创建悬浮内容
function createHoverContent(): vscode.MarkdownString {
    const config = vscode.workspace.getConfiguration('hoverReader');
    const linesPerPage = config.get<number>('linesPerPage', 2);

    const startLine = currentPage * linesPerPage;
    const endLine = Math.min(startLine + linesPerPage, textContent.length);
    const content = textContent.slice(startLine, endLine).join('\n');
    const maxPages = Math.ceil(textContent.length / linesPerPage);
    
    const md = new vscode.MarkdownString();
    md.supportHtml = true;
    md.isTrusted = true;

    // 添加页码信息和内容，使用更小更淡的字体
    md.appendMarkdown(`<div style="color: #AAAAAA; font-size: 0.9em;">
        <span style="opacity: 0.7;">第 ${currentPage + 1}/${maxPages} 页</span>
        <div style="margin-top: 4px; line-height: 1.4;">${content}</div>
    </div>`);
    
    lastHoverContent = md;
    return md;
}

// 加载文本文件
async function loadTextFile(context: vscode.ExtensionContext) {
    try {
        const config = vscode.workspace.getConfiguration('hoverReader');
        let filePath = config.get<string>('textFilePath', '');

        // 如果配置中没有路径，使用默认文件
        if (!filePath) {
            filePath = path.join(context.extensionPath, 'sample.txt');
        } else {
            // 如果是相对路径且有工作区，则相对于工作区
            if (!path.isAbsolute(filePath) && vscode.workspace.workspaceFolders) {
                filePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, filePath);
            }
        }

        const buffer = fs.readFileSync(filePath);
        const content = buffer.toString('utf8').replace(/^\uFEFF/, '');
        textContent = content.split('\n').filter(line => line.trim() !== '');
        currentPage = 0; // 重置页码
        saveState(context);
        updateStatusBarItem();
        vscode.window.showInformationMessage(`已加载文件: ${path.basename(filePath)}`);
    } catch (err: any) {
        vscode.window.showErrorMessage(`无法读取文件: ${err.message || '未知错误'}`);
        textContent = ['示例文本 1', '示例文本 2', '示例文本 3'];
    }
}

export function activate(context: vscode.ExtensionContext) {
    globalContext = context;

    // 加载保存的状态
    loadState(context);

    // 创建状态栏图标
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'hover-reader.toggle';
    updateStatusBarItem();
    statusBarItem.show();

    // 初始加载文本文件
    loadTextFile(context);

    let hoverProvider: vscode.Disposable | undefined;

    // 注册设置每页行数命令
    let setLinesPerPageCommand = vscode.commands.registerCommand('hover-reader.setLinesPerPage', async () => {
        const result = await vscode.window.showInputBox({
            prompt: '请输入每页显示的行数',
            value: '2',
            validateInput: (value) => {
                const num = parseInt(value);
                if (isNaN(num) || num < 1) {
                    return '请输入大于 0 的数字';
                }
                return null;
            }
        });

        if (result) {
            const config = vscode.workspace.getConfiguration('hoverReader');
            await config.update('linesPerPage', parseInt(result), true);
            updateStatusBarItem();
            if (lastHoverContent) {
                lastHoverContent = createHoverContent();
            }
        }
    });

    // 注册跳转页数命令
    let gotoPageCommand = vscode.commands.registerCommand('hover-reader.gotoPage', async () => {
        const config = vscode.workspace.getConfiguration('hoverReader');
        const linesPerPage = config.get<number>('linesPerPage', 2);
        const maxPages = Math.ceil(textContent.length / linesPerPage);

        const result = await vscode.window.showInputBox({
            prompt: `请输入要跳转的页数 (1-${maxPages})`,
            value: (currentPage + 1).toString(),
            validateInput: (value) => {
                const num = parseInt(value);
                if (isNaN(num) || num < 1 || num > maxPages) {
                    return `请输入 1 到 ${maxPages} 之间的数字`;
                }
                return null;
            }
        });

        if (result) {
            gotoPage(parseInt(result));
        }
    });

    // 注册文件选择命令
    let selectFileCommand = vscode.commands.registerCommand('hover-reader.selectFile', async () => {
        const options: vscode.OpenDialogOptions = {
            canSelectMany: false,
            filters: {
                'Text Files': ['txt']
            }
        };

        const fileUri = await vscode.window.showOpenDialog(options);
        if (fileUri && fileUri[0]) {
            const config = vscode.workspace.getConfiguration('hoverReader');
            await config.update('textFilePath', fileUri[0].fsPath, true);
            await loadTextFile(context);
            if (lastHoverContent) {
                lastHoverContent = createHoverContent();
            }
        }
    });

    // 监听配置变化
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('hoverReader')) {
                updateStatusBarItem();
                if (e.affectsConfiguration('hoverReader.textFilePath')) {
                    loadTextFile(context);
                }
                if (lastHoverContent) {
                    lastHoverContent = createHoverContent();
                }
            }
        })
    );

    // 注册开关命令
    let toggleCommand = vscode.commands.registerCommand('hover-reader.toggle', () => {
        isEnabled = !isEnabled;
        if (isEnabled) {
            // 启用悬浮提供器
            hoverProvider = vscode.languages.registerHoverProvider('*', {
                provideHover(document, position, token) {
                    // 检查是否为 git 提交记录
                    if (isGitCommit(document, position)) {
                        return undefined;
                    }

                    const now = Date.now();
                    // 如果距离上次显示超过 500ms，自动翻页
                    if (now - lastHoverTime > 500) {
                        turnPage();
                        lastHoverContent = createHoverContent();
                    }
                    lastHoverTime = now;

                    // 创建悬浮框
                    const hover = new vscode.Hover(lastHoverContent || createHoverContent());
                    return hover;
                }
            });

            // 创建初始悬浮内容
            lastHoverContent = createHoverContent();
            vscode.window.showInformationMessage('阅读器已启用');
        } else {
            // 禁用悬浮提供器
            if (hoverProvider) {
                hoverProvider.dispose();
                hoverProvider = undefined;
            }
            // 清除悬浮内容
            lastHoverContent = undefined;

            vscode.window.showInformationMessage('阅读器已禁用');
        }
        updateStatusBarItem();
    });

    // 注册方向切换命令
    let forwardCommand = vscode.commands.registerCommand('hover-reader.forward', () => {
        pageDirection = 'forward';
        vscode.window.showInformationMessage('设置为向后翻页');
        saveState(context);
        updateStatusBarItem();
        if (lastHoverContent) {
            lastHoverContent = createHoverContent();
        }
    });

    let backwardCommand = vscode.commands.registerCommand('hover-reader.backward', () => {
        pageDirection = 'backward';
        vscode.window.showInformationMessage('设置为向前翻页');
        saveState(context);
        updateStatusBarItem();
        if (lastHoverContent) {
            lastHoverContent = createHoverContent();
        }
    });

    // 注册重置命令
    let resetCommand = vscode.commands.registerCommand('hover-reader.reset', () => {
        currentPage = 0;
        saveState(context);
        updateStatusBarItem();
        if (lastHoverContent) {
            lastHoverContent = createHoverContent();
        }
        vscode.window.showInformationMessage('已重置到第一页');
    });

    context.subscriptions.push(
        statusBarItem,
        toggleCommand,
        forwardCommand,
        backwardCommand,
        resetCommand,
        selectFileCommand,
        setLinesPerPageCommand,
        gotoPageCommand
    );
}

export function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
} 