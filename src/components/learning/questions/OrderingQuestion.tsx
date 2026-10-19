import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ArrowDown, ArrowUp, Check, X, type LucideIcon } from '@/components/icons';
import Animated, { LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { AppText } from '@/components/common/AppText';
import { colors, radius, spacing } from '@/constants/theme';
import { isAnswerList } from '@/lib/questionEngine';
import type { OrderingQuestion as Question } from '@/types/learning';
import { exerciseStyles, QuestionPrompt, toneColors, WordChip } from './QuestionParts';
import type { ExerciseProps } from './types';

function OrderingAction({
  icon: Icon,
  label,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <View style={styles.actionFrame}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={({ pressed }) => [styles.action, disabled && { opacity: 0.3 }, pressed && { opacity: 0.7 }]}
      >
        <Icon size={20} color={colors.primaryDark} />
      </Pressable>
      {hovered && !disabled ? (
        <View style={styles.tooltip}>
          <AppText variant="small" color={colors.surface}>
            {label.split(':')[0]}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
export function OrderingQuestion({ question, answer, verified, onAnswer }: ExerciseProps<Question>) {
  const reduced = useMotionPreference();
  const order = isAnswerList(answer) ? answer : [];
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (verified || target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onAnswer(next);
  }
  return (
    <View style={exerciseStyles.container}>
      <QuestionPrompt text={question.prompt} />
      <View style={styles.sequence}>
        {question.options.map((_option, index) => {
          const id = order[index];
          const label = question.options.find(option => option.id === id)?.label;
          const correct = verified && id === question.correctAnswer[index];
          const palette =
            toneColors[verified ? (correct ? 'correct' : 'wrong') : id ? 'selected' : 'neutral'];
          return (
            <Animated.View
              key={id ?? `empty:${index}`}
              layout={LinearTransition.duration(160).reduceMotion(
                reduced ? ReduceMotion.Always : ReduceMotion.System,
              )}
              style={[styles.step, { backgroundColor: palette.background, borderColor: palette.border }]}
            >
              <View style={styles.stepHeading}>
                <AppText variant="label" color={palette.ink}>
                  {index + 1}
                </AppText>
                <AppText
                  color={palette.ink}
                  style={styles.label}
                  accessibilityLabel={label ? `${index + 1}. ${label}` : `Etapa ${index + 1}, vazia`}
                >
                  {label ?? '______'}
                </AppText>
                {verified ? (
                  correct ? (
                    <Check size={20} color={palette.ink} />
                  ) : (
                    <X size={20} color={palette.ink} />
                  )
                ) : null}
              </View>
              {!verified ? (
                <View style={styles.actions}>
                  <OrderingAction
                    icon={ArrowUp}
                    label={`Subir: ${label ?? 'etapa vazia'}`}
                    disabled={!id || index === 0}
                    onPress={() => move(index, -1)}
                  />
                  <OrderingAction
                    icon={ArrowDown}
                    label={`Descer: ${label ?? 'etapa vazia'}`}
                    disabled={!id || index === order.length - 1}
                    onPress={() => move(index, 1)}
                  />
                  <OrderingAction
                    icon={X}
                    label={`Remover: ${label ?? 'etapa vazia'}`}
                    disabled={!id}
                    onPress={() => onAnswer(order.filter(value => value !== id))}
                  />
                </View>
              ) : null}
            </Animated.View>
          );
        })}
      </View>
      {!verified && order.length < question.options.length ? (
        <View accessibilityLabel="Eventos disponíveis" style={exerciseStyles.chips}>
          {question.options
            .filter(option => !order.includes(option.id))
            .map(option => (
              <WordChip
                key={option.id}
                label={option.label}
                disabled={verified}
                onPress={() => onAnswer([...order, option.id])}
              />
            ))}
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  sequence: { gap: spacing.sm },
  step: { borderRadius: radius.sm, borderWidth: 2, minHeight: 64, padding: spacing.sm, gap: spacing.xs },
  stepHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { flex: 1 },
  actions: { flexDirection: 'row', alignSelf: 'flex-end', gap: spacing.xs },
  actionFrame: { width: 44, height: 44 },
  action: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltip: {
    position: 'absolute',
    bottom: 48,
    right: 0,
    padding: spacing.xs,
    backgroundColor: colors.text,
    borderRadius: radius.sm,
    minWidth: 72,
    alignItems: 'center',
    zIndex: 2,
  },
});
