import { Application } from 'express';
declare const __brand: unique symbol;
type Brand<B> = {
    [__brand]: B;
};
export type Branded<T, B> = T & Brand<B>;
export type SafeFilePath = Branded<string, 'SafeFilePath'>;
export type ClaudeConfigData = Branded<object, 'ClaudeConfigData'>;
export declare function addClaudeConfigAPI(app: Application): void;
export default addClaudeConfigAPI;
//# sourceMappingURL=claude-config-api.d.ts.map