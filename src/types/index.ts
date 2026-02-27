/**
 * Node.js library to extract Power BI / Analysis Services Tabular Model metadata
 * @module powerbi-tom-parser
 */

export enum DataType {
  Int64 = 'Int64',
  Double = 'Double',
  Boolean = 'Boolean',
  String = 'String',
  DateTime = 'DateTime',
  Decimal = 'Decimal',
  Binary = 'Binary',
  Table = 'Table',
  Variant = 'Variant',
  Unknown = 'Unknown'
}

export enum PartitionSourceType {
  Query = 'query',
  M = 'm',
  Calculated = 'calculated',
  None = 'none'
}

export enum DataView {
  Full = 'full',
  Sample = 'sample'
}

export enum RelationshipCardinality {
  OneToOne = '1:1',
  OneToMany = '1:*',
  ManyToOne = '*:1'
}

export enum CrossFilteringBehavior {
  BothDirections = 'bothDirections',
  OneDirection = 'oneDirection',
  None = 'none'
}

export interface Annotation {
  name: string;
  value: string;
}

export interface Culture {
  name: string;
  annotations?: Annotation[];
}

export interface DataModelSchema {
  name: string;
  compatibilityLevel: number;
  cultures?: Culture[];
  annotations?: Annotation[];
}

export interface Column {
  name: string;
  dataType: DataType;
  expression?: string;
  formatString?: string;
  summarization?: string;
  isHidden?: boolean;
  description?: string;
}

export interface Partition {
  name: string;
  sourceType: PartitionSourceType;
  expression?: string;
  query?: string;
  dataView?: DataView;
  description?: string;
}

export interface Measure {
  name: string;
  expression: string;
  formatString?: string;
  displayFolder?: string;
  isHidden?: boolean;
  description?: string;
}

export interface Table {
  name: string;
  description?: string;
  columns: Column[];
  partitions: Partition[];
  measures: Measure[];
  isHidden?: boolean;
}

export interface Relationship {
  name?: string;
  fromTable: string;
  toTable: string;
  fromColumn: string;
  toColumn: string;
  cardinality: RelationshipCardinality;
  crossFilteringBehavior: CrossFilteringBehavior;
  isActive: boolean;
  isReferentialIntegrityEnforced?: boolean;
}

export interface TabularModel {
  model: DataModelSchema;
  tables: Table[];
  relationships: Relationship[];
}

export interface ParseOptions {
  includeAnnotations?: boolean;
  includeHiddenObjects?: boolean;
}

export class TomParserError extends Error {
  public readonly code: string;
  public readonly cause?: Error;

  constructor(code: string, message: string, cause?: Error) {
    super(message);
    this.name = 'TomParserError';
    this.code = code;
    this.cause = cause;
  }

  static FILE_NOT_FOUND = 'FILE_NOT_FOUND';
  static INVALID_JSON = 'INVALID_JSON';
  static MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD';
  static UNKNOWN_DATA_TYPE = 'UNKNOWN_DATA_TYPE';
  static MALFORMED_RELATIONSHIP = 'MALFORMED_RELATIONSHIP';
  static INVALID_PARTITION = 'INVALID_PARTITION';
}