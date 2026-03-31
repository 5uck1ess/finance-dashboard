const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT, 'css', 'tailwind.generated.css');
const SOURCE_FILES = [
    path.join(ROOT, 'index.html'),
    path.join(ROOT, 'manage.html'),
    path.join(ROOT, 'js', 'app.js'),
    path.join(ROOT, 'js', 'manage.js'),
    path.join(ROOT, 'js', 'ui', 'ui-manager.js')
];

const SAFELISTED_CLASSES = [
    'bg-green-100',
    'text-green-800',
    'dark:bg-green-900/30',
    'dark:text-green-300',
    'bg-red-100',
    'text-red-800',
    'dark:bg-red-900/30',
    'dark:text-red-300',
    'bg-yellow-100',
    'text-yellow-800',
    'dark:bg-yellow-900/30',
    'dark:text-yellow-300',
    'bg-green-400',
    'bg-green-500',
    'bg-red-400',
    'bg-red-500',
    'bg-yellow-400'
];

function extractClasses(content) {
    const tokens = new Set();
    const patterns = [
        /class(?:Name)?\s*=\s*["'`]([\s\S]*?)["'`]/g,
        /\.className\s*=\s*["'`]([\s\S]*?)["'`]/g,
        /classList\.(?:add|remove|toggle)\(([\s\S]*?)\)/g
    ];

    const addTokens = (raw) => {
        raw.replace(/\$\{[\s\S]*?\}/g, ' ')
            .split(/[\s,]+/)
            .map((token) => token.trim().replace(/^['"`]+|['"`]+$/g, ''))
            .filter(Boolean)
            .forEach((token) => {
                if (/^[A-Za-z0-9!:/.[\]_%(),#-]+$/.test(token)) {
                    tokens.add(token);
                }
            });
    };

    patterns.forEach((pattern) => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            addTokens(match[1]);
        }
    });

    return tokens;
}

function extractUtilityLikeTokens(content) {
    const tokens = new Set();
    const stringMatches = content.match(/['"`]([\s\S]*?)['"`]/g) || [];

    stringMatches.forEach((match) => {
        const raw = match.slice(1, -1);
        raw.replace(/\$\{[\s\S]*?\}/g, ' ')
            .split(/\s+/)
            .map((token) => token.trim().replace(/^[`"'({[>,]+|[`"'})\],;]+$/g, ''))
            .filter(Boolean)
            .forEach((token) => {
                if (!/^[A-Za-z0-9!:/.[\]_%(),#-]+$/.test(token)) return;
                if (token.includes('-') || token.includes(':') || token.includes('/')) {
                    tokens.add(token);
                }
            });
    });

    return tokens;
}

function convertDarkMediaToClassSelectors(css) {
    const darkMediaPrefix = '@media (prefers-color-scheme: dark){';
    const darkMediaIndex = css.indexOf(darkMediaPrefix);
    if (darkMediaIndex === -1) {
        return css;
    }

    const darkBlockStart = darkMediaIndex + darkMediaPrefix.length;
    const darkBlockBody = css.slice(darkBlockStart, -1);
    const convertedBlock = darkBlockBody.replace(/(^|})([^@{}][^{]+)\{/g, (match, boundary, selectorGroup) => {
        const selectors = selectorGroup
            .split(',')
            .map((selector) => selector.trim())
            .filter(Boolean)
            .map((selector) => `.dark ${selector}`)
            .join(',');

        return `${boundary}${selectors}{`;
    });

    return `${css.slice(0, darkMediaIndex)}${convertedBlock}`;
}

async function buildTailwindCss() {
    const classes = new Set();

    SOURCE_FILES.forEach((file) => {
        const content = fs.readFileSync(file, 'utf8');
        extractClasses(content).forEach((token) => classes.add(token));
        extractUtilityLikeTokens(content).forEach((token) => classes.add(token));
    });

    SAFELISTED_CLASSES.forEach((token) => classes.add(token));

    const html = `<!doctype html><html class="light"><head></head><body>${
        Array.from(classes).map((token) => `<div class="${token}"></div>`).join('\n')
    }</body></html>`;

    const dom = new JSDOM(html, {
        runScripts: 'dangerously',
        resources: 'usable',
        pretendToBeVisual: true
    });

    const { window } = dom;
    window.console.warn = () => {};
    window.eval(fs.readFileSync(path.join(ROOT, 'js', 'tailwind-config.js'), 'utf8'));
    window.eval(fs.readFileSync(path.join(ROOT, 'js', 'tailwindcss.js'), 'utf8'));
    window.document.documentElement.classList.add('tailwind-build-trigger');

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const css = Array.from(window.document.querySelectorAll('style'))
        .map((style) => style.textContent || '')
        .join('\n')
        .trim();

    if (!css) {
        throw new Error('Tailwind build produced no CSS output');
    }

    fs.writeFileSync(OUTPUT_FILE, `${convertDarkMediaToClassSelectors(css)}\n`, 'utf8');
    console.log(`Wrote ${path.relative(ROOT, OUTPUT_FILE)}`);
}

buildTailwindCss().catch((error) => {
    console.error(error);
    process.exit(1);
});
