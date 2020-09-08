import * as Lint from 'tslint';
import * as ts from 'typescript';

/**
 * A typed TSLint rule that inspects all imports from ionic-angular module is properly or not.
 */
export class Rule extends Lint.Rules.AbstractRule{
    static metadata: Lint.IRuleMetadata = {
      ruleName: 'ionic-no-duplicate-class-name',
      description: 'Check class name is existed or not.',
      optionsDescription: '',
      options: null,
      typescriptOnly: true,
      type: 'typescript',
      hasFix: false
    };
    static classNameMap = new Map<string, string[]>();

    apply (sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
    }
}
// The walker takes care of all the work.
class Walker extends Lint.RuleWalker {
    protected visitClassDeclaration(node: ts.ClassDeclaration): void {
        if (node.name && node.decorators) {
            let className = node.name.getText();
            let fileName = this.getSourceFile().fileName;
            let existedFiles: string[] = Rule.classNameMap.get(className) || [];

            if (Rule.classNameMap.has(className)) {
                let existed: boolean = false;
                for (let name of existedFiles) {
                    if (name === fileName) {
                        existed = true;
                        break;
                    }
                }
                if (!existed) {
                    this.addFailure(this.createFailure(node.name.getStart(), node.name.getEnd(), `A class with name '${className}' was existed. Try another instead.`));
                }
            } else {
                existedFiles.push(fileName);
                Rule.classNameMap.set(className, existedFiles);
            }
        }
    }
}