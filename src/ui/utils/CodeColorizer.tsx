import React from 'react';
import { Text, Box } from 'ink';
import { common, createLowlight } from 'lowlight';
import type {
  Root,
  Element,
  Text as HastText,
  ElementContent,
  RootContent,
} from 'hast';
import { theme } from '../themes.js';

const lowlight = createLowlight(common);

const colorMap: Record<string, string> = {
  keyword: theme.code.keyword,
  'atom keyword': theme.code.keyword,
  string: theme.code.string,
  number: theme.code.number,
  comment: theme.code.comment,
  'comment doc': theme.code.comment,
  function: theme.code.function,
  variable: theme.code.variable,
  operator: theme.code.operator,
  punctuation: theme.code.punctuation,
  tag: theme.code.keyword,
  attr: theme.code.property,
  attribute: theme.code.property,
  class: theme.code.class,
  'class title': theme.code.class,
  builtin: theme.code.builtin,
  property: theme.code.property,
  'property attr': theme.code.property,
  literal: theme.code.number,
  meta: theme.code.comment,
  name: theme.code.variable,
  'name tag': theme.code.keyword,
  'name attribute': theme.code.property,
  'name builtin': theme.code.builtin,
  'name class': theme.code.class,
  'name constant': theme.code.number,
  'name function': theme.code.function,
  'name variable': theme.code.variable,
  params: theme.code.variable,
  'params variable': theme.code.variable,
  'attr value': theme.code.string,
  'attr value punctuation': theme.code.punctuation,
  'attr value string': theme.code.string,
  deleted: theme.code.operator,
  inserted: theme.code.string,
  changed: theme.code.keyword,
};

function getColorForClass(className: string): string | undefined {
  if (colorMap[className]) {
    return colorMap[className];
  }
  const parts = className.split(' ');
  for (let i = parts.length - 1; i >= 0; i--) {
    const partialKey = parts.slice(i).join(' ');
    if (colorMap[partialKey]) {
      return colorMap[partialKey];
    }
  }
  return undefined;
}

function renderHastNode(
  node: Root | Element | HastText | RootContent,
  inheritedColor: string | undefined
): React.ReactNode {
  if (node.type === 'text') {
    const color = inheritedColor || theme.code.default;
    return <Text color={color}>{node.value}</Text>;
  }

  if (node.type === 'element') {
    const nodeClasses: string[] =
      (node.properties?.['className'] as string[]) || [];
    let elementColor: string | undefined = undefined;

    for (let i = nodeClasses.length - 1; i >= 0; i--) {
      const className = nodeClasses[i];
      const color = getColorForClass(className);
      if (color) {
        elementColor = color;
        break;
      }
    }

    const colorToPassDown = elementColor || inheritedColor;

    const children = node.children?.map(
      (child: ElementContent, index: number) => (
        <React.Fragment key={index}>
          {renderHastNode(child, colorToPassDown)}
        </React.Fragment>
      )
    );

    return <React.Fragment>{children}</React.Fragment>;
  }

  if (node.type === 'root') {
    if (!node.children || node.children.length === 0) {
      return null;
    }

    return node.children?.map((child: RootContent, index: number) => (
      <React.Fragment key={index}>
        {renderHastNode(child, inheritedColor)}
      </React.Fragment>
    ));
  }

  return null;
}

function highlightAndRenderLine(
  line: string,
  language: string | null
): React.ReactNode {
  try {
    const getHighlightedLine = () =>
      !language || !lowlight.registered(language)
        ? lowlight.highlightAuto(line)
        : lowlight.highlight(language, line);

    const renderedNode = renderHastNode(getHighlightedLine(), undefined);

    return renderedNode !== null ? renderedNode : line;
  } catch {
    return line;
  }
}

export interface ColorizeCodeOptions {
  code: string;
  language?: string | null;
  maxWidth: number;
  showLineNumbers?: boolean;
}

export function colorizeCode({
  code,
  language = null,
  maxWidth,
  showLineNumbers = false,
}: ColorizeCodeOptions): React.ReactNode {
  const codeToHighlight = code.replace(/\n$/, '');

  try {
    const lines = codeToHighlight.split('\n');
    const padWidth = String(lines.length).length;

    const renderedLines = lines.map((line, index) => {
      const contentToRender = highlightAndRenderLine(line, language);

      return (
        <Box key={index} minHeight={1}>
          {showLineNumbers && (
            <Box
              minWidth={padWidth + 1}
              flexShrink={0}
              paddingRight={1}
              alignItems="flex-start"
              justifyContent="flex-end"
            >
              <Text color={theme.text.secondary}>{`${index + 1}`}</Text>
            </Box>
          )}
          <Text color={theme.code.default} wrap="wrap">
            {contentToRender}
          </Text>
        </Box>
      );
    });

    return (
      <Box flexDirection="column" width={maxWidth}>
        {renderedLines}
      </Box>
    );
  } catch {
    const lines = codeToHighlight.split('\n');
    const padWidth = String(lines.length).length;
    const fallbackLines = lines.map((line, index) => (
      <Box key={index} minHeight={1}>
        {showLineNumbers && (
          <Box
            minWidth={padWidth + 1}
            flexShrink={0}
            paddingRight={1}
            alignItems="flex-start"
            justifyContent="flex-end"
          >
            <Text color={theme.text.secondary}>{`${index + 1}`}</Text>
          </Box>
        )}
        <Text color={theme.code.default}>{line}</Text>
      </Box>
    ));

    return (
      <Box flexDirection="column" width={maxWidth}>
        {fallbackLines}
      </Box>
    );
  }
}
