export const theme = {
  text: {
    primary: 'white',
    secondary: 'gray',
    accent: 'cyan',
    response: 'white',
    link: 'cyan',
  },
  status: {
    success: 'green',
    warning: 'yellow',
    error: 'red',
  },
  border: {
    default: 'gray',
  },
  code: {
    keyword: 'magenta',
    string: 'green',
    number: 'yellow',
    comment: 'gray',
    function: 'cyan',
    variable: 'blue',
    operator: 'red',
    punctuation: 'white',
    class: 'yellow',
    builtin: 'cyan',
    property: 'blue',
    default: 'white',
  },
} as const;

export type Theme = typeof theme;
