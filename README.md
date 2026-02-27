# powerbi-tom-parser

Node.js library to extract Power BI / Analysis Services Tabular Model metadata from `.bim` files.

## Features

- Parse Power BI `.bim` JSON files
- Extract tables, columns, partitions, measures, and relationships
- Support for various partition source types (Query, M, Calculated)
- Automatic encoding detection (UTF-8, UTF-16 LE/BE)
- Full TypeScript support with type definitions

## Installation

```bash
npm install powerbi-tom-parser
```

## Usage

### Parse a .bim file

```javascript
import { parseBimFile } from 'powerbi-tom-parser';

const model = await parseBimFile('./model.bim');

console.log('Tables:', model.tables.map(t => t.name));
console.log('Relationships:', model.relationships.length);
```

### Parse JSON directly

```javascript
import { parseBimJson } from 'powerbi-tom-parser';

const bim = {
  model: {
    name: 'SalesModel',
    compatibilityLevel: 1500,
    tables: [
      {
        name: 'Sales',
        columns: [
          { name: 'Id', dataType: 'Int64' },
          { name: 'Amount', dataType: 'Decimal' }
        ],
        partitions: [
          { name: 'Sales', source: { type: 'query', query: 'SELECT * FROM Sales' } }
        ],
        measures: [
          { name: 'Total Sales', expression: 'SUM(Sales[Amount])' }
        ]
      }
    ],
    relationships: []
  }
};

const model = parseBimJson(bim);
```

### Options

```javascript
const model = await parseBimFile('./model.bim', {
  includeAnnotations: true,  // Include model annotations (default: true)
  includeHiddenObjects: false // Exclude hidden tables/columns/measures
});
```

## TypeScript Types

The library provides full TypeScript type definitions:

```typescript
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
  RelationshipCardinality,
  CrossFilteringBehavior
} from 'powerbi-tom-parser';
```

### Data Types

- `DataType.Int64`, `DataType.Double`, `DataType.Boolean`, `DataType.String`, `DataType.DateTime`, `DataType.Decimal`, etc.

### Partition Source Types

- `PartitionSourceType.Query` - SQL query partition
- `PartitionSourceType.M` - Power Query (M) partition
- `PartitionSourceType.Calculated` - Calculated partition
- `PartitionSourceType.None` - No source

### Relationship Cardinality

- `RelationshipCardinality.OneToOne`
- `RelationshipCardinality.OneToMany`
- `RelationshipCardinality.ManyToOne`

## Error Handling

```javascript
import { parseBimFile, TomParserError } from 'powerbi-tom-parser';

try {
  const model = await parseBimFile('./model.bim');
} catch (error) {
  if (error instanceof TomParserError) {
    console.log('Error code:', error.code);
    console.log('Message:', error.message);
  }
}
```

Error codes:
- `FILE_NOT_FOUND` - BIM file not found
- `INVALID_JSON` - Invalid JSON in file
- `MISSING_REQUIRED_FIELD` - Required field missing
- `UNKNOWN_DATA_TYPE` - Unknown data type
- `MALFORMED_RELATIONSHIP` - Invalid relationship

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Clean
npm run clean
```

## License

MIT