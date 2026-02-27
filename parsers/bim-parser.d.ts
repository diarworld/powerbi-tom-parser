import { TabularModel, ParseOptions } from '../types/index.js';
/**
 * Parse a Power BI .bim JSON file and extract tabular model metadata
 */
export declare function parseBimFile(filePath: string, options?: ParseOptions): Promise<TabularModel>;
/**
 * Parse a BIM JSON object and extract tabular model metadata
 */
export declare function parseBimJson(json: any, options?: ParseOptions): TabularModel;
//# sourceMappingURL=bim-parser.d.ts.map