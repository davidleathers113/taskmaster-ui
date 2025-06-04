# IDE Configuration for ESLint Flat Config

This document provides configuration instructions for various IDEs to work optimally with TaskMaster's ESLint flat config setup.

## Visual Studio Code

### Requirements
- ESLint extension v3.0.5 or higher
- Node.js 18+ for ESLint flat config support

### Configuration
The project includes a comprehensive `.vscode/settings.json` file with 2025 best practices:

**Key Settings:**
```json
{
  "eslint.useFlatConfig": true,
  "eslint.enable": true,
  "eslint.format.enable": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

### Recommended Extensions
Install recommended extensions via the Extensions panel or run:
```bash
code --install-extension dbaeumer.vscode-eslint
```

### Troubleshooting
1. **ESLint not working**: Ensure you have ESLint extension v3.0.5+
2. **Config not found**: Restart VSCode after changing `eslint.useFlatConfig`
3. **Performance issues**: Check that `node_modules` is excluded in workspace settings

## WebStorm / IntelliJ IDEA

### Requirements
- WebStorm 2023.3+ or IntelliJ IDEA 2023.3+
- ESLint 9.0+ with flat config support

### Configuration

#### Automatic Setup (Recommended)
1. Open **Settings** (`Ctrl+Alt+S` / `Cmd+,`)
2. Navigate to **Languages & Frameworks → JavaScript → Code Quality Tools → ESLint**
3. Select **"Automatic ESLint configuration"**
4. WebStorm will automatically detect `eslint.config.js`

#### Manual Setup
1. Open **Settings** (`Ctrl+Alt+S` / `Cmd+,`)
2. Navigate to **Languages & Frameworks → JavaScript → Code Quality Tools → ESLint**
3. Select **"Manual ESLint configuration"**
4. Set **ESLint package** to `./node_modules/eslint`
5. Set **Configuration file** to `./eslint.config.js`

#### TypeScript Configuration Support
For TypeScript config files (`eslint.config.ts`):
1. In **Extra eslint options** field, add: `--flag unstable_ts_config`
2. Ensure TypeScript service is enabled

### Code Style Integration
1. Right-click on `eslint.config.js` in Project panel
2. Select **"Apply ESLint Code Style Rules"**
3. This imports ESLint rules into WebStorm's code style settings

### File Watching
WebStorm automatically watches config files for changes. To manually refresh:
1. **File → Invalidate Caches and Restart**

## Other IDEs

### Neovim
```lua
-- Using nvim-lspconfig with eslint-lsp
require('lspconfig').eslint.setup({
  settings = {
    experimental = {
      useFlatConfig = true
    }
  }
})
```

### Emacs
```elisp
;; Using flycheck-eslint
(setq flycheck-javascript-eslint-executable "npx eslint")
(add-to-list 'flycheck-checkers 'javascript-eslint)
```

### Vim/Neovim (ALE)
```vim
let g:ale_javascript_eslint_use_global = 0
let g:ale_javascript_eslint_executable = 'npx eslint'
```

## General Configuration Notes

### Config File Detection
All modern IDEs should automatically detect `eslint.config.js` in the project root.

### Performance Optimization
1. Exclude large directories (`node_modules`, `dist`, `out`) from file watching
2. Enable ESLint only for relevant file types
3. Use project-local ESLint installation

### Common Issues

#### "Config file not found"
- Ensure `eslint.config.js` exists in project root
- Check that ESLint version is 9.0+
- Restart IDE after configuration changes

#### "Rules not applied correctly"
- Verify flat config syntax in `eslint.config.js`
- Use ESLint config inspector: `npx eslint --inspect-config`
- Check IDE console for ESLint error messages

#### "Performance issues"
- Enable flat config mode in IDE settings
- Exclude `node_modules` from linting
- Consider disabling real-time linting for large files

### ESLint Config Inspector

Debug configuration issues using ESLint's built-in inspector:

```bash
# Launch config inspector
npx eslint --inspect-config

# Debug specific file
npx eslint --print-config src/main/index.ts
```

### Migration from Legacy ESLint

If upgrading from `.eslintrc.*` format:
1. Remove old config files (`.eslintrc.js`, `.eslintrc.json`, etc.)
2. Update IDE settings to use flat config
3. Test configuration with sample files
4. Update CI/CD scripts if needed

## Team Onboarding

### Quick Setup Checklist
- [ ] Install recommended IDE extensions
- [ ] Verify ESLint extension version (v3.0.5+ for VSCode)
- [ ] Enable flat config in IDE settings
- [ ] Test linting works on sample files
- [ ] Configure auto-fix on save
- [ ] Verify TypeScript integration

### Verification Steps
1. Open a `.ts` or `.tsx` file
2. Introduce a linting error (e.g., `var unused = 1;`)
3. Verify error appears in IDE
4. Save file and confirm auto-fix works
5. Check that TypeScript integration is working

For questions or issues, refer to the main project documentation or create an issue in the repository.