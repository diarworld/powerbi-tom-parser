import * as fs from 'fs/promises';
import { DataType, PartitionSourceType, DataView, RelationshipCardinality, CrossFilteringBehavior, TomParserError } from '../types/index.js';
/**
 * Detect encoding and decode buffer to string
 * Power BI .bim files are often UTF-16 LE encoded
 */
function detectAndDecodeBom(buffer) {
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        return buffer.toString('utf-8').slice(1);
    }
    if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
        return buffer.toString('utf16le').slice(1);
    }
    if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
        return buffer.swap16().toString('utf16le').slice(1);
    }
    if (buffer.length >= 4 && buffer[1] === 0x00 && buffer[3] === 0x00) {
        const hasZeroAtEven = buffer[0] !== 0x00;
        if (hasZeroAtEven || (buffer.length > 10 && buffer[2] === 0x00 && buffer[4] === 0x00)) {
            return buffer.toString('utf16le');
        }
    }
    return buffer.toString('utf-8');
}
/**
 * Parse a Power BI .bim JSON file and extract tabular model metadata
 */
export async function parseBimFile(filePath, options) {
    try {
        const buffer = await fs.readFile(filePath);
        const content = detectAndDecodeBom(buffer);
        const json = JSON.parse(content);
        return parseBimJson(json, options);
    }
    catch (error) {
        if (error instanceof TomParserError) {
            throw error;
        }
        if (error.code === 'ENOENT') {
            throw new TomParserError(TomParserError.FILE_NOT_FOUND, `BIM file not found: ${filePath}`, error);
        }
        if (error instanceof SyntaxError) {
            throw new TomParserError(TomParserError.INVALID_JSON, `Invalid JSON in BIM file: ${error.message}`, error);
        }
        throw new TomParserError('UNKNOWN', `Error parsing BIM file: ${error.message}`, error);
    }
}
/**
 * Parse a BIM JSON object and extract tabular model metadata
 */
export function parseBimJson(json, options) {
    const includeAnnotations = options?.includeAnnotations ?? true;
    const includeHidden = options?.includeHiddenObjects ?? true;
    if (!json.model) {
        throw new TomParserError(TomParserError.MISSING_REQUIRED_FIELD, 'BIM JSON is missing required "model" property');
    }
    const model = parseDataModelSchema(json.model, includeAnnotations);
    const tables = parseTables(json.model.tables ?? [], includeHidden);
    const relationships = parseRelationships(json.model.relationships ?? [], tables);
    return {
        model,
        tables,
        relationships
    };
}
function parseDataModelSchema(modelJson, includeAnnotations) {
    const schema = {
        name: modelJson.name ?? 'Model',
        compatibilityLevel: modelJson.compatibilityLevel ?? 0,
        cultures: [],
        annotations: []
    };
    if (modelJson.cultures && Array.isArray(modelJson.cultures)) {
        schema.cultures = modelJson.cultures.map((c) => ({
            name: c.name,
            annotations: includeAnnotations ? parseAnnotations(c.annotations) : undefined
        }));
    }
    if (modelJson.annotations && includeAnnotations) {
        schema.annotations = parseAnnotations(modelJson.annotations);
    }
    return schema;
}
function parseTables(tablesJson, includeHidden) {
    if (!Array.isArray(tablesJson)) {
        return [];
    }
    return tablesJson
        .filter((t) => !t.isHidden || includeHidden)
        .map((tableJson) => parseTable(tableJson, includeHidden));
}
function parseTable(tableJson, includeHidden) {
    return {
        name: tableJson.name ?? 'Table',
        description: tableJson.description,
        isHidden: tableJson.isHidden,
        columns: parseColumns(tableJson.columns ?? [], includeHidden),
        partitions: parsePartitions(tableJson.partitions ?? []),
        measures: parseMeasures(tableJson.measures ?? [], includeHidden)
    };
}
function parseColumns(columnsJson, includeHidden) {
    if (!Array.isArray(columnsJson)) {
        return [];
    }
    return columnsJson
        .filter((c) => !c.isHidden || includeHidden)
        .map((colJson) => parseColumn(colJson));
}
function parseColumn(colJson) {
    const column = {
        name: colJson.name ?? 'Column',
        dataType: mapDataType(colJson.dataType),
        isHidden: colJson.isHidden,
        description: colJson.description
    };
    if (colJson.expression) {
        column.expression = colJson.expression;
    }
    else if (colJson.calculatedColumn?.expression) {
        column.expression = colJson.calculatedColumn.expression;
    }
    if (colJson.formatString) {
        column.formatString = colJson.formatString;
    }
    if (colJson.summarizeBy) {
        column.summarization = colJson.summarizeBy;
    }
    return column;
}
function parsePartitions(partitionsJson) {
    if (!Array.isArray(partitionsJson)) {
        return [];
    }
    return partitionsJson.map((p) => parsePartition(p));
}
function parsePartition(partitionJson) {
    const partition = {
        name: partitionJson.name ?? 'Partition',
        sourceType: mapPartitionSourceType(partitionJson.source),
        description: partitionJson.description
    };
    if (partitionJson.source) {
        if (partitionJson.source.expression) {
            partition.expression = partitionJson.source.expression;
        }
        if (partitionJson.source.query) {
            partition.query = partitionJson.source.query;
        }
        if (partitionJson.source.dataView) {
            partition.dataView = partitionJson.source.dataView === 'Sample' ? DataView.Sample : DataView.Full;
        }
    }
    return partition;
}
function parseMeasures(measuresJson, includeHidden) {
    if (!Array.isArray(measuresJson)) {
        return [];
    }
    return measuresJson
        .filter((m) => !m.isHidden || includeHidden)
        .map((m) => parseMeasure(m));
}
function parseMeasure(measureJson) {
    return {
        name: measureJson.name ?? 'Measure',
        expression: measureJson.expression ?? '',
        formatString: measureJson.formatString,
        displayFolder: measureJson.displayFolder,
        isHidden: measureJson.isHidden,
        description: measureJson.description
    };
}
function parseRelationships(relationshipsJson, tables) {
    if (!Array.isArray(relationshipsJson)) {
        return [];
    }
    const tableMap = new Map(tables.map(t => [t.name.toLowerCase(), t]));
    return relationshipsJson.map((relJson) => parseRelationship(relJson, tableMap));
}
function parseRelationship(relJson, tableMap) {
    const fromTableName = relJson.fromTable ?? '';
    const toTableName = relJson.toTable ?? '';
    const fromTable = tableMap.get(fromTableName.toLowerCase());
    const toTable = tableMap.get(toTableName.toLowerCase());
    const relationship = {
        name: relJson.name,
        fromTable: fromTableName,
        toTable: toTableName,
        fromColumn: relJson.fromColumn ?? '',
        toColumn: relJson.toColumn ?? '',
        cardinality: mapCardinality(relJson.crossFilterDirection, relJson.fromCardinality, relJson.toCardinality),
        crossFilteringBehavior: mapCrossFilteringBehavior(relJson.crossFilterDirection),
        isActive: relJson.isActive ?? true,
        isReferentialIntegrityEnforced: relJson.isReferentialIntegrityEnforced
    };
    return relationship;
}
function parseAnnotations(annotationsJson) {
    if (!Array.isArray(annotationsJson)) {
        return [];
    }
    return annotationsJson.map((a) => ({
        name: a.name ?? '',
        value: a.value ?? ''
    }));
}
function mapDataType(dataType) {
    if (!dataType) {
        return DataType.Unknown;
    }
    const typeMap = {
        'Int64': DataType.Int64,
        'Int32': DataType.Int64,
        'Double': DataType.Double,
        'Single': DataType.Double,
        'Boolean': DataType.Boolean,
        'String': DataType.String,
        'DateTime': DataType.DateTime,
        'DateTimeOffset': DataType.DateTime,
        'Decimal': DataType.Decimal,
        'Binary': DataType.Binary,
        'Table': DataType.Table,
        'Variant': DataType.Variant
    };
    return typeMap[dataType] ?? DataType.Unknown;
}
function mapPartitionSourceType(source) {
    if (!source) {
        return PartitionSourceType.None;
    }
    if (source.type === 'm') {
        return PartitionSourceType.M;
    }
    if (source.expression) {
        return PartitionSourceType.Calculated;
    }
    if (source.query) {
        return PartitionSourceType.Query;
    }
    return PartitionSourceType.None;
}
function mapCardinality(crossFilterDirection, fromCard, toCard) {
    if (fromCard === '1' && toCard === '1') {
        return RelationshipCardinality.OneToOne;
    }
    if (fromCard === '1' && toCard === '*') {
        return RelationshipCardinality.OneToMany;
    }
    if (fromCard === '*' && toCard === '1') {
        return RelationshipCardinality.ManyToOne;
    }
    return RelationshipCardinality.OneToMany;
}
function mapCrossFilteringBehavior(crossFilterDirection) {
    if (crossFilterDirection === 'Both') {
        return CrossFilteringBehavior.BothDirections;
    }
    if (crossFilterDirection === 'OneDirection') {
        return CrossFilteringBehavior.OneDirection;
    }
    return CrossFilteringBehavior.None;
}
//# sourceMappingURL=bim-parser.js.map