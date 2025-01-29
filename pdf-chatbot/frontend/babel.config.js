module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: 'current',
        browsers: ['>0.2%', 'not dead', 'not op_mini all']
      },
      modules: 'auto',
      useBuiltIns: 'usage',
      corejs: 3
    }],
    ['@babel/preset-react', {
      runtime: 'automatic'
    }]
  ],
  plugins: [
    '@babel/plugin-syntax-dynamic-import',
    ['@babel/plugin-transform-runtime', {
      regenerator: true,
      helpers: true,
      useESModules: true
    }],
    '@babel/plugin-proposal-private-property-in-object'
  ],
  env: {
    test: {
      presets: [
        ['@babel/preset-env', {
          targets: { node: 'current' },
          modules: 'auto',
          useBuiltIns: 'usage',
          corejs: 3
        }]
      ],
      plugins: [
        '@babel/plugin-syntax-dynamic-import',
        ['@babel/plugin-transform-modules-commonjs', {
          strictMode: true,
          allowTopLevelThis: true,
          loose: true
        }],
        ['@babel/plugin-transform-runtime', {
          regenerator: true,
          helpers: true,
          useESModules: false
        }]
      ]
    }
  }
};
