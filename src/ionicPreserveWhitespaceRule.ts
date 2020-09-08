import * as Lint from 'tslint';
import * as ts from 'typescript';

/**
 * A typed TSLint rule that inspects all imports from ionic-angular module is properly or not.
 */
export class Rule extends Lint.Rules.AbstractRule{
    static metadata: Lint.IRuleMetadata = {
      ruleName: 'ionic-preserve-whitespace',
      description: 'Check Angular component has defined preserveWhitespace or not',
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
                    let preserveWhitespace: boolean = false;
                    args.properties.forEach(prop => {
                        if (prop.name.getText() === 'preserveWhitespaces') {
                            preserveWhitespace = true;
                        }
                    });

                    if (!preserveWhitespace) {
                        let lastProp = args.properties[args.properties.length - 1];
                        this.addFailure(this.createFailure(lastProp.getStart(), lastProp.getWidth(), 'Angular Component should define preserveWhitespaces as false',
                        this.appendText(lastProp.getStart() + lastProp.getText().length, ',\n  preserveWhitespaces: false')));

                        return;
                    }
                }
            });
        }
    }
}