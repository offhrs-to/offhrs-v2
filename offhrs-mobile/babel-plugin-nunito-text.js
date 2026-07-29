/**
 * Rewrites `Text` / `TextInput` imports from `react-native` to `@/components/AppText`
 * so Nunito Sans applies app-wide without a Metro Proxy (Expo Go + Fast Refresh safe).
 *
 * Only transforms our app source — never node_modules (Expo internals can't resolve `@/`).
 */
module.exports = function nunitoTextImportRewrite({ types: t }) {
  const APP_TEXT = '@/components/AppText';
  const TARGETS = new Set(['Text', 'TextInput']);

  function isAppSource(filename) {
    if (!filename) return false;
    const normalized = String(filename).replace(/\\/g, '/');
    if (normalized.includes('/node_modules/')) return false;
    // AppText must keep the real RN Text / TextInput.
    if (normalized.includes('/components/AppText.')) return false;
    return (
      normalized.includes('/app/') ||
      normalized.includes('/components/') ||
      normalized.includes('/contexts/') ||
      normalized.includes('/hooks/') ||
      normalized.includes('/constants/')
    );
  }

  return {
    name: 'nunito-text-import-rewrite',
    visitor: {
      ImportDeclaration(path, state) {
        if (path.node.source.value !== 'react-native') return;
        const filename = state.filename ?? state.file?.opts?.filename ?? '';
        if (!isAppSource(filename)) return;

        const textSpecs = [];
        const otherSpecs = [];

        for (const spec of path.node.specifiers) {
          if (
            t.isImportSpecifier(spec) &&
            t.isIdentifier(spec.imported) &&
            TARGETS.has(spec.imported.name)
          ) {
            textSpecs.push(spec);
          } else {
            otherSpecs.push(spec);
          }
        }

        if (textSpecs.length === 0) return;

        path.insertAfter(t.importDeclaration(textSpecs, t.stringLiteral(APP_TEXT)));

        if (otherSpecs.length === 0) {
          path.remove();
        } else {
          path.node.specifiers = otherSpecs;
        }
      },
    },
  };
};
