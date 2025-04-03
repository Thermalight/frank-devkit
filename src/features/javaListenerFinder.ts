import * as vscode from 'vscode';

export function activateJavaListenerFinder(context: vscode.ExtensionContext) {
    // Register diagnostics collection to report issues
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('xml');

    async function validateSenders(document: vscode.TextDocument) {
        const listenerNames = await findAllListeners();
        const adapterNames = await findAllAdapters();

        const diagnostics: vscode.Diagnostic[] = [];
        const xmlText = document.getText();

        const frankSenderRegex = /<FrankSender[\s\S]*?>/g;
        const listenerRegex = /javaListener=["']([^"']+)["']/g;

        // Helper function to check matches and create diagnostics
        function checkMatches(matches: IterableIterator<RegExpMatchArray>, names: string[], targetExtractor: (match: RegExpMatchArray) => string, errorMessage: (target: string) => string) {
            for (const match of matches) {
                const fullMatch = match[0];
                const matchIndex = match.index || 0;
                const target = targetExtractor(match);
                if (!names.includes(target)) {
                    const startPos = document.positionAt(matchIndex);
                    const endPos = document.positionAt(matchIndex + fullMatch.length);
                    const range = new vscode.Range(startPos, endPos);

                    const diagnostic = new vscode.Diagnostic(
                        range,
                        errorMessage(target),
                        vscode.DiagnosticSeverity.Warning
                    );

                    diagnostics.push(diagnostic);
                }
            }
        }

        // Check FrankSender targets
        const frankSenderMatches = xmlText.matchAll(frankSenderRegex);
        checkMatches(
            frankSenderMatches,
            adapterNames,
            (match) => match[0].match(/target=["']([^"']+)["']/)?.[1] || "",
            (target) => `Adapter with name="${target}" not found.`
        );

        // Check JavaListener targets
        const listenerMatches = xmlText.matchAll(listenerRegex);
        checkMatches(
            listenerMatches,
            listenerNames,
            (match) => match[1], // Extract the listener name directly
            (target) => `JavaListener with  name="${target}" not found.`
        );

        // Push the diagnostics to the collection
        diagnosticCollection.set(document.uri, diagnostics);
    }

    // Trigger checks on save or document change
    vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.languageId === 'xml') {
            validateSenders(event.document);
        }
    });

    // Initial check for open documents
    vscode.workspace.textDocuments.forEach((document) => {
        if (document.languageId === 'xml') {
            validateSenders(document);
        }
    });
}

function findAllItems(type: string, regex: RegExp) {
    const names = new Set<string>(); // Use a Set to avoid duplicates

    return vscode.workspace.findFiles('**/*.xml', '**/node_modules/**').then(files => {
        return Promise.all(
            files.map(file =>
                vscode.workspace.openTextDocument(file).then(doc => {
                    const text = doc.getText();
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        names.add(match[1]); // Add the name to the Set
                    }
                })
            )
        ).then(() => Array.from(names)); // Convert Set to Array and return
    });
}

// Now you can call the function for both listeners and adapters:
function findAllListeners() {
    const listenerRegex = /<JavaListener [^>]*name=["']([^"']+)["'][^>]*>/g;
    return findAllItems('JavaListener', listenerRegex);
}

function findAllAdapters() {
    const adapterRegex = /<Adapter [^>]*name=["']([^"']+)["'][^>]*>/g;
    return findAllItems('Adapter', adapterRegex);
}