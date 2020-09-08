import {
  ArrayLiteralExpression,
  CallExpression,
  ClassDeclaration,
  createClassDeclaration,
  createIdentifier,
  createNamedImports,
  Decorator,
  Expression,
  Identifier,
  ImportDeclaration,
  ImportSpecifier,
  NamedImports,
  Node,
  NodeArray,
  ObjectLiteralExpression,
  PropertyAccessExpression,
  PropertyAssignment,
  SourceFile,
  StringLiteral,
  SyntaxKind,
  TransformationContext,
  TransformerFactory,
  updateCall,
  updateClassDeclaration,
  updateImportClause,
  updateImportDeclaration,
  updateSourceFile,
  visitEachChild,
  VisitResult
} from 'typescript';
import * as Lint from "tslint";
import { basename, dirname, extname, join } from 'path';

export class Rule extends Lint.Rules.AbstractRule {
  public static FAILURE_STRING = "Invalid DeepLink config";
  static deepLinkConfigEntries = new Map<string, DeepLinkConfigEntry[]>();
  static segmentMap = new Map<string, string[]>();

  public apply (sourceFile: SourceFile): Lint.RuleFailure[] {
    return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
  }
}

// The walker takes care of all the work.
class Walker extends Lint.RuleWalker {
  /**
   * Visit class declaration. Get all DeepLinkConfig decorators
   */
  public visitClassDeclaration (node: ClassDeclaration) {
    if (node.decorators) {
      node.decorators.forEach(decorator => {
        const className = (node.name as Identifier).text;
        if (decorator.expression && (decorator.expression as CallExpression).expression && ((decorator.expression as CallExpression).expression as Identifier).text === DEEPLINK_DECORATOR_TEXT) {

          const deepLinkArgs = (decorator.expression as CallExpression).arguments;
          let deepLinkObject: ObjectLiteralExpression = null;
          if (deepLinkArgs && deepLinkArgs.length) {
            deepLinkObject = deepLinkArgs[0] as ObjectLiteralExpression;
          }
          let propertyList: Node[] = [];
          if (deepLinkObject && deepLinkObject.properties) {
            propertyList = deepLinkObject.properties as any as Node[]; // TODO this typing got jacked up
          }

          const sourceFile = this.getSourceFile();
          const defaultSegment = basename(changeExtension(sourceFile.fileName, ''));
          const deepLinkName = getStringValueFromDeepLinkDecorator(sourceFile, propertyList, className, DEEPLINK_DECORATOR_NAME_ATTRIBUTE);
          const deepLinkSegment = getStringValueFromDeepLinkDecorator(sourceFile, propertyList, defaultSegment, DEEPLINK_DECORATOR_SEGMENT_ATTRIBUTE);
          const deepLinkPriority = getStringValueFromDeepLinkDecorator(sourceFile, propertyList, 'low', DEEPLINK_DECORATOR_PRIORITY_ATTRIBUTE);
          const deepLinkDefaultHistory = getArrayValueFromDeepLinkDecorator(sourceFile, propertyList, [], DEEPLINK_DECORATOR_DEFAULT_HISTORY_ATTRIBUTE);
          const rawStringContent = getNodeStringContent(sourceFile, decorator.expression);
          const deepLinkConfigEntry = {
            name: deepLinkName,
            segment: deepLinkSegment,
            priority: deepLinkPriority,
            defaultHistory: deepLinkDefaultHistory,
            rawString: rawStringContent,
            className: className,
            fileName: this.getSourceFile().fileName
          };
          let valid: boolean = true;
          let entries = Rule.deepLinkConfigEntries.get(deepLinkConfigEntry.name) || [];
          let segments = Rule.segmentMap.get(deepLinkConfigEntry.segment) || [];
          if (Rule.deepLinkConfigEntries.has(deepLinkConfigEntry.name)) {
            let existed: boolean = false;
            for (let entry of entries) {
              if (entry.fileName === deepLinkConfigEntry.fileName) {
                existed = true;
                break;
              }
            }
            if (!existed) {
              let suggest: string = entries[0].fileName;
              this.addFailure(this.createFailure(node.getStart(), node.getWidth(), `Deeplink with name '${deepLinkName}' was existed at ${suggest}. Try another instead.`));
              valid = false;
            }
          }
          if (Rule.segmentMap.has(deepLinkConfigEntry.segment)) {
            let existed: boolean = false;
            for (let segment of segments) {
                if (segment === deepLinkConfigEntry.fileName) {
                    existed = true;
                    break;
                }
            }
            if (!existed) {
              let suggest: string = segments[0];
              this.addFailure(this.createFailure(node.getStart(), node.getWidth(), `Deeplink with segment '${deepLinkSegment}' was existed at ${suggest}. Try another instead.`));
              valid = false;
            }
          } 
          if (valid) {
            entries.push(deepLinkConfigEntry);
            Rule.deepLinkConfigEntries.set(deepLinkName, entries);
            segments.push(deepLinkConfigEntry.fileName);
            Rule.segmentMap.set(deepLinkSegment, segments);
          }
        }
      });
    }
  }
}

function getStringValueFromDeepLinkDecorator (sourceFile: SourceFile, propertyNodeList: Node[], defaultValue: string, identifierToLookFor: string) {
  try {
    let valueToReturn = defaultValue;

    propertyNodeList.forEach(propertyNode => {
      if (propertyNode && (propertyNode as PropertyAssignment).name && ((propertyNode as PropertyAssignment).name as Identifier).text === identifierToLookFor) {
        const initializer = ((propertyNode as PropertyAssignment).initializer as Expression);
        let stringContent = getNodeStringContent(sourceFile, initializer);
        stringContent = replaceAll(stringContent, '\'', '');
        stringContent = replaceAll(stringContent, '`', '');
        stringContent = replaceAll(stringContent, '"', '');
        stringContent = stringContent.trim();
        valueToReturn = stringContent;
      }
    });
    return valueToReturn;
  } catch (ex) {
    throw ex;
  }
}

function getArrayValueFromDeepLinkDecorator (sourceFile: SourceFile, propertyNodeList: Node[], defaultValue: string[], identifierToLookFor: string) {
  try {
    let valueToReturn = defaultValue;

    propertyNodeList.forEach(propertyNode => {
      if (propertyNode && (propertyNode as PropertyAssignment).name && ((propertyNode as PropertyAssignment).name as Identifier).text === identifierToLookFor) {
        const initializer = ((propertyNode as PropertyAssignment).initializer as ArrayLiteralExpression);
        if (initializer && initializer.elements) {
          const stringArray = initializer.elements.map((element: Identifier) => {
            let elementText = element.text;
            elementText = replaceAll(elementText, '\'', '');
            elementText = replaceAll(elementText, '`', '');
            elementText = replaceAll(elementText, '"', '');
            elementText = elementText.trim();
            return elementText;
          });
          valueToReturn = stringArray;
        }
      }
    });
    return valueToReturn;
  } catch (ex) {
    throw ex;
  }
}

export function getNodeStringContent (sourceFile: SourceFile, node: Node) {
  return sourceFile.getFullText().substring(node.getStart(sourceFile), node.getEnd());
}

export function replaceAll (input: string, toReplace: string, replacement: string) {
  if (!replacement) {
    replacement = '';
  }

  return input.split(toReplace).join(replacement);
}

export function changeExtension (filePath: string, newExtension: string) {
  const dir = dirname(filePath);
  const extension = extname(filePath);
  const extensionlessfileName = basename(filePath, extension);
  const newFileName = extensionlessfileName + newExtension;
  return join(dir, newFileName);
}

export interface DeepLinkDecoratorAndClass {
  name: string;
  segment: string;
  defaultHistory?: string[];
  priority: string;
  rawString?: string;
  className?: string;
  fileName?: string;
}

export interface DeepLinkPathInfo {
  absolutePath?: string;
  userlandModulePath?: string;
  className?: string;
  fileName?: string;
}

export interface DeepLinkConfigEntry extends DeepLinkDecoratorAndClass, DeepLinkPathInfo {
}

const DEEPLINK_DECORATOR_TEXT = 'IonicPage';
const DEEPLINK_DECORATOR_NAME_ATTRIBUTE = 'name';
const DEEPLINK_DECORATOR_SEGMENT_ATTRIBUTE = 'segment';
const DEEPLINK_DECORATOR_PRIORITY_ATTRIBUTE = 'priority';
const DEEPLINK_DECORATOR_DEFAULT_HISTORY_ATTRIBUTE = 'defaultHistory';