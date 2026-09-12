import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
export const load = (path: string, stubs: Record<string, unknown>) => {
  const filename = resolve(path); const localRequire = createRequire(filename); const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, { exports, atob, URL, Error, __DEV__: true, process: { env: { EXPO_PUBLIC_POSTHOG_API_KEY: 'test', EXPO_PUBLIC_POSTHOG_HOST: 'https://example.test' } }, require: (name: string) => name in stubs ? stubs[name] : localRequire(name) });
  return exports as any;
};
export const hooks = () => {
  const states: any[] = []; let cursor = 0;
  const deps: any[][] = []; const cleanups: any[] = []; let effects: any[] = [];
  const changed = (i: number, next: any[]) => !deps[i] || next.some((x, j) => x !== deps[i][j]);
  const react = {
    createContext: () => ({ Provider: 'Provider' }), useContext: () => null,
    useState(initial: any) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], (v: any) => { states[i] = typeof v === 'function' ? v(states[i]) : v; }]; },
    useRef(initial: any) { const i = cursor++; if (!(i in states)) states[i] = { current: initial }; return states[i]; },
    useMemo(fn: any, next: any[]) { const i = cursor++; if (changed(i,next)) { states[i] = fn(); deps[i] = next; } return states[i]; },
    useCallback(fn: any, next: any[]) { return react.useMemo(() => fn, next); },
    useEffect(fn: any, next: any[]) { const i = cursor++; if (changed(i,next)) { deps[i] = next; effects.push(() => { cleanups[i]?.(); cleanups[i] = fn(); }); } }
  };
  return { react, render(fn: () => any) { cursor = 0; const result = fn(); const tasks = effects; effects = []; tasks.forEach(fn => fn()); return result; }, unmount() { cleanups.forEach(fn => fn?.()); } };
};
export const flatten = (node: any): any[] => node == null || typeof node === 'boolean' ? [] : Array.isArray(node) ? node.flatMap(flatten) : [node, ...flatten(node.props?.children)];
export const tick = () => new Promise(resolve => setImmediate(resolve));
export const theme = { colors: {}, spacing: {}, typography: { body: {} } };
export const rn = { View: 'View', Text: 'Text', FlatList: 'FlatList', KeyboardAvoidingView: 'KeyboardAvoidingView', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator', Platform: { OS: 'android' }, StyleSheet: { create: (value: any) => value } };
