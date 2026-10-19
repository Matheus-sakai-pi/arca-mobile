import type { ComponentType, ReactNode } from 'react';
import { Platform, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

// Ícones planos (flat) do Arca: formas cheias, sem contorno, com uma luz mais clara por cima.
// Mantêm os mesmos nomes e props usados antes (size, color, style), então trocam a biblioteca
// antiga sem mudar as telas. Ícones ilustrados usam as próprias cores; sobre fundo colorido
// (cor branca pedida) viram silhueta branca para manter o contraste. Ícones de controle
// (setas, fechar, check) são formas grossas na cor pedida.
export type IconProps = {
  size?: number;
  color?: ColorValue;
  /** Aceito por compatibilidade; os ícones planos não usam traço. */
  strokeWidth?: number;
  /** Aceito por compatibilidade; os ícones planos têm cores próprias. */
  fill?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};
export type LucideIcon = ComponentType<IconProps>;

const ink = '#2B3550';
const p = {
  blue: '#1E7BFF', blueDark: '#0B5BD9', blueLight: '#7FB4FF', sky: '#DCEBFF',
  gold: '#FFC93C', goldDark: '#F2A21B', goldLight: '#FFE68A',
  red: '#FF5A5F', redDark: '#D93A45', orange: '#FF8C3C',
  green: '#3DBA6F', greenDark: '#24914F', greenLight: '#8EE0A8',
  teal: '#25C9BE', purple: '#9B6BFF', pink: '#FF8FB1',
  skin: '#FFC9A3', skinDark: '#F2A983', paper: '#FFFFFF', cream: '#FFF3DC', parchment: '#F7E2B0', parchmentDark: '#E2C27A',
  gray: '#A9B4C6', grayDark: '#7D889D', grayLight: '#E6EBF3', brown: '#A86B3C',
};
const isWhite = (color?: ColorValue) => typeof color === 'string' && /^(#fff(fff)?|white|rgba?\(255,\s*255,\s*255)/i.test(color.trim());

// Com rótulo, o ícone é lido pelo leitor de tela; sem rótulo, fica escondido dele.
const a11y = (label?: string) =>
  label
    ? Platform.OS === 'web'
      ? { 'aria-label': label, role: 'img' as const }
      : { accessible: true, accessibilityLabel: label, accessibilityRole: 'image' as const }
    : { 'aria-hidden': true as const };
type Paint = (tone: string) => string;
function icon(name: string, draw: (c: Paint, d: Paint) => ReactNode): LucideIcon {
  const Icon = ({ size = 24, color, style, accessibilityLabel, testID }: IconProps) => {
    const mono = isWhite(color);
    // Silhueta: formas principais na cor pedida, detalhes um pouco mais escuros.
    const c: Paint = tone => (mono ? String(color) : tone);
    const d: Paint = tone => (mono ? 'rgba(0,0,0,0.22)' : tone);
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48" style={style} testID={testID}
        {...a11y(accessibilityLabel)} pointerEvents="none">
        {draw(c, d)}
      </Svg>
    );
  };
  Icon.displayName = name;
  return Icon;
}
// Controles: traço grosso e arredondado, sempre na cor pedida.
function glyph(name: string, path: string, width = 6): LucideIcon {
  const Icon = ({ size = 24, color = ink, style, accessibilityLabel, testID }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 48 48" style={style} testID={testID}
      {...a11y(accessibilityLabel)} pointerEvents="none">
      <Path d={path} stroke={String(color)} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
  Icon.displayName = name;
  return Icon;
}
// Selos redondos (ok, erro, alerta, info): círculo cheio com símbolo branco.
function badge(name: string, tone: string, symbol: string): LucideIcon {
  return icon(name, (c, d) => (
    <>
      <Circle cx={24} cy={24} r={20} fill={c(tone)} />
      <Path d="M10 18a16 16 0 0 1 28-6" stroke={d('rgba(255,255,255,0.35)')} strokeWidth={4} strokeLinecap="round" fill="none" />
      <Path d={symbol} stroke={d('#FFFFFF')} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ));
}

// ---- Controles ----
export const Check = glyph('Check', 'M11 25l9 9 17-19');
export const X = glyph('X', 'M14 14l20 20M34 14L14 34');
export const ArrowLeft = glyph('ArrowLeft', 'M37 24H12m11-12L11 24l12 12');
export const ArrowRight = glyph('ArrowRight', 'M11 24h25M25 12l12 12-12 12');
export const ArrowUp = glyph('ArrowUp', 'M24 37V12M12 23l12-12 12 12');
export const ArrowDown = glyph('ArrowDown', 'M24 11v25M12 25l12 12 12-12');
export const ChevronRight = glyph('ChevronRight', 'M19 12l12 12-12 12');
export const Plus = glyph('Plus', 'M24 11v26M11 24h26');
export const Minus = glyph('Minus', 'M11 24h26');
export const RefreshCw = glyph('RefreshCw', 'M37 18a14 14 0 0 0-25-3M11 30a14 14 0 0 0 25 3M12 8v8h8M36 40v-8h-8', 5);
export const RotateCcw = glyph('RotateCcw', 'M11 16a15 15 0 1 1-1 13M10 8v9h9', 5);
export const AtSign = glyph('AtSign', 'M31 24a7 7 0 1 1-7-7 7 7 0 0 1 7 7v3a5 5 0 0 0 10 0v-3a17 17 0 1 0-7 14', 5);
export const Circle_ = glyph('Circle', 'M24 7a17 17 0 1 1 0 34 17 17 0 0 1 0-34z', 4);
export { Circle_ as Circle };
export const Square = icon('Square', c => <Rect x={7} y={7} width={34} height={34} rx={9} fill="none" stroke={c(p.gray)} strokeWidth={4} />);
export const SquareCheck = icon('SquareCheck', (c, d) => (
  <>
    <Rect x={6} y={6} width={36} height={36} rx={10} fill={c(p.blue)} />
    <Path d="M14 25l7 7 13-15" stroke={d('#FFFFFF')} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </>
));

// ---- Selos ----
export const CheckCircle2 = badge('CheckCircle2', p.green, 'M15 25l6 6 12-13');
export const CircleCheck = badge('CircleCheck', p.green, 'M15 25l6 6 12-13');
export const CircleX = badge('CircleX', p.red, 'M17 17l14 14M31 17L17 31');
export const CircleAlert = badge('CircleAlert', p.orange, 'M24 14v12M24 33v.5');
export const Info = badge('Info', p.blue, 'M24 22v12M24 15v.5');
export const Ban = icon('Ban', c => (
  <>
    <Circle cx={24} cy={24} r={17} fill="none" stroke={c(p.red)} strokeWidth={6} />
    <Path d="M12 12l24 24" stroke={c(p.red)} strokeWidth={6} strokeLinecap="round" />
  </>
));

// ---- Ilustrados ----
export const House = icon('House', (c, d) => (
  <>
    <Rect x={11} y={22} width={26} height={20} rx={4} fill={c(p.cream)} />
    <Path d="M6 24L24 8l18 16" stroke={c(p.red)} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Rect x={20} y={29} width={9} height={13} rx={3} fill={d(p.blue)} />
    <Rect x={31} y={9} width={5} height={9} rx={1.5} fill={c(p.redDark)} />
  </>
));
export const BookOpen = icon('BookOpen', (c, d) => (
  <>
    <Path d="M4 12c7-2 13-1 20 3v25c-7-4-13-5-20-3z" fill={c(p.blue)} />
    <Path d="M44 12c-7-2-13-1-20 3v25c7-4 13-5 20-3z" fill={c(p.blueDark)} />
    <Path d="M7 13c6-1 11 0 16 3v21c-5-3-10-4-16-3z" fill={d(p.paper)} />
    <Path d="M41 13c-6-1-11 0-16 3v21c5-3 10-4 16-3z" fill={d(p.sky)} />
    <Path d="M11 20c3-.5 6 0 9 1.5M11 26c3-.5 6 0 9 1.5" stroke={d(p.blueLight)} strokeWidth={2.5} strokeLinecap="round" />
  </>
));
export const Trophy = icon('Trophy', (c, d) => (
  <>
    <Path d="M14 10h-6c0 8 4 12 9 12M34 10h6c0 8-4 12-9 12" stroke={c(p.goldDark)} strokeWidth={4} fill="none" strokeLinecap="round" />
    <Path d="M13 7h22v9a11 11 0 0 1-22 0z" fill={c(p.gold)} />
    <Path d="M17 9v7a7 7 0 0 0 4 6" stroke={d(p.goldLight)} strokeWidth={3} strokeLinecap="round" fill="none" />
    <Rect x={21} y={26} width={6} height={7} fill={c(p.goldDark)} />
    <Rect x={14} y={33} width={20} height={9} rx={3} fill={c(p.blue)} />
    <Rect x={19} y={36} width={10} height={3} rx={1.5} fill={d(p.goldLight)} />
  </>
));
const person = (c: Paint, d: Paint, x: number, scale: number, body: string, hair: string) => (
  <G transform={`translate(${x} 0) scale(${scale})`}>
    <Path d="M6 44a18 18 0 0 1 36 0z" fill={c(body)} />
    <Circle cx={24} cy={18} r={10} fill={d(p.skin)} />
    <Path d="M14 17a10 10 0 0 1 20 0c-3-3-7-4-10-4s-7 1-10 4z" fill={d(hair)} />
  </G>
);
export const UserRound = icon('UserRound', (c, d) => person(c, d, 0, 1, p.blue, p.brown));
export const Smile = icon('Smile', (c, d) => (
  <>
    <Circle cx={24} cy={24} r={19} fill={c(p.gold)} />
    <Circle cx={17} cy={20} r={3} fill={d(ink)} />
    <Circle cx={31} cy={20} r={3} fill={d(ink)} />
    <Path d="M15 28c5 6 13 6 18 0" stroke={d(ink)} strokeWidth={4} strokeLinecap="round" fill="none" />
  </>
));
export const UsersRound = icon('UsersRound', (c, d) => (
  <>
    {person(c, d, 18, 0.62, p.teal, '#5A3A22')}
    {person(c, d, 0, 0.92, p.blue, p.brown)}
  </>
));
export const UserPlus = icon('UserPlus', (c, d) => (
  <>
    {person(c, d, -3, 0.95, p.blue, p.brown)}
    <Circle cx={38} cy={14} r={9} fill={c(p.green)} />
    <Path d="M38 9v10M33 14h10" stroke={d('#FFFFFF')} strokeWidth={3.5} strokeLinecap="round" />
  </>
));
export const Flame = icon('Flame', (c, d) => (
  <>
    <Path d="M24 4c3 8 13 12 13 25a13 13 0 0 1-26 0c0-7 4-11 7-14 0 5 2 7 4 8 0-8-1-13 2-19z" fill={c(p.orange)} />
    <Path d="M24 22c2 5 7 7 7 13a7 7 0 0 1-14 0c0-4 3-6 4-8 1 3 2 4 3 4 0-4-1-6 0-9z" fill={d(p.gold)} />
  </>
));
export const Star = icon('Star', (c, d) => (
  <>
    <Path d="M24 4l6 12.5 13.5 2-9.8 9.5 2.3 13.5L24 35l-12 6.5 2.3-13.5L4.5 18.5l13.5-2z" fill={c(p.gold)} strokeLinejoin="round" stroke={c(p.gold)} strokeWidth={2} />
    <Path d="M24 11l3.6 7.6 5.8 1" stroke={d(p.goldLight)} strokeWidth={3} strokeLinecap="round" fill="none" />
  </>
));
export const Sparkles = icon('Sparkles', (c, d) => (
  <>
    <Path d="M20 6c1.5 8 4 10.5 12 12-8 1.5-10.5 4-12 12-1.5-8-4-10.5-12-12 8-1.5 10.5-4 12-12z" fill={c(p.gold)} />
    <Path d="M36 26c.8 4.5 2.4 6 7 7-4.6.9-6.2 2.5-7 7-.8-4.5-2.4-6.1-7-7 4.6-1 6.2-2.5 7-7z" fill={d(p.goldDark)} />
  </>
));
export const Crown = icon('Crown', (c, d) => (
  <>
    <Path d="M6 16l9 9 9-15 9 15 9-9-4 22H10z" fill={c(p.gold)} strokeLinejoin="round" stroke={c(p.gold)} strokeWidth={2} />
    <Rect x={10} y={36} width={28} height={5} rx={2} fill={c(p.goldDark)} />
    <Circle cx={24} cy={27} r={3.5} fill={d(p.red)} />
    <Circle cx={15} cy={30} r={2.5} fill={d(p.blue)} />
    <Circle cx={33} cy={30} r={2.5} fill={d(p.blue)} />
  </>
));
export const Gift = icon('Gift', (c, d) => (
  <>
    <Rect x={7} y={18} width={34} height={9} rx={3} fill={c(p.redDark)} />
    <Rect x={9} y={26} width={30} height={16} rx={3} fill={c(p.red)} />
    <Rect x={21} y={18} width={6} height={24} fill={d(p.gold)} />
    <Path d="M24 18c-3-7-12-9-12-3 0 3 6 3 12 3zM24 18c3-7 12-9 12-3 0 3-6 3-12 3z" fill={c(p.gold)} />
  </>
));
export const Bell = icon('Bell', (c, d) => (
  <>
    <Path d="M24 6a12 12 0 0 1 12 12v9l4 6H8l4-6v-9A12 12 0 0 1 24 6z" fill={c(p.gold)} />
    <Path d="M17 12a9 9 0 0 0-2 6v6" stroke={d(p.goldLight)} strokeWidth={3} strokeLinecap="round" fill="none" />
    <Circle cx={24} cy={38} r={4.5} fill={d(p.orange)} />
  </>
));
export const CalendarDays = icon('CalendarDays', (c, d) => (
  <>
    <Rect x={6} y={9} width={36} height={33} rx={6} fill={c(p.paper)} stroke={c(p.grayLight)} strokeWidth={2} />
    <Path d="M6 15a6 6 0 0 1 6-6h24a6 6 0 0 1 6 6v4H6z" fill={c(p.red)} />
    <Rect x={14} y={5} width={4} height={8} rx={2} fill={d(p.grayDark)} />
    <Rect x={30} y={5} width={4} height={8} rx={2} fill={d(p.grayDark)} />
    {[13, 21, 29].map(x => <Rect key={`a${x}`} x={x} y={25} width={6} height={5} rx={1.5} fill={d(p.blue)} />)}
    {[13, 21].map(x => <Rect key={`b${x}`} x={x} y={33} width={6} height={5} rx={1.5} fill={d(p.blueLight)} />)}
  </>
));
const envelope = (c: Paint, d: Paint) => (
  <>
    <Rect x={5} y={11} width={38} height={27} rx={5} fill={c(p.paper)} stroke={c(p.grayLight)} strokeWidth={2} />
    <Path d="M7 14l17 13 17-13" stroke={d(p.blue)} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </>
);
export const Mail = icon('Mail', envelope);
export const MailCheck = icon('MailCheck', (c, d) => (
  <>
    {envelope(c, d)}
    <Circle cx={37} cy={35} r={9} fill={c(p.green)} />
    <Path d="M33 35l3 3 5-6" stroke={d('#FFFFFF')} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </>
));
export const LockKeyhole = icon('LockKeyhole', (c, d) => (
  <>
    <Path d="M15 22v-6a9 9 0 0 1 18 0v6" stroke={c(p.gray)} strokeWidth={5} fill="none" />
    <Rect x={9} y={20} width={30} height={23} rx={6} fill={c(p.gold)} />
    <Circle cx={24} cy={29} r={3.5} fill={d(ink)} />
    <Rect x={22.5} y={30} width={3} height={7} rx={1.5} fill={d(ink)} />
  </>
));
export const Trash2 = icon('Trash2', (c, d) => (
  <>
    <Rect x={10} y={14} width={28} height={29} rx={5} fill={c(p.red)} />
    <Rect x={7} y={9} width={34} height={6} rx={3} fill={c(p.redDark)} />
    <Rect x={19} y={5} width={10} height={6} rx={2} fill={c(p.redDark)} />
    <Path d="M18 21v15M24 21v15M30 21v15" stroke={d('rgba(255,255,255,0.6)')} strokeWidth={3} strokeLinecap="round" />
  </>
));
export const Settings = icon('Settings', (c, d) => (
  <>
    <Path d="M21 4h6l1 6 4 2 5-3 4 4-3 5 2 4 6 1v6l-6 1-2 4 3 5-4 4-5-3-4 2-1 6h-6l-1-6-4-2-5 3-4-4 3-5-2-4-6-1v-6l6-1 2-4-3-5 4-4 5 3 4-2z" fill={c(p.grayDark)} strokeLinejoin="round" stroke={c(p.grayDark)} strokeWidth={1.5} />
    <Circle cx={24} cy={24} r={7} fill={d(p.paper)} />
  </>
));
export const ShieldCheck = icon('ShieldCheck', (c, d) => (
  <>
    <Path d="M24 4l17 6v12c0 11-7 18-17 22C14 40 7 33 7 22V10z" fill={c(p.blue)} />
    <Path d="M24 7v34c-8-3-14-9-14-19V12z" fill={d(p.blueLight)} opacity={0.35} />
    <Path d="M16 24l6 6 11-12" stroke={d('#FFFFFF')} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </>
));
export const Swords = icon('Swords', (c, d) => (
  <>
    <Path d="M8 6l24 24M40 6L16 30" stroke={c(p.gray)} strokeWidth={5.5} strokeLinecap="round" />
    <Path d="M28 34l6-6M20 34l-6-6" stroke={c(p.gold)} strokeWidth={5} strokeLinecap="round" />
    <Path d="M34 36l5 5M14 36l-5 5" stroke={d(p.brown)} strokeWidth={5} strokeLinecap="round" />
  </>
));
export const Camera = icon('Camera', (c, d) => (
  <>
    <Path d="M17 9h14l3 5h-20z" fill={c(p.blueDark)} />
    <Rect x={5} y={13} width={38} height={27} rx={7} fill={c(p.blue)} />
    <Circle cx={24} cy={26} r={9} fill={d(p.paper)} />
    <Circle cx={24} cy={26} r={5} fill={d(ink)} />
    <Circle cx={36} cy={19} r={2.5} fill={d(p.gold)} />
  </>
));
export const Palette = icon('Palette', (c, d) => (
  <>
    <Path d="M24 5C13 5 5 13 5 23s8 19 18 19c3 0 4-2 3-4-1-3 0-5 3-5h5c5 0 9-4 9-9C43 13 35 5 24 5z" fill={c(p.parchment)} />
    <Circle cx={15} cy={21} r={3.5} fill={d(p.red)} />
    <Circle cx={21} cy={13} r={3.5} fill={d(p.gold)} />
    <Circle cx={30} cy={13} r={3.5} fill={d(p.green)} />
    <Circle cx={36} cy={21} r={3.5} fill={d(p.blue)} />
  </>
));
export const BatteryFull = icon('BatteryFull', (c, d) => (
  <>
    <Rect x={4} y={13} width={36} height={22} rx={6} fill={c(p.grayLight)} />
    <Rect x={40} y={19} width={4} height={10} rx={2} fill={c(p.gray)} />
    <Rect x={8} y={17} width={28} height={14} rx={3} fill={d(p.green)} />
  </>
));
export const Zap = icon('Zap', c => <Path d="M27 4L9 27h13l-3 17 20-25H26z" fill={c(p.gold)} strokeLinejoin="round" stroke={c(p.gold)} strokeWidth={2} />);
export const Clock3 = icon('Clock3', (c, d) => (
  <>
    <Circle cx={24} cy={24} r={19} fill={c(p.blue)} />
    <Circle cx={24} cy={24} r={14} fill={d(p.paper)} />
    <Path d="M24 15v9h8" stroke={d(ink)} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </>
));
export const History = icon('History', (c, d) => (
  <>
    <Circle cx={25} cy={25} r={17} fill={c(p.teal)} />
    <Path d="M25 15v10l7 4" stroke={d('#FFFFFF')} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Path d="M4 12l4 10 9-5" fill={c(p.teal)} />
  </>
));
export const Flag = icon('Flag', (c, d) => (
  <>
    <Rect x={9} y={5} width={4} height={39} rx={2} fill={c(p.grayDark)} />
    <Path d="M13 7h26l-6 9 6 9H13z" fill={d(p.red)} />
  </>
));
export const Award = icon('Award', (c, d) => (
  <>
    <Path d="M15 26l-6 16 7-3 4 6 5-14zM33 26l6 16-7-3-4 6-5-14z" fill={c(p.blue)} />
    <Circle cx={24} cy={19} r={14} fill={c(p.gold)} />
    <Circle cx={24} cy={19} r={9} fill={d(p.goldDark)} />
    <Path d="M24 13l2 4 4.5.6-3.3 3 .8 4.4L24 23l-4 2 .8-4.4-3.3-3 4.5-.6z" fill={d(p.goldLight)} />
  </>
));
const target = (c: Paint, d: Paint) => (
  <>
    <Circle cx={24} cy={24} r={19} fill={c(p.red)} />
    <Circle cx={24} cy={24} r={13} fill={d(p.paper)} />
    <Circle cx={24} cy={24} r={7} fill={c(p.red)} />
  </>
);
export const Target = icon('Target', target);
export const Goal = icon('Goal', (c, d) => (
  <>
    {target(c, d)}
    <Path d="M24 24L38 8" stroke={d(p.brown)} strokeWidth={3} strokeLinecap="round" />
    <Path d="M36 6l6-1-1 6z" fill={d(p.gold)} />
  </>
));
export const Lightbulb = icon('Lightbulb', (c, d) => (
  <>
    <Path d="M24 4a14 14 0 0 1 8 25c-2 2-2 4-2 6H18c0-2 0-4-2-6A14 14 0 0 1 24 4z" fill={c(p.gold)} />
    <Path d="M17 14a8 8 0 0 1 6-5" stroke={d(p.goldLight)} strokeWidth={3} strokeLinecap="round" fill="none" />
    <Rect x={17} y={35} width={14} height={4} rx={2} fill={c(p.gray)} />
    <Rect x={19} y={40} width={10} height={4} rx={2} fill={c(p.grayDark)} />
  </>
));
export const Leaf = icon('Leaf', (c, d) => (
  <>
    <Path d="M40 6C18 6 7 17 8 38c21 1 32-10 32-32z" fill={c(p.green)} />
    <Path d="M10 38C18 28 26 20 36 12" stroke={d(p.greenDark)} strokeWidth={3} strokeLinecap="round" fill="none" />
  </>
));
export const Sprout = icon('Sprout', (c, d) => (
  <>
    <Path d="M24 44V22" stroke={c(p.greenDark)} strokeWidth={4} strokeLinecap="round" />
    <Path d="M24 24C24 13 17 7 6 7c0 11 7 17 18 17z" fill={c(p.green)} />
    <Path d="M24 28c0-9 6-14 16-14 0 9-6 14-16 14z" fill={d(p.greenLight)} />
    <Path d="M14 44h20" stroke={c(p.brown)} strokeWidth={4} strokeLinecap="round" />
  </>
));
export const Fish = icon('Fish', (c, d) => (
  <>
    <Path d="M6 24c6-10 20-13 30-4l7-7v22l-7-7C26 37 12 34 6 24z" fill={c(p.teal)} />
    <Circle cx={16} cy={22} r={2.5} fill={d(ink)} />
    <Path d="M24 18c2 4 2 8 0 12" stroke={d('rgba(255,255,255,0.6)')} strokeWidth={2.5} strokeLinecap="round" fill="none" />
  </>
));
export const Compass = icon('Compass', (c, d) => (
  <>
    <Circle cx={24} cy={24} r={19} fill={c(p.blue)} />
    <Circle cx={24} cy={24} r={15} fill={d(p.paper)} />
    <Path d="M30 15l-4 11-8 7 4-11z" fill={c(p.red)} />
    <Path d="M18 33l4-11 4 4z" fill={d(p.blue)} />
  </>
));
export const ScrollText = icon('ScrollText', (c, d) => (
  <>
    <Rect x={11} y={7} width={26} height={34} rx={3} fill={c(p.parchment)} />
    <Rect x={7} y={5} width={34} height={7} rx={3.5} fill={c(p.parchmentDark)} />
    <Rect x={7} y={37} width={34} height={7} rx={3.5} fill={c(p.parchmentDark)} />
    <Path d="M16 18h16M16 24h16M16 30h10" stroke={d(p.brown)} strokeWidth={3} strokeLinecap="round" />
  </>
));
export const Quote = icon('Quote', c => (
  <>
    <Path d="M8 24c0-8 4-13 11-15v6c-3 1-4 3-4 6h4v13H8zM27 24c0-8 4-13 11-15v6c-3 1-4 3-4 6h4v13H27z" fill={c(p.blue)} />
  </>
));
export const MessageCircle = icon('MessageCircle', (c, d) => (
  <>
    <Path d="M24 6c11 0 19 7 19 16s-8 16-19 16c-2 0-4 0-6-1l-10 5 3-9c-4-3-6-7-6-11C5 13 13 6 24 6z" fill={c(p.blue)} />
    <Circle cx={16} cy={22} r={2.5} fill={d('#FFFFFF')} />
    <Circle cx={24} cy={22} r={2.5} fill={d('#FFFFFF')} />
    <Circle cx={32} cy={22} r={2.5} fill={d('#FFFFFF')} />
  </>
));
export const Volume2 = icon('Volume2', (c, d) => (
  <>
    <Path d="M6 18h8l11-9v30l-11-9H6z" fill={c(p.blue)} />
    <Path d="M31 17a9 9 0 0 1 0 14M36 12a16 16 0 0 1 0 24" stroke={d(p.blueLight)} strokeWidth={4} strokeLinecap="round" fill="none" />
  </>
));
export const Vibrate = icon('Vibrate', (c, d) => (
  <>
    <Rect x={14} y={5} width={20} height={38} rx={5} fill={c(p.blue)} />
    <Rect x={17} y={10} width={14} height={25} rx={2} fill={d(p.sky)} />
    <Path d="M8 16l-3 4 3 4-3 4 3 4M40 16l3 4-3 4 3 4-3 4" stroke={c(p.orange)} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </>
));
export const CloudUpload = icon('CloudUpload', (c, d) => (
  <>
    <Path d="M14 38a9 9 0 0 1-1-18 12 12 0 0 1 23-2 10 10 0 0 1 0 20z" fill={c(p.sky)} />
    <Path d="M24 36V22M18 27l6-6 6 6" stroke={d(p.blue)} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </>
));
export const Infinity_ = icon('Infinity', c => (
  <Path d="M24 24c-4-5-7-8-11-8a8 8 0 0 0 0 16c4 0 7-3 11-8s7-8 11-8a8 8 0 0 1 0 16c-4 0-7-3-11-8z" stroke={c(p.blue)} strokeWidth={5.5} fill="none" strokeLinecap="round" />
));
export { Infinity_ as Infinity };
export const Accessibility = icon('Accessibility', (c, d) => (
  <>
    <Circle cx={24} cy={24} r={20} fill={c(p.blue)} />
    <Circle cx={24} cy={13} r={3.5} fill={d('#FFFFFF')} />
    <Path d="M13 19l11 3 11-3M24 22v8l-5 9M24 30l5 9" stroke={d('#FFFFFF')} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </>
));
export const Play = icon('Play', c => <Path d="M14 8c0-2 2-3 4-2l22 15c2 1 2 4 0 5L18 42c-2 1-4 0-4-2z" fill={c(p.green)} />);
export const Save = icon('Save', (c, d) => (
  <>
    <Path d="M6 10a4 4 0 0 1 4-4h24l8 8v24a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" fill={c(p.blue)} />
    <Rect x={14} y={6} width={18} height={11} rx={2} fill={d(p.sky)} />
    <Rect x={12} y={25} width={24} height={17} rx={2} fill={d(p.paper)} />
  </>
));
export const Pencil = icon('Pencil', (c, d) => (
  <>
    <Path d="M30 7l11 11-22 22-12 3 3-12z" fill={c(p.gold)} />
    <Path d="M30 7l4-4 11 11-4 4z" fill={c(p.pink)} />
    <Path d="M10 31l7 7-10 3z" fill={d(p.parchment)} />
    <Path d="M7 41l1.5-5 3.5 3.5z" fill={d(ink)} />
  </>
));
const door = (c: Paint, d: Paint, arrow: string) => (
  <>
    <Path d="M26 6h12a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H26z" fill={c(p.brown)} />
    <Circle cx={30} cy={25} r={1.8} fill={d(p.gold)} />
    <Path d={arrow} stroke={c(p.blue)} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </>
);
export const LogIn = icon('LogIn', (c, d) => door(c, d, 'M5 24h17M15 16l8 8-8 8'));
export const LogOut = icon('LogOut', (c, d) => door(c, d, 'M22 24H5M12 16l-8 8 8 8'));
export const Send = icon('Send', (c, d) => (
  <>
    <Path d="M43 5L5 21l14 6 4 15z" fill={c(p.blue)} />
    <Path d="M43 5L19 27l4 15 6-10z" fill={d(p.blueDark)} />
  </>
));
export const Copy = icon('Copy', (c, d) => (
  <>
    <Rect x={6} y={6} width={24} height={28} rx={5} fill={c(p.blueLight)} />
    <Rect x={17} y={14} width={25} height={29} rx={5} fill={c(p.blue)} />
    <Path d="M23 24h13M23 31h9" stroke={d('#FFFFFF')} strokeWidth={3} strokeLinecap="round" />
  </>
));
export const Link2 = icon('Link2', c => (
  <Path d="M20 30l-4 4a6.5 6.5 0 0 1-9-9l6-6a6.5 6.5 0 0 1 9 0M28 18l4-4a6.5 6.5 0 0 1 9 9l-6 6a6.5 6.5 0 0 1-9 0M18 30l12-12" stroke={c(p.blue)} strokeWidth={5} strokeLinecap="round" fill="none" />
));
const eye = (c: Paint, d: Paint) => (
  <>
    <Path d="M3 24c5-9 12-14 21-14s16 5 21 14c-5 9-12 14-21 14S8 33 3 24z" fill={c(p.paper)} stroke={c(p.grayLight)} strokeWidth={2} />
    <Circle cx={24} cy={24} r={8} fill={d(p.blue)} />
    <Circle cx={24} cy={24} r={3.5} fill={d(ink)} />
  </>
);
export const Eye = icon('Eye', eye);
export const EyeOff = icon('EyeOff', (c, d) => (
  <>
    {eye(c, d)}
    <Path d="M8 8l32 32" stroke={c(p.red)} strokeWidth={5} strokeLinecap="round" />
  </>
));
export const SearchX = icon('SearchX', (c, d) => (
  <>
    <Path d="M30 30l11 11" stroke={c(p.grayDark)} strokeWidth={6} strokeLinecap="round" />
    <Circle cx={20} cy={20} r={14} fill={c(p.sky)} stroke={c(p.blue)} strokeWidth={4} />
    <Path d="M15 15l10 10M25 15L15 25" stroke={d(p.red)} strokeWidth={4} strokeLinecap="round" />
  </>
));
export const GitBranch = icon('GitBranch', (c, d) => (
  <>
    <Path d="M14 10v28M14 30c0-8 20-6 20-16" stroke={c(p.gray)} strokeWidth={4} strokeLinecap="round" fill="none" />
    <Circle cx={14} cy={10} r={5} fill={d(p.blue)} />
    <Circle cx={14} cy={38} r={5} fill={d(p.blue)} />
    <Circle cx={34} cy={12} r={5} fill={d(p.green)} />
  </>
));
export const Search = icon('Search', c => (
  <>
    <Path d="M30 30l11 11" stroke={c(p.grayDark)} strokeWidth={6} strokeLinecap="round" />
    <Circle cx={20} cy={20} r={14} fill={c(p.sky)} stroke={c(p.blue)} strokeWidth={4} />
  </>
));
export const UserMinus = icon('UserMinus', (c, d) => (
  <>
    {person(c, d, -3, 0.95, p.blue, p.brown)}
    <Circle cx={38} cy={14} r={9} fill={c(p.red)} />
    <Path d="M33 14h10" stroke={d('#FFFFFF')} strokeWidth={3.5} strokeLinecap="round" />
  </>
));
// Bateria do Arca (rosa com raio), no formato 3:2 usado ao lado do contador.
export function BatteryCharge({ width = 30, testID }: { width?: number; testID?: string }) {
  return (
    <Svg width={width} height={(width * 2) / 3} viewBox="0 0 48 32" testID={testID} aria-hidden pointerEvents="none">
      <Rect x={2} y={4} width={38} height={24} rx={7} fill="#FF4F9A" />
      <Rect x={40} y={11} width={5} height={10} rx={2.5} fill="#D9367C" />
      <Rect x={6} y={8} width={30} height={16} rx={4} fill="#FF86BC" />
      <Path d="M23 9l-7 9h6l-2 6 8-10h-6z" fill="#FFFFFF" />
    </Svg>
  );
}
