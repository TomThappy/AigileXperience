# CodeRabbit Review Checklist für AigileXperience

## 🎯 Spezielle Focus-Bereiche für aktuelle Fixes

### 🔄 Infinite Loop Prevention
- **history.replaceState() Aufrufe:** Max 5 pro 10 Sekunden
- **useEffect Dependencies:** Vollständig und korrekt
- **State Update Cascades:** Keine zirkulären Updates
- **SSE Reconnection Loops:** Proper cleanup und backoff
- **React Re-render Loops:** memo, useCallback, useMemo korrekt verwendet

### 🛡️ Browser API Overrides
```javascript
// ✅ Gut: Throttled Override mit Safety Checks
window.history.replaceState = function(...args) {
  if (replaceCount > THRESHOLD) {
    console.warn('[BLOCKED] Excessive calls');
    return;
  }
  return originalReplaceState.apply(this, args);
};

// ❌ Schlecht: Direkte API Calls ohne Schutz
router.replace(url); // Kann zu Loops führen
```

### ⚡ Performance Patterns  
- **React.memo:** Für teure Komponenten verwenden
- **State Updates:** Nur bei echten Änderungen
- **localStorage Throttling:** Max 1 Schreibvorgang/Sekunde
- **Progress Updates:** Nur bei >5% Änderung

### 🔗 SSE Connection Management
```typescript
// ✅ Gut: Proper Cleanup
useEffect(() => {
  const cleanup = startSSE(url, handlers);
  return cleanup; // Wichtig!
}, [jobId]); // Stable dependencies

// ❌ Schlecht: Listener Recreation
useEffect(() => {
  startSSE(url, {
    onProgress: (data) => setState(data) // Neue Funktion bei jedem Render!
  });
}, [setState]); // setState ändert sich konstant
```

## 📋 CodeRabbit Commands für Reviewer

### Standard Review
```
@coderabbit review: focus=performance,security,maintainability
```

### Performance-Critical Changes
```
@coderabbit focus=performance,memory
Pay special attention to:
- Infinite loops and excessive API calls
- React re-render prevention
- Memory leak patterns
- Browser API usage safety
```

### Security Review  
```
@coderabbit focus=security,validation
Check for:
- API endpoint exposure
- Environment variable leaks  
- Input validation
- Authentication bypasses
```

## 🎯 Spezifische Checks für dieses Projekt

### Frontend Pages (apps/frontend/**/page.tsx)
- [ ] Keine direkten router.replace() Calls
- [ ] useEffect cleanup implementiert
- [ ] State updates nur bei Änderungen
- [ ] Progressive rendering ohne empty states

### SSE Hooks (src/lib/useSSE.ts)
- [ ] Stable listener references mit useRef
- [ ] Proper reconnection backoff
- [ ] Connection cleanup auf unmount
- [ ] Error boundary handling

### Backend Routes (apps/backend/src/routes/*)
- [ ] Rate limiting implementiert
- [ ] Error handling vollständig
- [ ] Async/await korrekt verwendet
- [ ] Environment variables geschützt

## 🚨 Kritische Issues - Sofortiger Fix nötig

### Severity: CRITICAL 🔴
- SecurityError durch excessive API calls
- Memory leaks in SSE connections
- Infinite loops in useEffect
- Type errors/compilation failures

### Severity: HIGH 🟡  
- Performance regressions
- Missing error boundaries
- Unhandled promise rejections
- Breaking API changes

### Severity: MEDIUM 🔵
- Code duplication
- Missing type definitions
- Suboptimal performance patterns
- Documentation gaps

### Severity: LOW ⚪
- Style inconsistencies
- Minor optimizations  
- Naming improvements
- Non-critical warnings

## 📝 Review Template für Pull Requests

```markdown
## CodeRabbit Review Ergebnis

### ✅ Approved Changes
- [x] Infinite loop protection implementiert
- [x] Browser API override sicher
- [x] State update guards funktional
- [x] SSE cleanup korrekt

### ⚠️ Findings to Address
- [ ] **CRITICAL:** [Beschreibung + Zeile]
- [ ] **HIGH:** [Beschreibung + Zeile]  
- [ ] **MEDIUM:** [Beschreibung + Zeile]

### 💡 Suggestions for Future
- Performance optimization in [File]
- Consider using [Pattern] for [Use Case]
- Documentation needed for [Component]

### 🎯 CodeRabbit Score: X/10
**Recommendation:** ✅ APPROVE / ⏸️ REQUEST CHANGES / ❌ REJECT
```

## 🔧 Lokale Tools für Pre-Review

```bash
# TypeScript Check
npm run type-check

# Linting
npm run lint --fix

# Test Suite  
npm test

# Build Check
npm run build

# Performance Analysis
npm run analyze # Falls vorhanden
```

## 🎓 Best Practices für CodeRabbit Interaction

### Effektive Commands
- `@coderabbit explain` - Erklärt komplexe Code-Abschnitte
- `@coderabbit suggest` - Schlägt Verbesserungen vor
- `@coderabbit security` - Fokus auf Security-Issues
- `@coderabbit performance` - Performance-Analyse

### Response to CodeRabbit
- **Accept:** `@coderabbit resolve` + Commit mit Fix
- **Disagree:** `@coderabbit ignore` + Begründung warum
- **Need Help:** `@coderabbit explain` für Details
- **Partial Fix:** Kommentar mit geplanten nächsten Schritten
