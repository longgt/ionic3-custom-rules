import * as Lint from 'tslint';
import * as ts from 'typescript';

/**
 * A typed TSLint rule that inspects all imports from ionic-angular module is properly or not.
 */
export class Rule extends Lint.Rules.AbstractRule{
    static metadata: Lint.IRuleMetadata = {
      ruleName: 'ionic-properly-imports',
      description: 'Check import from ionic-angular module properly or not.',
      optionsDescription: '',
      options: null,
      typescriptOnly: true,
      type: 'typescript',
      hasFix: false
    };

    apply (sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
    }
}
// The walker takes care of all the work.
class Walker extends Lint.RuleWalker {
    protected visitImportDeclaration(node: ts.ImportDeclaration): void {
        if (node.moduleSpecifier) {
            let importStatement = node.moduleSpecifier.getText().trim();
            if (importStatement.includes(`ionic-angular/`)) {
                this.addFailure(this.createFailure(node.getStart(), node.getWidth(), 
                `${importStatement} maybe internal API. Try import ${node.importClause ? node.importClause.getText() : '{ ... }'} from 'ionic-angular' instead.`));
            } else {
                for (let bl of BLACKLIST) {
                    if (importStatement.includes(bl)) {
                        let isWl: boolean = false;
                        for (let wl of WHITELIST) {
                          if (!importStatement.replace(wl, '').includes('/')) {
                            isWl = true;
                            break;
                          }
                        }
                        if (isWl) {
                          continue;
                        }
                        let properlyImport = bl.substring(0, bl.length - 1);
                        this.addFailure(this.createFailure(node.getStart(), node.getWidth(), 
                        `${importStatement} maybe internal API. Try import ${node.importClause ? node.importClause.getText() : '{ ... }'} from '${properlyImport}' instead.`));
                        break;
                    }
                }
            }
        }
    }
}
const BLACKLIST = [
    "@angular/core/",
    "@angular/forms/",
    "@angular/platform-browser/",
    "@angular/common/http/",
    "@ngx-translate/core/",
    "@ngx-translate/http-loader/",
    "@angular/platform-browser-dynamic/"
];
const WHITELIST = [
 "@angular/core/testing"
];