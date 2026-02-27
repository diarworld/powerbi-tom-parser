/**
 * Node.js library to extract Power BI / Analysis Services Tabular Model metadata
 * @module powerbi-tom-parser
 */
export var DataType;
(function (DataType) {
    DataType["Int64"] = "Int64";
    DataType["Double"] = "Double";
    DataType["Boolean"] = "Boolean";
    DataType["String"] = "String";
    DataType["DateTime"] = "DateTime";
    DataType["Decimal"] = "Decimal";
    DataType["Binary"] = "Binary";
    DataType["Table"] = "Table";
    DataType["Variant"] = "Variant";
    DataType["Unknown"] = "Unknown";
})(DataType || (DataType = {}));
export var PartitionSourceType;
(function (PartitionSourceType) {
    PartitionSourceType["Query"] = "query";
    PartitionSourceType["M"] = "m";
    PartitionSourceType["Calculated"] = "calculated";
    PartitionSourceType["None"] = "none";
})(PartitionSourceType || (PartitionSourceType = {}));
export var DataView;
(function (DataView) {
    DataView["Full"] = "full";
    DataView["Sample"] = "sample";
})(DataView || (DataView = {}));
export var RelationshipCardinality;
(function (RelationshipCardinality) {
    RelationshipCardinality["OneToOne"] = "1:1";
    RelationshipCardinality["OneToMany"] = "1:*";
    RelationshipCardinality["ManyToOne"] = "*:1";
})(RelationshipCardinality || (RelationshipCardinality = {}));
export var CrossFilteringBehavior;
(function (CrossFilteringBehavior) {
    CrossFilteringBehavior["BothDirections"] = "bothDirections";
    CrossFilteringBehavior["OneDirection"] = "oneDirection";
    CrossFilteringBehavior["None"] = "none";
})(CrossFilteringBehavior || (CrossFilteringBehavior = {}));
export class TomParserError extends Error {
    code;
    cause;
    constructor(code, message, cause) {
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
//# sourceMappingURL=index.js.map