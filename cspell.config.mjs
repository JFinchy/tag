export default {
    allowCompoundWords: true,
    dictionaries: ['typescript', 'node', 'npm', 'miscellaneous', 'abbreviations'],
    dictionaryDefinitions: [
        {
            name: 'abbreviations',
            path: './.cspell/abbreviations.txt',
        },
        {
            name: 'miscellaneous',
            path: './.cspell/miscellaneous.txt',
        },
        {
            name: 'react',
            words: ['React', 'ReactDOM', 'ReactRouter', 'ReactRouterDOM', 'ReactRouterDOM', 'ReactRouterDOM'],
        },
    ],
    language: 'en',
}