const react = require('eslint-plugin-react');

const globals = {
    browser: true,
    es2021: true,
    node: true
};

const js = {
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        globals,
        parserOptions: {
            ecmaFeatures: {
                jsx: true
            }
        }
    },
    plugins: {
        react
    },
    rules: {
        'react/react-in-jsx-scope': 'off',
        'react/prop-types': 'off'
    }
};

module.exports = [js];