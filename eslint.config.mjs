import js from '@eslint/js';
import typescript from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';

export default [
    {
        ignores: ['node_modules', '.next', 'out', 'dist', 'build', '.eslintrc*'],
    },
    js.configs.recommended,
    ...typescript.configs.recommended,
    {
        files: ['**/*.{js,jsx,ts,tsx}'],
        plugins: {
            '@next/next': nextPlugin,
        },
        rules: {
            ...nextPlugin.configs.recommended.rules,
            'react/react-in-jsx-scope': 'off',
        },
    },
    {
        files: ['**/*.cjs'],
        languageOptions: {
            sourceType: 'commonjs',
        },
    },
];
