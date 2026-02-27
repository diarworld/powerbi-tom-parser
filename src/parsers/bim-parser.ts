import * as fs from 'fs/promises';
import {
  TabularModel,
  DataModelSchema,
  Table,
  Column,
  Partition,
  Measure,
  Relationship,
  DataType,
  PartitionSourceType,
  DataView,
  RelationshipCardinality,
  CrossFilteringBehavior,
  TomParserError,
  ParseOptions
} from '../types/index.js';

/**
 * Detect encoding and decode buffer to string
 * Power BI .bim files are often UTF-16 LE encoded
 */
function detectAndDecodeBom(buffer: Buffer): string {
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
export async function parseBimFile(filePath: string, options?: ParseOptions): Promise<TabularModel> {
  try {
    const buffer = await fs.readFile(filePath);
    const content = detectAndDecodeBom(buffer);
    const json = JSON.parse(content);
    return parseBimJson(json, options);
  } catch (error) {
    if (error instanceof TomParserError) {
      throw error;
    }
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new TomParserError(
        TomParserError.FILE_NOT_FOUND,
        `BIM file not found: ${filePath}`,
        error as Error
      );
    }
    if (error instanceof SyntaxError) {
      throw new TomParserError(
        TomParserError.INVALID_JSON,
        `Invalid JSON in BIM file: ${(error as Error).message}`,
        error
      );
    }
    throw new TomParserError(
      'UNKNOWN',
      `Error parsing BIM file: ${(error as Error).message}`,
      error as Error
    );
  }
}

/**
 * Parse a BIM JSON object and extract tabular model metadata
 */
export function parseBimJson(json: any, options?: ParseOptions): TabularModel {
  const includeAnnotations = options?.includeAnnotations ?? true;
  const includeHidden = options?.includeHiddenObjects ?? true;

  if (!json.model) {
    throw new TomParserError(
      TomParserError.MISSING_REQUIRED_FIELD,
      'BIM JSON is missing required "model" property'
    );
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

function parseDataModelSchema(modelJson: any, includeAnnotations: boolean): DataModelSchema {
  const schema: DataModelSchema = {
    name: modelJson.name ?? 'Model',
    compatibilityLevel: modelJson.compatibilityLevel ?? 0,
    cultures: [],
    annotations: []
  };

  if (modelJson.cultures && Array.isArray(modelJson.cultures)) {
    schema.cultures = modelJson.cultures.map((c: any) => ({
      name: c.name,
      annotations: includeAnnotations ? parseAnnotations(c.annotations) : undefined
    }));
  }

  if (modelJson.annotations && includeAnnotations) {
    schema.annotations = parseAnnotations(modelJson.annotations);
  }

  return schema;
}

function parseTables(tablesJson: any[], includeHidden: boolean): Table[] {
  if (!Array.isArray(tablesJson)) {
    return [];
  }

  return tablesJson
    .filter((t: any) => !t.isHidden || includeHidden)
    .map((tableJson: any) => parseTable(tableJson, includeHidden));
}

function parseTable(tableJson: any, includeHidden: boolean): Table {
  return {
    name: tableJson.name ?? 'Table',
    description: tableJson.description,
    isHidden: tableJson.isHidden,
    columns: parseColumns(tableJson.columns ?? [], includeHidden),
    partitions: parsePartitions(tableJson.partitions ?? []),
    measures: parseMeasures(tableJson.measures ?? [], includeHidden)
  };
}

function parseColumns(columnsJson: any[], includeHidden: boolean): Column[] {
  if (!Array.isArray(columnsJson)) {
    return [];
  }

  return columnsJson
    .filter((c: any) => !c.isHidden || includeHidden)
    .map((colJson: any) => parseColumn(colJson));
}

function parseColumn(colJson: any): Column {
  const column: Column = {
    name: colJson.name ?? 'Column',
    dataType: mapDataType(colJson.dataType),
    isHidden: colJson.isHidden,
    description: colJson.description
  };

  if (colJson.expression) {
    column.expression = colJson.expression;
  } else if (colJson.calculatedColumn?.expression) {
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

function parsePartitions(partitionsJson: any[]): Partition[] {
  if (!Array.isArray(partitionsJson)) {
    return [];
  }

  return partitionsJson.map((p: any) => parsePartition(p));
}

function parsePartition(partitionJson: any): Partition {
  const partition: Partition = {
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

function parseMeasures(measuresJson: any[], includeHidden: boolean): Measure[] {
  if (!Array.isArray(measuresJson)) {
    return [];
  }

  return measuresJson
    .filter((m: any) => !m.isHidden || includeHidden)
    .map((m: any) => parseMeasure(m));
}

function parseMeasure(measureJson: any): Measure {
  return {
    name: measureJson.name ?? 'Measure',
    expression: measureJson.expression ?? '',
    formatString: measureJson.formatString,
    displayFolder: measureJson.displayFolder,
    isHidden: measureJson.isHidden,
    description: measureJson.description
  };
}

function parseRelationships(relationshipsJson: any[], tables: Table[]): Relationship[] {
  if (!Array.isArray(relationshipsJson)) {
    return [];
  }

  const tableMap = new Map(tables.map(t => [t.name.toLowerCase(), t]));

  return relationshipsJson.map((relJson: any) => parseRelationship(relJson, tableMap));
}

function parseRelationship(relJson: any, tableMap: Map<string, Table>): Relationship {
  const fromTableName = relJson.fromTable ?? '';
  const toTableName = relJson.toTable ?? '';
  const fromTable = tableMap.get(fromTableName.toLowerCase());
  const toTable = tableMap.get(toTableName.toLowerCase());

  const relationship: Relationship = {
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

function parseAnnotations(annotationsJson: any[]): { name: string; value: string }[] {
  if (!Array.isArray(annotationsJson)) {
    return [];
  }

  return annotationsJson.map((a: any) => ({
    name: a.name ?? '',
    value: a.value ?? ''
  }));
}

function mapDataType(dataType: string | undefined): DataType {
  if (!dataType) {
    return DataType.Unknown;
  }

  const typeMap: Record<string, DataType> = {
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

function mapPartitionSourceType(source: any): PartitionSourceType {
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

function mapCardinality(crossFilterDirection: string | undefined, fromCard: string | undefined, toCard: string | undefined): RelationshipCardinality {
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

function mapCrossFilteringBehavior(crossFilterDirection: string | undefined): CrossFilteringBehavior {
  if (crossFilterDirection === 'Both') {
    return CrossFilteringBehavior.BothDirections;
  }
  if (crossFilterDirection === 'OneDirection') {
    return CrossFilteringBehavior.OneDirection;
  }

  return CrossFilteringBehavior.None;
}