import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Spacing, useTheme } from '@/constants/theme';

type Block = { kind: 'paragraph'; text: string } | { kind: 'item'; marker: string; text: string };

/** Splits a reply into paragraphs and list items. Consecutive plain lines join into one paragraph. */
function toBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };

  for (const raw of markdown.split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (bullet) {
      flush();
      blocks.push({ kind: 'item', marker: '•', text: bullet[1] });
    } else if (numbered) {
      flush();
      blocks.push({ kind: 'item', marker: `${numbered[1]}.`, text: numbered[2] });
    } else {
      // The assistant is told not to use headings; if one slips through, show it as bold text.
      const heading = line.match(/^#{1,6}\s+(.*)$/);
      if (heading) {
        flush();
        blocks.push({ kind: 'paragraph', text: `**${heading[1].replace(/\*\*/g, '')}**` });
      } else {
        paragraph.push(line);
      }
    }
  }
  flush();
  return blocks;
}

/** Renders **bold**, *italic* and `code` spans; everything else is plain text. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return (
            <Text key={i} style={styles.bold}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return (
            <Text key={i} style={styles.italic}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return <Fragment key={i}>{part.slice(1, -1)}</Fragment>;
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

/** The small subset of Markdown the chat assistant is asked to write: bold, italics, simple lists. */
export function MarkdownText({ children }: { children: string }) {
  const theme = useTheme();
  const textStyle = [styles.text, { color: theme.text }];
  return (
    <View style={styles.container}>
      {toBlocks(children).map((block, i) =>
        block.kind === 'item' ? (
          <View key={i} style={styles.item}>
            <Text style={[textStyle, styles.marker, { color: theme.textSecondary }]}>{block.marker}</Text>
            <Text style={[textStyle, styles.itemText]} selectable>
              <Inline text={block.text} />
            </Text>
          </View>
        ) : (
          <Text key={i} style={textStyle} selectable>
            <Inline text={block.text} />
          </Text>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  text: { fontSize: 17, lineHeight: 24 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  item: { flexDirection: 'row', gap: Spacing.sm },
  marker: { minWidth: 18, textAlign: 'right', fontVariant: ['tabular-nums'] },
  itemText: { flex: 1 },
});
