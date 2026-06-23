import ts from "typescript";
import { UNPARSEABLE } from "./constants.mjs";

export function hasExportModifier(node) {
	return (node.modifiers ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
}

export function findModelConfigDeclaration(sourceFile) {
	let result = null;

	function visit(node) {
		if (result) {
			return;
		}

		if (ts.isVariableStatement(node) && hasExportModifier(node)) {
			for (const declaration of node.declarationList.declarations) {
				if (!declaration.initializer || !declaration.type) {
					continue;
				}

				const typeText = declaration.type.getText(sourceFile);
				if (typeText !== "ModelConfig") {
					continue;
				}

				if (
					ts.isCallExpression(declaration.initializer) &&
					declaration.initializer.expression.getText(sourceFile) === "createModelConfigObject" &&
					declaration.initializer.arguments.length > 0 &&
					ts.isArrayLiteralExpression(declaration.initializer.arguments[0])
				) {
					result = {
						style: "array",
						variableName: declaration.name.getText(sourceFile),
						arrayNode: declaration.initializer.arguments[0],
					};
					return;
				}

				if (ts.isObjectLiteralExpression(declaration.initializer)) {
					result = {
						style: "object",
						variableName: declaration.name.getText(sourceFile),
						objectNode: declaration.initializer,
					};
					return;
				}
			}
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return result;
}

export function getIndentAtPosition(text, position) {
	const lineStart = text.lastIndexOf("\n", position) + 1;
	let cursor = lineStart;

	while (cursor < text.length) {
		const char = text[cursor];
		if (char !== "\t" && char !== " ") {
			break;
		}
		cursor += 1;
	}

	return text.slice(lineStart, cursor);
}

export function getLineStart(text, position) {
	return text.lastIndexOf("\n", position) + 1;
}

export function getPropertyName(nameNode, sourceFile) {
	if (ts.isIdentifier(nameNode)) {
		return nameNode.text;
	}
	if (ts.isStringLiteral(nameNode) || ts.isNumericLiteral(nameNode)) {
		return nameNode.text;
	}
	if (ts.isNoSubstitutionTemplateLiteral(nameNode)) {
		return nameNode.text;
	}
	if (ts.isComputedPropertyName(nameNode)) {
		return nameNode.expression.getText(sourceFile);
	}
	return null;
}

export function getPropertyAssignment(objectNode, propertyName, sourceFile) {
	for (const property of objectNode.properties) {
		if (!ts.isPropertyAssignment(property)) {
			continue;
		}
		if (getPropertyName(property.name, sourceFile) === propertyName) {
			return property;
		}
	}
	return null;
}

export function getStringPropertyValue(objectNode, propertyName, sourceFile) {
	const property = getPropertyAssignment(objectNode, propertyName, sourceFile);
	if (!property) {
		return undefined;
	}
	if (
		ts.isStringLiteral(property.initializer) ||
		ts.isNoSubstitutionTemplateLiteral(property.initializer)
	) {
		return property.initializer.text;
	}
	return undefined;
}

export function getObjectPropertyValue(objectNode, propertyName, sourceFile) {
	const property = getPropertyAssignment(objectNode, propertyName, sourceFile);
	if (!property || !ts.isObjectLiteralExpression(property.initializer)) {
		return undefined;
	}

	const parsed = parseLiteralValue(property.initializer, sourceFile);
	return parsed !== UNPARSEABLE && parsed && typeof parsed === "object" && !Array.isArray(parsed)
		? parsed
		: undefined;
}

export function getReasoningOverrideModelIds(objectNode, sourceFile) {
	const reasoningConfig = getObjectPropertyValue(objectNode, "reasoningConfig", sourceFile);
	if (!reasoningConfig) {
		return [];
	}

	const modelOverrides = reasoningConfig.modelOverrides;
	if (!modelOverrides || typeof modelOverrides !== "object" || Array.isArray(modelOverrides)) {
		return [];
	}

	return Object.values(modelOverrides).filter((value) => typeof value === "string");
}

export function findProviderFromConstant(sourceFile) {
	let provider = null;

	function visit(node) {
		if (provider) {
			return;
		}
		if (!ts.isVariableDeclaration(node)) {
			ts.forEachChild(node, visit);
			return;
		}
		if (node.name.getText(sourceFile) !== "PROVIDER") {
			return;
		}
		if (
			node.initializer &&
			(ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))
		) {
			provider = node.initializer.text;
		}
	}

	visit(sourceFile);
	return provider;
}

export function extractArrayEntries(arrayNode, sourceFile) {
	const entries = [];

	for (const element of arrayNode.elements) {
		if (!ts.isCallExpression(element)) {
			continue;
		}
		if (element.expression.getText(sourceFile) !== "createModelConfig") {
			continue;
		}
		if (element.arguments.length < 3) {
			continue;
		}

		const keyArg = element.arguments[0];
		const configArg = element.arguments[2];

		if (!ts.isStringLiteralLike(keyArg)) {
			continue;
		}
		if (!ts.isObjectLiteralExpression(configArg)) {
			continue;
		}

		entries.push({
			modelKey: keyArg.text,
			entryNode: element,
			objectNode: configArg,
		});
	}

	return entries;
}

export function extractObjectEntries(outerObjectNode, sourceFile) {
	const entries = [];

	for (const property of outerObjectNode.properties) {
		if (!ts.isPropertyAssignment(property)) {
			continue;
		}
		if (!ts.isObjectLiteralExpression(property.initializer)) {
			continue;
		}

		const modelKey = getPropertyName(property.name, sourceFile);
		if (!modelKey) {
			continue;
		}

		entries.push({
			modelKey,
			entryNode: property,
			objectNode: property.initializer,
		});
	}

	return entries;
}

export function inferProviderFromObjectEntries(entries, sourceFile) {
	for (const entry of entries) {
		const provider = getStringPropertyValue(entry.objectNode, "provider", sourceFile);
		if (provider) {
			return provider;
		}
	}
	return null;
}

export function parseLiteralValue(node, sourceFile) {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
		return node.text;
	}
	if (ts.isNumericLiteral(node)) {
		return Number(node.text);
	}
	if (
		ts.isPrefixUnaryExpression(node) &&
		node.operator === ts.SyntaxKind.MinusToken &&
		ts.isNumericLiteral(node.operand)
	) {
		return -Number(node.operand.text);
	}
	if (node.kind === ts.SyntaxKind.TrueKeyword) {
		return true;
	}
	if (node.kind === ts.SyntaxKind.FalseKeyword) {
		return false;
	}
	if (node.kind === ts.SyntaxKind.NullKeyword) {
		return null;
	}
	if (ts.isArrayLiteralExpression(node)) {
		const items = [];
		for (const element of node.elements) {
			const parsed = parseLiteralValue(element, sourceFile);
			if (parsed === UNPARSEABLE) {
				return UNPARSEABLE;
			}
			items.push(parsed);
		}
		return items;
	}
	if (ts.isObjectLiteralExpression(node)) {
		const objectValue = {};
		for (const property of node.properties) {
			if (!ts.isPropertyAssignment(property)) {
				return UNPARSEABLE;
			}
			const key = getPropertyName(property.name, sourceFile);
			if (!key) {
				return UNPARSEABLE;
			}
			const parsed = parseLiteralValue(property.initializer, sourceFile);
			if (parsed === UNPARSEABLE) {
				return UNPARSEABLE;
			}
			objectValue[key] = parsed;
		}
		return objectValue;
	}
	return UNPARSEABLE;
}
