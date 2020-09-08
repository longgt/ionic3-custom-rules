import * as Lint from 'tslint';
import * as ts from 'typescript';

/**
 * A typed TSLint rule that check all component having multiple declaration or not.
 */
export class Rule extends Lint.Rules.AbstractRule{
    static metadata: Lint.IRuleMetadata = {
      ruleName: 'ionic-no-duplicate-declaration',
      description: 'Check duplicate on module declaration',
      optionsDescription: '',
      options: null,
      typescriptOnly: true,
      type: 'typescript',
      hasFix: false
    };
    static moduleMap = new Map<string, string[]>();

    apply (sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        let failures = this.applyWithWalker(new Walker(sourceFile, this.getOptions()));

        return failures;
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
                    let isComponent: boolean = false;
                    args.properties.forEach(prop => {
                        if (prop.name.getText() === 'selector') {
                            isComponent = true;

                            return;
                        }
                    });
                    if (isComponent) {
                        let className = node.name.getText();
                        let existedModules: string[] = Rule.moduleMap.get(className) || [];
                        Rule.moduleMap.set(className, existedModules);
                    }
                }
                if (decorator.expression && (decorator.expression as ts.CallExpression).expression
                    && ((decorator.expression as ts.CallExpression).expression as ts.Identifier).text === 'NgModule') {
                    let args: ts.ObjectLiteralExpression = (decorator.expression as ts.CallExpression).arguments[0] as ts.ObjectLiteralExpression;
                    let moduleName: string = node.name.getText();

                    Rule.moduleMap.forEach((value, key) => {
                        if (value && value.length > 0) {
                            let index = value.findIndex(module => module === moduleName);
                            if (index >= 0) {
                                value.splice(index, 1);
                            }
                        }
                    });
                    args.properties.forEach((prop: ts.PropertyAssignment) => {
                        if (prop.name.getText() === 'declarations'
                            && ts.isArrayLiteralExpression(prop.initializer)) {
                            
                            prop.initializer.elements.forEach((ele: ts.Identifier) => {
                                let compName: string = ele.getText();
                                let existedModules: string[] = Rule.moduleMap.get(compName) || [];

                                if (existedModules.indexOf(moduleName) < 0) {
                                    existedModules.push(moduleName);
                                    Rule.moduleMap.set(compName, existedModules);
                                } 
                                if(existedModules.length > 1) {
                                    let modules: string = existedModules.join(',');
                                    this.addFailure(this.createFailure(node.name.getStart(), node.name.getEnd(), `A component with name '${compName}' was multiple declaration in '${modules}'`));
                                }
                            });

                            return;
                        }
                    });
                }
            });
        }
    }
}