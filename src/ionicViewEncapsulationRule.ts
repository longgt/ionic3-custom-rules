import * as Lint from 'tslint';
import * as ts from 'typescript';

/**
 * A typed TSLint rule that inspects all imports from ionic-angular module is properly or not.
 */
export class Rule extends Lint.Rules.AbstractRule{
    static metadata: Lint.IRuleMetadata = {
      ruleName: 'ionic-view-encapsulation',
      description: 'Check Angular component has defined encapsulation or not',
      optionsDescription: '',
      options: null,
      typescriptOnly: true,
      type: 'typescript',
      hasFix: true
    };

    apply (sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        //const program = ts.createProgram([sourceFile.fileName], {});
        //const typeChecker = program.getTypeChecker();
        return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
    }
}
// The walker takes care of all the work.
class Walker extends Lint.RuleWalker {
    addImport: boolean;
    protected visitClassDeclaration(node: ts.ClassDeclaration): void {
        if (node.decorators) {
            node.decorators.forEach(decorator => {
                if (decorator.expression && (decorator.expression as ts.CallExpression).expression 
                    && ((decorator.expression as ts.CallExpression).expression as ts.Identifier).text === 'Component') {
                    let args: ts.ObjectLiteralExpression = (decorator.expression as ts.CallExpression).arguments[0] as ts.ObjectLiteralExpression;
                    let defaultEncapsulation: boolean = false;
                    args.properties.forEach(prop => {
                        if (prop.name.getText() === 'encapsulation') {
                            defaultEncapsulation = true;
                        }
                    });
                    if (!defaultEncapsulation) {
                        let lastProp = args.properties[args.properties.length - 1];
                        this.addFailure(this.createFailure(lastProp.getStart(), lastProp.getWidth(), 'Angular Component should define encapsulation as None',
                        this.appendText(lastProp.getStart() + lastProp.getText().length, ',\n  encapsulation: ViewEncapsulation.None')));
                        this.addImport = true;
                        this.getSourceFile().statements.forEach(statement => {
                            if (ts.isImportDeclaration(statement)) {
                                this._visitImportDeclaration(statement);
                            }
                        });
                        return;
                    }
                }
            });
        }
    }

    protected _visitImportDeclaration(node: ts.ImportDeclaration): void {
        if (node.moduleSpecifier) {
            if (node.moduleSpecifier.getText().includes('@angular/core')
                && !node.importClause.getFullText().includes('ViewEncapsulation')) {
                let bindings = node.importClause.namedBindings;
                let lastImport = bindings.getChildAt(bindings.getChildCount() - 2)
                this.addFailure(this.createFailure(node.getStart(), node.getWidth(), 
                `ViewEncapsulation should be import in '@angular/core'.`,
                this.appendText(lastImport.getStart() + lastImport.getText().length, ', ViewEncapsulation')));
            }
        }
    }
}