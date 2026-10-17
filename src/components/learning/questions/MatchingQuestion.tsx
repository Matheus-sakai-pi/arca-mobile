import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check, Link2, X } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import { colors, radius, spacing } from '@/constants/theme';
import { isAnswerPairs } from '@/lib/questionEngine';
import type { MatchingQuestion as Question } from '@/types/learning';
import { exerciseStyles, QuestionPrompt, toneColors, type Tone } from './QuestionParts';
import type { ExerciseProps } from './types';

export function MatchingQuestion({ question, answer, verified, onAnswer }: ExerciseProps<Question>) {
  const [leftId, selectLeft] = useState<string | null>(null);
  const pairs = isAnswerPairs(answer) ? answer : {};
  function connect(rightId: string) {
    if (verified || leftId === null) return;
    const next = Object.fromEntries(
      Object.entries(pairs).filter(([left, right]) => left !== leftId && right !== rightId),
    );
    onAnswer({ ...next, [leftId]: rightId });
    selectLeft(null);
  }
  function tile(id: string, label: string, side: 'left' | 'right') {
    const owner = side === 'left' ? id : Object.keys(pairs).find(left => pairs[left] === id);
    const paired = owner !== undefined && pairs[owner] !== undefined;
    const expected = paired && pairs[owner] === question.correctAnswer[owner];
    const tone: Tone =
      verified && paired
        ? expected
          ? 'correct'
          : 'wrong'
        : (side === 'left' && leftId === id) || paired
          ? 'selected'
          : 'neutral';
    const palette = toneColors[tone];
    const number = paired ? question.options.findIndex(option => option.id === owner) + 1 : null;
    const Icon = verified && paired ? (expected ? Check : X) : Link2;
    const disabled = verified || (side === 'right' && leftId === null);
    return (
      <Pressable
        key={`${side}:${id}`}
        accessibilityRole="button"
        accessibilityLabel={`${side === 'left' ? 'Esquerda' : 'Direita'}: ${label}${paired ? `, par ${number}` : ''}${verified && paired ? (expected ? ', par correto' : ', par incorreto') : ''}`}
        accessibilityState={{ selected: side === 'left' && leftId === id, disabled }}
        accessibilityHint={
          side === 'left'
            ? 'Seleciona este item para associar ou alterar seu par.'
            : 'Associa ao item selecionado à esquerda.'
        }
        disabled={disabled}
        onPress={() => (side === 'left' ? selectLeft(leftId === id ? null : id) : connect(id))}
        style={({ pressed }) => [
          styles.tile,
          { backgroundColor: palette.background, borderColor: palette.border },
          side === 'left' && leftId === id && styles.active,
          pressed && { opacity: 0.7 },
        ]}
      >
        <AppText color={palette.ink} style={styles.label}>
          {label}
        </AppText>
        <View style={styles.connection}>
          {paired ? (
            <>
              <Icon size={16} color={palette.ink} />
              <AppText variant="label" color={palette.ink}>
                {number}
              </AppText>
            </>
          ) : null}
        </View>
      </Pressable>
    );
  }
  return (
    <View style={exerciseStyles.container}>
      <QuestionPrompt text={question.prompt} />
      <AppText variant="small" color={colors.muted}>
        {Object.keys(pairs).length}/{question.options.length} pares associados
      </AppText>
      <View style={styles.columns}>
        <View style={styles.column}>
          {question.options.map(option => tile(option.id, option.label, 'left'))}
        </View>
        <View style={styles.column}>
          {question.rightOptions.map(option => tile(option.id, option.label, 'right'))}
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  columns: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  column: { flex: 1, gap: spacing.sm },
  tile: {
    minHeight: 104,
    borderWidth: 2,
    borderRadius: radius.sm,
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  active: { borderColor: colors.primaryDark, borderWidth: 3 },
  label: { textAlign: 'center', width: '100%' },
  connection: { minHeight: 20, flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
});
