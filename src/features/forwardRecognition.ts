import * as vscode from 'vscode';

export function activateForwardRecognition(context: vscode.ExtensionContext) {
    // Register diagnostics collection to report issues
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('xml');

    // Function to analyze the XML file and identify issues with 'forward' tags
    function checkForwards(document: vscode.TextDocument) {
        console.log('Checking forwards in document:', document.fileName);
        const diagnostics: vscode.Diagnostic[] = [];
        const xmlText = document.getText();

        const forwardRegex = /<Forward.*>/g;
        const forwardMatches = xmlText.matchAll(forwardRegex);

        for (const match of forwardMatches || []) {
            const fullMatch = match[0];
            const matchIndex = match.index || 0;

            // Extract path attribute
            const pathMatch = fullMatch.match(/path=["']([^"']+)["']/);
            if (!pathMatch) continue; // Skip if no path attribute

            const path = pathMatch[1];
            const regex = new RegExp(`name=["']${path}["']`);
            const nameMatches = xmlText.match(regex);

            if (!nameMatches) {
                // Get the exact position of the <Forward> tag
                const startPos = document.positionAt(matchIndex);
                const endPos = document.positionAt(matchIndex + fullMatch.length);
                const range = new vscode.Range(startPos, endPos);

                // Create a warning
                const diagnostic = new vscode.Diagnostic(
                    range,
                    `Forward tag with path="${path}" has no matching name tag.`,
                    vscode.DiagnosticSeverity.Warning
                );

                diagnostics.push(diagnostic);
            }
        }

        // Report all diagnostics
        diagnosticCollection.set(document.uri, diagnostics);
    }

    // Trigger checks on save or document change
    vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.languageId === 'xml') {
            checkForwards(event.document);
        }
    });

    vscode.workspace.onDidOpenTextDocument((document) => {
        if (document.languageId === 'xml') {
            checkForwards(document);
        }
    });

    // Initial check for open documents
    vscode.workspace.textDocuments.forEach((document) => {
        if (document.languageId === 'xml') {
            checkForwards(document);
        }
    });
}