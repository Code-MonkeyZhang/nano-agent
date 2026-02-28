import React, { useMemo } from 'react';
import { Text, Box } from 'ink';
import {
  type StyledChar,
  toStyledCharacters,
  styledCharsToString,
  styledCharsWidth,
  wordBreakStyledChars,
  wrapStyledChars,
  widestLineFromStyledChars,
} from 'ink';
import { theme } from '../themes.js';

interface TableRendererProps {
  headers: string[];
  rows: string[][];
  terminalWidth: number;
}

const MIN_COLUMN_WIDTH = 5;
const COLUMN_PADDING = 2;
const TABLE_MARGIN = 2;

const calculateWidths = (text: string) => {
  const styledChars = toStyledCharacters(text);
  const contentWidth = styledCharsWidth(styledChars);

  const words: StyledChar[][] = wordBreakStyledChars(styledChars);
  const maxWordWidth = widestLineFromStyledChars(words);

  return { contentWidth, maxWordWidth };
};

interface ProcessedLine {
  text: string;
  width: number;
}

export const TableRenderer: React.FC<TableRendererProps> = ({
  headers,
  rows,
  terminalWidth,
}) => {
  const cleanedHeaders = useMemo(
    () => headers.map((header) => header.replace(/\*\*(.*?)\*\*/g, '$1')),
    [headers]
  );

  const { wrappedHeaders, wrappedRows, adjustedWidths } = useMemo(() => {
    const constraints = cleanedHeaders.map((header, colIndex) => {
      let { contentWidth: maxContentWidth, maxWordWidth } =
        calculateWidths(header);

      rows.forEach((row) => {
        const cell = row[colIndex] || '';
        const { contentWidth: cellWidth, maxWordWidth: cellWordWidth } =
          calculateWidths(cell);

        maxContentWidth = Math.max(maxContentWidth, cellWidth);
        maxWordWidth = Math.max(maxWordWidth, cellWordWidth);
      });

      const minWidth = maxWordWidth;
      const maxWidth = Math.max(minWidth, maxContentWidth);

      return { minWidth, maxWidth };
    });

    const fixedOverhead =
      cleanedHeaders.length + 1 + cleanedHeaders.length * COLUMN_PADDING;
    const availableWidth = Math.max(
      0,
      terminalWidth - fixedOverhead - TABLE_MARGIN
    );

    const totalMinWidth = constraints.reduce((sum, c) => sum + c.minWidth, 0);
    let finalContentWidths: number[];

    if (totalMinWidth > availableWidth) {
      const shortColumns = constraints.filter(
        (c) => c.maxWidth <= MIN_COLUMN_WIDTH
      );
      const totalShortColumnWidth = shortColumns.reduce(
        (sum, c) => sum + c.minWidth,
        0
      );

      const finalTotalShortColumnWidth =
        totalShortColumnWidth >= availableWidth ? 0 : totalShortColumnWidth;

      const scale =
        (availableWidth - finalTotalShortColumnWidth) /
        (totalMinWidth - finalTotalShortColumnWidth);
      finalContentWidths = constraints.map((c) => {
        if (c.maxWidth <= MIN_COLUMN_WIDTH && finalTotalShortColumnWidth > 0) {
          return c.minWidth;
        }
        return Math.floor(c.minWidth * scale);
      });
    } else {
      const surplus = availableWidth - totalMinWidth;
      const totalGrowthNeed = constraints.reduce(
        (sum, c) => sum + (c.maxWidth - c.minWidth),
        0
      );

      if (totalGrowthNeed === 0) {
        finalContentWidths = constraints.map((c) => c.minWidth);
      } else {
        finalContentWidths = constraints.map((c) => {
          const growthNeed = c.maxWidth - c.minWidth;
          const share = growthNeed / totalGrowthNeed;
          const extra = Math.floor(surplus * share);
          return Math.min(c.maxWidth, c.minWidth + extra);
        });
      }
    }

    const actualColumnWidths = new Array(cleanedHeaders.length).fill(0);

    const wrapAndProcessRow = (row: string[]) => {
      const rowResult: ProcessedLine[][] = [];
      row.forEach((cell, colIndex) => {
        const allocatedWidth = finalContentWidths[colIndex];
        const contentWidth = Math.max(1, allocatedWidth);

        const contentStyledChars = toStyledCharacters(cell);
        const wrappedStyledLines = wrapStyledChars(
          contentStyledChars,
          contentWidth
        );

        const maxLineWidth = widestLineFromStyledChars(wrappedStyledLines);
        actualColumnWidths[colIndex] = Math.max(
          actualColumnWidths[colIndex],
          maxLineWidth
        );

        const lines = wrappedStyledLines.map((line) => ({
          text: styledCharsToString(line),
          width: styledCharsWidth(line),
        }));
        rowResult.push(lines);
      });
      return rowResult;
    };

    const wrappedHeaders = wrapAndProcessRow(cleanedHeaders);
    const wrappedRows = rows.map((row) => wrapAndProcessRow(row));

    const adjustedWidths = actualColumnWidths.map((w) => w + COLUMN_PADDING);

    return { wrappedHeaders, wrappedRows, adjustedWidths };
  }, [cleanedHeaders, rows, terminalWidth]);

  const renderCell = (
    content: ProcessedLine,
    width: number,
    isHeader = false
  ): React.ReactNode => {
    const contentWidth = Math.max(0, width - COLUMN_PADDING);
    const displayWidth = content.width;
    const paddingNeeded = Math.max(0, contentWidth - displayWidth);

    return (
      <Text>
        {isHeader ? (
          <Text bold color={theme.text.link}>
            {content.text}
          </Text>
        ) : (
          <Text color={theme.text.primary}>{content.text}</Text>
        )}
        {' '.repeat(paddingNeeded)}
      </Text>
    );
  };

  const renderBorder = (type: 'top' | 'middle' | 'bottom'): React.ReactNode => {
    const chars = {
      top: { left: '┌', middle: '┬', right: '┐', horizontal: '─' },
      middle: { left: '├', middle: '┼', right: '┤', horizontal: '─' },
      bottom: { left: '└', middle: '┴', right: '┘', horizontal: '─' },
    };

    const char = chars[type];
    const borderParts = adjustedWidths.map((w) => char.horizontal.repeat(w));
    const border = char.left + borderParts.join(char.middle) + char.right;

    return <Text color={theme.border.default}>{border}</Text>;
  };

  const renderVisualRow = (
    cells: ProcessedLine[],
    isHeader = false
  ): React.ReactNode => {
    const renderedCells = cells.map((cell, index) => {
      const width = adjustedWidths[index] || 0;
      return renderCell(cell, width, isHeader);
    });

    return (
      <Text color={theme.text.primary}>
        <Text color={theme.border.default}>│</Text>{' '}
        {renderedCells.map((cell, index) => (
          <React.Fragment key={index}>
            {cell}
            {index < renderedCells.length - 1 && (
              <Text color={theme.border.default}>{' │ '}</Text>
            )}
          </React.Fragment>
        ))}{' '}
        <Text color={theme.border.default}>│</Text>
      </Text>
    );
  };

  const renderDataRow = (
    wrappedCells: ProcessedLine[][],
    rowIndex?: number,
    isHeader = false
  ): React.ReactNode => {
    const key = isHeader ? 'header' : `${rowIndex}`;
    const maxHeight = Math.max(...wrappedCells.map((lines) => lines.length), 1);

    const visualRows: React.ReactNode[] = [];
    for (let i = 0; i < maxHeight; i++) {
      const visualRowCells = wrappedCells.map(
        (lines) => lines[i] || { text: '', width: 0 }
      );
      visualRows.push(
        <React.Fragment key={`${key}-${i}`}>
          {renderVisualRow(visualRowCells, isHeader)}
        </React.Fragment>
      );
    }

    return <React.Fragment key={rowIndex}>{visualRows}</React.Fragment>;
  };

  return (
    <Box flexDirection="column" marginY={1}>
      {renderBorder('top')}
      {renderDataRow(wrappedHeaders, -1, true)}
      {renderBorder('middle')}
      {wrappedRows.map((row, index) => renderDataRow(row, index))}
      {renderBorder('bottom')}
    </Box>
  );
};
