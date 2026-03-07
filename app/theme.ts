import { createTheme, type MantineColorsTuple } from '@mantine/core';

const appleBlue: MantineColorsTuple = [
  '#e8f0ff',
  '#d0e2ff',
  '#a0c2ff',
  '#6ea0ff',
  '#4484ff',
  '#1d6aff',
  '#007aff',
  '#0066dd',
  '#0055bb',
  '#004499',
];

const appleOrange: MantineColorsTuple = [
  '#fff4ec',
  '#ffe8d5',
  '#ffc9a0',
  '#ffa868',
  '#ff8c38',
  '#ff7518',
  '#ff6b00',
  '#e05e00',
  '#c75300',
  '#ab4500',
];

const appleGreen: MantineColorsTuple = [
  '#e6fbed',
  '#c8f7d8',
  '#8eedb0',
  '#50e285',
  '#1fd95e',
  '#00cc4b',
  '#34c759',
  '#25a048',
  '#157d34',
  '#065c22',
];

export const theme = createTheme({
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "DM Sans", "Inter", sans-serif',
  fontFamilyMonospace: '"SF Mono", "DM Mono", "Fira Code", monospace',
  headings: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "DM Sans", "Inter", sans-serif',
    fontWeight: '700',
  },
  colors: {
    blue: appleBlue,
    orange: appleOrange,
    green: appleGreen,
  },
  primaryColor: 'orange',
  primaryShade: 6,
  defaultRadius: 'md',
  components: {
    Card: { defaultProps: { radius: 'xl' } },
    Button: { defaultProps: { radius: 'xl' } },
    TextInput: { defaultProps: { radius: 'xl' } },
    Badge: { defaultProps: { radius: 'xl' } },
    ActionIcon: { defaultProps: { radius: 'xl' } },
    NavLink: { defaultProps: { radius: 'md' } },
  },
});
