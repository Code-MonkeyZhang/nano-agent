import React from 'react';
import { Text, Box } from 'ink';
import { theme } from '../themes.js';
import { colorizeCode } from './CodeColorizer.js';
import { TableRenderer } from './TableRenderer.js';
import { RenderInline } from './InlineMarkdownRenderer.js';

/**
 * Markdown 解析渲染组件
 * 将 Markdown 文本解析为终端可显示的 React 组件
 * 支持：标题、代码块、列表、表格、分隔线、行内格式（粗体、斜体、删除线、代码、链接等）
 *
 * @example
 * ```tsx
 * <MarkdownDisplay text="# Hello\n- item 1\n- item 2" terminalWidth={80} />
 * ```
 */
interface MarkdownDisplayProps {
  /** Markdown 格式的文本内容 */
  text: string;
  /** 终端宽度，用于计算布局和折行 */
  terminalWidth: number;
}

const EMPTY_LINE_HEIGHT = 1;
const CODE_BLOCK_PREFIX_PADDING = 1;
const LIST_ITEM_PREFIX_PADDING = 1;
const LIST_ITEM_TEXT_FLEX_GROW = 1;

const MarkdownDisplayInternal: React.FC<MarkdownDisplayProps> = ({
  text,
  terminalWidth,
}) => {
  const responseColor = theme.text.response ?? theme.text.primary;

  if (!text) return <></>;

  const lines = text.split(/\r?\n/);
  const headerRegex = /^ *(#{1,4}) +(.*)/;
  const codeFenceRegex = /^ *(`{3,}|~{3,}) *(\w*?) *$/;
  const ulItemRegex = /^([ \t]*)([-*+]) +(.*)/;
  const olItemRegex = /^([ \t]*)(\d+)\. +(.*)/;
  const hrRegex = /^ *([-*_] *){3,} *$/;
  const tableRowRegex = /^\s*\|(.+)\|\s*$/;
  const tableSeparatorRegex = /^\s*\|?\s*(:?-+:?)\s*(\|\s*(:?-+:?)\s*)+\|?\s*$/;

  const contentBlocks: React.ReactNode[] = [];
  let inCodeBlock = false;
  let lastLineEmpty = true;
  let codeBlockContent: string[] = [];
  let codeBlockLang: string | null = null;
  let codeBlockFence = '';
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeaders: string[] = [];

  function addContentBlock(block: React.ReactNode) {
    if (block) {
      contentBlocks.push(block);
      lastLineEmpty = false;
    }
  }

  lines.forEach((line, index) => {
    const key = `line-${index}`;

    if (inCodeBlock) {
      const fenceMatch = line.match(codeFenceRegex);
      if (
        fenceMatch &&
        fenceMatch[1].startsWith(codeBlockFence[0]) &&
        fenceMatch[1].length >= codeBlockFence.length
      ) {
        addContentBlock(
          <RenderCodeBlock
            key={key}
            content={codeBlockContent}
            lang={codeBlockLang}
            terminalWidth={terminalWidth}
          />
        );
        inCodeBlock = false;
        codeBlockContent = [];
        codeBlockLang = null;
        codeBlockFence = '';
      } else {
        codeBlockContent.push(line);
      }
      return;
    }

    const codeFenceMatch = line.match(codeFenceRegex);
    const headerMatch = line.match(headerRegex);
    const ulMatch = line.match(ulItemRegex);
    const olMatch = line.match(olItemRegex);
    const hrMatch = line.match(hrRegex);
    const tableRowMatch = line.match(tableRowRegex);
    const tableSeparatorMatch = line.match(tableSeparatorRegex);

    if (codeFenceMatch) {
      inCodeBlock = true;
      codeBlockFence = codeFenceMatch[1];
      codeBlockLang = codeFenceMatch[2] || null;
    } else if (tableRowMatch && !inTable) {
      if (
        index + 1 < lines.length &&
        lines[index + 1].match(tableSeparatorRegex)
      ) {
        inTable = true;
        tableHeaders = tableRowMatch[1].split('|').map((cell) => cell.trim());
        tableRows = [];
      } else {
        addContentBlock(
          <Box key={key}>
            <Text wrap="wrap" color={responseColor}>
              <RenderInline text={line} defaultColor={responseColor} />
            </Text>
          </Box>
        );
      }
    } else if (inTable && tableSeparatorMatch) {
      // Skip separator line
    } else if (inTable && tableRowMatch) {
      const cells = tableRowMatch[1].split('|').map((cell) => cell.trim());
      while (cells.length < tableHeaders.length) {
        cells.push('');
      }
      if (cells.length > tableHeaders.length) {
        cells.length = tableHeaders.length;
      }
      tableRows.push(cells);
    } else if (inTable && !tableRowMatch) {
      if (tableHeaders.length > 0 && tableRows.length > 0) {
        addContentBlock(
          <RenderTable
            key={`table-${contentBlocks.length}`}
            headers={tableHeaders}
            rows={tableRows}
            terminalWidth={terminalWidth}
          />
        );
      }
      inTable = false;
      tableRows = [];
      tableHeaders = [];

      if (line.trim().length > 0) {
        addContentBlock(
          <Box key={key}>
            <Text wrap="wrap" color={responseColor}>
              <RenderInline text={line} defaultColor={responseColor} />
            </Text>
          </Box>
        );
      }
    } else if (hrMatch) {
      addContentBlock(
        <Box key={key}>
          <Text dimColor>---</Text>
        </Box>
      );
    } else if (headerMatch) {
      const level = headerMatch[1].length;
      const headerText = headerMatch[2];
      let headerNode: React.ReactNode = null;
      switch (level) {
        case 1:
        case 2:
          headerNode = (
            <Text bold color={theme.text.link}>
              <RenderInline text={headerText} defaultColor={theme.text.link} />
            </Text>
          );
          break;
        case 3:
          headerNode = (
            <Text bold color={responseColor}>
              <RenderInline text={headerText} defaultColor={responseColor} />
            </Text>
          );
          break;
        case 4:
          headerNode = (
            <Text italic color={theme.text.secondary}>
              <RenderInline
                text={headerText}
                defaultColor={theme.text.secondary}
              />
            </Text>
          );
          break;
        default:
          headerNode = (
            <Text color={responseColor}>
              <RenderInline text={headerText} defaultColor={responseColor} />
            </Text>
          );
          break;
      }
      if (headerNode) addContentBlock(<Box key={key}>{headerNode}</Box>);
    } else if (ulMatch) {
      const leadingWhitespace = ulMatch[1];
      const marker = ulMatch[2];
      const itemText = ulMatch[3];
      addContentBlock(
        <RenderListItem
          key={key}
          itemText={itemText}
          type="ul"
          marker={marker}
          leadingWhitespace={leadingWhitespace}
        />
      );
    } else if (olMatch) {
      const leadingWhitespace = olMatch[1];
      const marker = olMatch[2];
      const itemText = olMatch[3];
      addContentBlock(
        <RenderListItem
          key={key}
          itemText={itemText}
          type="ol"
          marker={marker}
          leadingWhitespace={leadingWhitespace}
        />
      );
    } else {
      if (line.trim().length === 0 && !inCodeBlock) {
        if (!lastLineEmpty) {
          contentBlocks.push(
            <Box key={`spacer-${index}`} height={EMPTY_LINE_HEIGHT} />
          );
          lastLineEmpty = true;
        }
      } else {
        addContentBlock(
          <Box key={key}>
            <Text wrap="wrap" color={responseColor}>
              <RenderInline text={line} defaultColor={responseColor} />
            </Text>
          </Box>
        );
      }
    }
  });

  if (inCodeBlock) {
    addContentBlock(
      <RenderCodeBlock
        key="line-eof"
        content={codeBlockContent}
        lang={codeBlockLang}
        terminalWidth={terminalWidth}
      />
    );
  }

  if (inTable && tableHeaders.length > 0 && tableRows.length > 0) {
    addContentBlock(
      <RenderTable
        key={`table-${contentBlocks.length}`}
        headers={tableHeaders}
        rows={tableRows}
        terminalWidth={terminalWidth}
      />
    );
  }

  return <>{contentBlocks}</>;
};

/**
 * 代码块渲染组件属性
 * 用于渲染带有语法高亮的代码块
 */
interface RenderCodeBlockProps {
  /** 代码块内容（按行分割的数组） */
  content: string[];
  /** 代码语言标识（如 js, ts, python 等） */
  lang: string | null;
  /** 终端宽度，用于计算布局 */
  terminalWidth: number;
}

const RenderCodeBlockInternal: React.FC<RenderCodeBlockProps> = ({
  content,
  lang,
  terminalWidth,
}) => {
  const fullContent = content.join('\n');
  const colorizedCode = colorizeCode({
    code: fullContent,
    language: lang,
    maxWidth: terminalWidth - CODE_BLOCK_PREFIX_PADDING,
    showLineNumbers: true,
  });

  return (
    <Box
      paddingLeft={CODE_BLOCK_PREFIX_PADDING}
      flexDirection="column"
      width={terminalWidth}
      flexShrink={0}
    >
      {colorizedCode}
    </Box>
  );
};

const RenderCodeBlock = React.memo(RenderCodeBlockInternal);

/**
 * 列表项渲染组件属性
 * 支持无序列表和有序列表
 */
interface RenderListItemProps {
  /** 列表项的文本内容 */
  itemText: string;
  /** 列表类型：ul=无序列表，ol=有序列表 */
  type: 'ul' | 'ol';
  /** 列表标记符号（无序：-/*+，有序：数字） */
  marker: string;
  /** 前导空白字符数量，用于缩进 */
  leadingWhitespace?: string;
}

const RenderListItemInternal: React.FC<RenderListItemProps> = ({
  itemText,
  type,
  marker,
  leadingWhitespace = '',
}) => {
  const prefix = type === 'ol' ? `${marker}. ` : `${marker} `;
  const prefixWidth = prefix.length;
  const indentation = leadingWhitespace.length;
  const listResponseColor = theme.text.response ?? theme.text.primary;

  return (
    <Box
      paddingLeft={indentation + LIST_ITEM_PREFIX_PADDING}
      flexDirection="row"
    >
      <Box width={prefixWidth}>
        <Text color={listResponseColor}>{prefix}</Text>
      </Box>
      <Box flexGrow={LIST_ITEM_TEXT_FLEX_GROW}>
        <Text wrap="wrap" color={listResponseColor}>
          <RenderInline text={itemText} defaultColor={listResponseColor} />
        </Text>
      </Box>
    </Box>
  );
};

const RenderListItem = React.memo(RenderListItemInternal);

/**
 * 表格渲染组件属性
 * 用于渲染 Markdown 表格
 */
interface RenderTableProps {
  /** 表头行（单元格文本数组） */
  headers: string[];
  /** 数据行（二维数组，每行包含多个单元格） */
  rows: string[][];
  /** 终端宽度，用于计算列宽 */
  terminalWidth: number;
}

const RenderTableInternal: React.FC<RenderTableProps> = ({
  headers,
  rows,
  terminalWidth,
}) => (
  <TableRenderer headers={headers} rows={rows} terminalWidth={terminalWidth} />
);

const RenderTable = React.memo(RenderTableInternal);

export const MarkdownDisplay = React.memo(MarkdownDisplayInternal);
