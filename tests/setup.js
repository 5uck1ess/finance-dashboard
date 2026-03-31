// Jest setup file
// This runs before each test file

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock fetch globally
global.fetch = jest.fn();

// Mock window.location
delete window.location;
window.location = {
  pathname: '/index.html',
  href: 'http://localhost/index.html',
  assign: jest.fn(),
  reload: jest.fn(),
};

// Mock document methods
const createMockElement = (tag) => {
  const element = {
    tagName: tag.toUpperCase(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      toggle: jest.fn(),
      contains: jest.fn(() => false),
    },
    style: {},
    textContent: '',
    innerHTML: '',
    dataset: {},
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    appendChild: jest.fn(),
    insertBefore: jest.fn(),
    remove: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    getBoundingClientRect: jest.fn(() => ({
      top: 0,
      left: 0,
      width: 100,
      height: 100,
    })),
    closest: jest.fn(),
    insertAdjacentHTML: jest.fn(),
    click: jest.fn(),
  };
  return element;
};

document.getElementById = jest.fn();
document.querySelector = jest.fn();
document.querySelectorAll = jest.fn(() => []);
document.createElement = jest.fn(createMockElement);

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL = {
  createObjectURL: jest.fn(() => 'blob:mock-url'),
  revokeObjectURL: jest.fn(),
};

// Mock navigator.clipboard
global.navigator = {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(),
  },
};

// Reset mocks before each test
beforeEach(() => {
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
  global.fetch.mockClear();
  document.getElementById.mockClear();
  document.querySelector.mockClear();
  document.querySelectorAll.mockClear();
  document.createElement.mockClear();
  jest.clearAllTimers();
});


