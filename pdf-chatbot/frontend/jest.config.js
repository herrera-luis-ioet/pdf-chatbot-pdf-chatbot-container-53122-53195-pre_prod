module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^axios$': '<rootDir>/src/__mocks__/axios.js',
    '^socket.io-client$': '<rootDir>/src/__mocks__/socket.io-client.js',
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.(js|jsx|mjs)$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!axios|@babel/runtime|socket.io-client|@babel/runtime-corejs3|engine.io-client|engine.io-parser)/'
  ],
  setupFilesAfterEnv: [
    '@testing-library/jest-dom/extend-expect',
    '<rootDir>/src/setupTests.js'
  ],
  testPathIgnorePatterns: ['/node_modules/'],
  moduleDirectories: ['node_modules', 'src'],
  verbose: true,
  testTimeout: 10000,
  globals: {
    'ts-jest': {
      useESM: true
    },
    NODE_ENV: 'test'
  },
  moduleFileExtensions: ['js', 'jsx', 'json', 'node'],
  testEnvironmentOptions: {
    url: 'http://localhost'
  }
};
